import asyncio
import json
import base64
import os
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
import httpx

from database import (
    get_active_schedules,
    update_schedule,
    get_or_create_schedule_session,
    log_message,
    get_session_messages,
    prune_scheduled_session_messages,
    get_user_settings_profile,
    get_schedule
)

# Cache of currently running schedule tasks to avoid overlapping executions
RUNNING_SCHEDULES = set()

def cron_matches(cron_str: str, dt: datetime) -> bool:
    """
    Checks if a standard cron expression matches a datetime (dt).
    Supports '*', integers, step ranges, and comma-separated lists.
    """
    parts = cron_str.strip().split()
    if len(parts) != 5:
        return False
    
    minute_pat, hour_pat, day_pat, month_pat, dow_pat = parts
    
    if not match_cron_field(minute_pat, dt.minute, 0, 59):
        return False
    if not match_cron_field(hour_pat, dt.hour, 0, 23):
        return False
    if not match_cron_field(day_pat, dt.day, 1, 31):
        return False
    if not match_cron_field(month_pat, dt.month, 1, 12):
        return False
        
    cron_weekday = dt.weekday() + 1
    if cron_weekday == 7:
        pass # Sun can be 0 or 7
        
    def matches_dow(pattern):
        if pattern == "*":
            return True
        for part in pattern.split(","):
            if "/" in part:
                val_range = part.split("/")
                step = int(val_range[1])
                if cron_weekday % step == 0 or (dt.weekday() == 6 and step == 7):
                    return True
            else:
                try:
                    val = int(part)
                    if (val == 0 or val == 7) and dt.weekday() == 6:
                        return True
                    if val == cron_weekday:
                        return True
                except ValueError:
                    pass
        return False
        
    if dow_pat != "*" and not matches_dow(dow_pat):
        return False
        
    return True

def match_cron_field(pattern: str, value: int, min_val: int, max_val: int) -> bool:
    if pattern == "*":
        return True
    
    for part in pattern.split(","):
        if "/" in part:
            val_range = part.split("/")
            base = val_range[0]
            step = int(val_range[1])
            if base == "*":
                if (value - min_val) % step == 0:
                    return True
            else:
                start = int(base)
                if value >= start and (value - start) % step == 0:
                    return True
        elif "-" in part:
            start_str, end_str = part.split("-")
            if int(start_str) <= value <= int(end_str):
                return True
        else:
            try:
                if int(part) == value:
                    return True
            except ValueError:
                pass
    return False

async def parse_schedule_prompt_with_llm(query: str, user_id: str) -> str:
    """
    Parses a schedule prompt and returns a configured <ScheduleSetup ... /> tag.
    """
    from opencode_client import query_opencode_zen
    
    current_time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    prompt = (
        f"You are the timing parsing agent of VoxKage. The user wants to schedule a task:\n"
        f"Query: \"{query}\"\n\n"
        f"The current time is {current_time_str}.\n"
        f"Analyze the scheduling query and extract:\n"
        f"1. A clean description of timings (e.g. 'every day at 4am', 'every Tuesday around 5am').\n"
        f"2. Interval duration in HOURS (must be integer, default: 24 for daily, 1 for hourly, 168 for weekly).\n"
        f"3. A standard cron expression in UTC. Note: you must convert the user's relative timing (if local) into UTC. "
        f"Assume the user is in IST (timezone offset +05:30) if not specified (since local time was 2026-07-14 06:41 IST). "
        f"For example, 4 AM IST is 10:30 PM UTC on the previous day. So the cron should be: '30 22 * * *'.\n"
        f"4. A clean instruction detailing *only* what to execute, removing '/schedule' and the timing phrases.\n"
        f"5. A suggested short, descriptive name (e.g. 'Schedule Job 1' or 'Stock Market Analysis').\n"
        f"6. Estimated agent loops (integer: 5 is baseline, if they list multiple steps like 'check mail, search news' increase it to 10 or 12).\n\n"
        f"Respond ONLY with the following XML tag and absolutely nothing else. No explanation, no markdown wrap:\n"
        f"<ScheduleSetup timings=\"[timing description]\" interval=\"[interval_hours]\" cron=\"[cron_expression]\" instruction=\"[clean_instruction]\" suggested_name=\"[suggested_name]\" estimated_loops=\"[estimated_loops]\" />"
    )
    
    try:
        res = await query_opencode_zen(prompt, model_key="deepseek-flash")
        res = res.strip()
        import re
        match = re.search(r'(<ScheduleSetup\s+.*?\s*/>)', res, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1)
    except Exception as e:
        print(f"[-] Failed to query LLM for schedule parsing: {e}")
        
    return f'<ScheduleSetup timings="every 24 hours" interval="24" cron="0 0 * * *" instruction="{query}" suggested_name="Schedule Job 1" estimated_loops="5" />'

async def send_email_direct(to_email: str, subject: str, body: str, access_token: str):

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    mime_msg = MIMEText(body, "html" if "<" in body and ">" in body else "plain")
    mime_msg["to"] = to_email
    mime_msg["subject"] = subject
    
    raw_b64 = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers=headers,
            json={"raw": raw_b64}
        )
        if res.status_code not in (200, 201):
            raise Exception(f"Gmail Send API returned HTTP {res.status_code}: {res.text}")
        return res.json().get("id")

async def refresh_gmail_token(user_id: str) -> str:
    profile = get_user_settings_profile(user_id)
    connections = profile.get("mcp_connections") or {}
    conn = connections.get("gmail")
    if not conn:
        raise Exception("Gmail connection not found for user.")
        
    from mcp_client import get_valid_token
    return await get_valid_token(user_id, "gmail", conn)

async def execute_schedule_job(schedule: dict):
    schedule_id = schedule["id"]
    user_id = schedule["user_id"]
    name = schedule["name"]
    instruction = schedule["instruction"]
    retrieval_method = schedule["retrieval_method"]
    
    # Double-check if the schedule still exists and is active in the database
    try:
        db_sched = get_schedule(schedule_id, user_id)
        if not db_sched.get("is_active"):
            print(f"[!] Schedule {name} ({schedule_id}) is paused/inactive. Skipping execution.")
            return
    except Exception:
        print(f"[!] Schedule {name} ({schedule_id}) no longer exists in database. Skipping execution.")
        return

    if schedule_id in RUNNING_SCHEDULES:
        print(f"[!] Schedule {name} ({schedule_id}) is already running. Skipping overlapping execution.")
        return
        
    RUNNING_SCHEDULES.add(schedule_id)
    print(f"[*] Starting execution of scheduled job: {name}")
    
    try:
        # 1. Resolve session
        session_id = get_or_create_schedule_session(user_id, schedule_id, name)
        
        # 2. Log start execution message
        log_message(session_id, "user", f"[Automated Execution Triggered]\nInstruction: {instruction}")
        
        # 3. Load chat history for context
        db_messages = get_session_messages(session_id)
        history = []
        for m in db_messages:
            history.append({"role": m["role"], "content": m["content"]})
            
        # Keep history minimal for automated runs (e.g. last 10 messages)
        history = history[-10:] if len(history) > 10 else history
        
        # 4. Trigger server-side agentic loop
        from agent_loop import run_agentic_loop
        
        # Determine dynamic loop size based on number of tasks/APIs mentioned
        keywords = ["notion", "gmail", "calendar", "drive", "indeed", "news", "github"]
        task_count = sum(1 for kw in keywords if kw in instruction.lower())
        variant_overrides = "XHigh" if task_count > 2 else "High"
        
        final_content = ""
        try:
            async for chunk_str in run_agentic_loop(
                prompt=instruction,
                user_id=user_id,
                session_id=session_id,
                model_key="deepseek-flash",
                history=history,
                variant=variant_overrides
            ):
                chunk = json.loads(chunk_str)
                if chunk.get("type") == "token":
                    final_content += chunk.get("content", "")
                elif chunk.get("type") == "error":
                    final_content += f"\n\n[Agent Error: {chunk.get('content')}]"
        except Exception as loop_err:
            final_content += f"\n\n[Agent Loop Crash: {str(loop_err)}]"
            
        if not final_content.strip():
            final_content = "No report could be compiled by the agent."
            
        # Formatted heading for automated runs
        now_local = datetime.now(timezone.utc)
        header_title = f"### ⏰ Automated Run: {name}\n**Timestamp:** {now_local.strftime('%Y-%m-%d %I:%M:%S %p')} UTC\n\n"
        full_report = f"{header_title}{final_content}"
        
        # 5. Log assistant response to DB
        log_message(session_id, "assistant", full_report)
        
        # 6. Deliver updates via retrieval_method
        if retrieval_method == "gmail":
            try:
                access_token = await refresh_gmail_token(user_id)
                # Resolve the actual authenticated Gmail address — never assume it matches user_id
                try:
                    async with httpx.AsyncClient(timeout=10.0) as profile_client:
                        profile_res = await profile_client.get(
                            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                            headers={"Authorization": f"Bearer {access_token}"}
                        )
                        if profile_res.status_code == 200:
                            gmail_address = profile_res.json().get("emailAddress", user_id)
                        else:
                            gmail_address = user_id
                except Exception:
                    gmail_address = user_id

                subject = f"VoxKage Schedule Alert: {name}"
                body_html = f"<h2>VoxKage Automated Report: {name}</h2><hr/><p>{final_content.replace(chr(10), '<br/>')}</p>"
                await send_email_direct(gmail_address, subject, body_html, access_token)
                print(f"[+] Gmail alert sent successfully for schedule {name} → {gmail_address}")
            except Exception as mail_err:
                print(f"[-] Failed to send Gmail notification for schedule {name}: {mail_err}")
                log_message(session_id, "assistant", f"*[Notification Warning: Failed to send Gmail report: {str(mail_err)}]*")
        elif retrieval_method == "telegram":
            print(f"[!] Telegram retrieval method requested but Telegram is not connected.")
            log_message(session_id, "assistant", "*[Notification Warning: Telegram is not connected. Saved in site notifications only.]*")
            
    except Exception as e:
        print(f"[-] Execution of scheduled job {name} failed: {e}")
    finally:
        RUNNING_SCHEDULES.discard(schedule_id)

async def scheduler_loop():
    print("[*] VoxKage Web Scheduler background worker started.")
    
    try:
        pruned = prune_scheduled_session_messages(7)
        if pruned > 0:
            print(f"[*] Cleanup task: Pruned {pruned} messages older than 7 days from scheduled sessions.")
    except Exception as clean_err:
        print(f"[-] Cleanup task error: {clean_err}")
        
    last_cleanup = datetime.now(timezone.utc)
    
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            
            if (now_utc - last_cleanup).total_seconds() >= 86400:
                try:
                    pruned = prune_scheduled_session_messages(7)
                    if pruned > 0:
                        print(f"[*] Cleanup task: Pruned {pruned} messages older than 7 days.")
                    last_cleanup = now_utc
                except Exception as clean_err:
                    print(f"[-] Cleanup task error: {clean_err}")
            
            schedules = get_active_schedules()
            for s in schedules:
                cron_str = s.get("cron_expression")
                if not cron_str:
                    continue
                    
                if cron_matches(cron_str, now_utc):
                    last_run_str = s.get("last_run")
                    should_run = True
                    if last_run_str:
                        try:
                            last_run_dt = datetime.fromisoformat(last_run_str.replace("Z", "+00:00"))
                            if (now_utc - last_run_dt).total_seconds() < 50:
                                should_run = False
                        except:
                            pass
                            
                    if should_run:
                        try:
                            update_schedule(s["id"], s["user_id"], {"last_run": now_utc.isoformat()})
                        except Exception as lock_err:
                            print(f"[-] Failed to update last_run lock for {s['name']}: {lock_err}")
                            continue
                            
                        asyncio.create_task(execute_schedule_job(s))
                        
        except Exception as loop_err:
            print(f"[-] Error in scheduler main loop: {loop_err}")
            
        await asyncio.sleep(30)

async def start_scheduler():
    asyncio.create_task(scheduler_loop())
