import os
import json
import asyncio
import httpx
from datetime import datetime

from opencode_client import get_opencode_model, get_system_prompt
from memory_engine import recall_user
from database import get_user_settings_profile
from tool_schemas import TOOLS_SCHEMA
from agent_loop import execute_tool_call_v2, get_variant_overrides

async def run_cron_agent_loop(
    user_id: str,
    schedule_name: str,
    instruction: str,
    model_key: str = "deepseek-flash",
    variant: str = "Max",
    timeout: float = 600.0
) -> str:
    """
    Spawns an isolated background subagent for a scheduled cron job.
    Dynamically routes completions to Kilo AI Gateway or OpenCode Zen API
    based on user settings & selected model, with automatic fallback to Kilo Code Gateway
    and exponential backoff on HTTP 429 / connection rate limit errors.
    """
    print(f"[*] [CronTaskAgent: {schedule_name}] Starting background execution (Model: {model_key}, Variant: {variant}) for user {user_id}...")

    # 1. Resolve memories & local time
    soul_context = recall_user(user_id, "")
    current_time_str = datetime.now().strftime("%A, %B %d, %Y, %I:%M:%S %p")

    # 2. Inspect user settings profile and API keys
    profile = {}
    try:
        profile = get_user_settings_profile(user_id) or {}
    except Exception as pe:
        print(f"[-] [CronTaskAgent: {schedule_name}] Profile lookup notice: {pe}")

    kilo_key = os.getenv("KILO_API_KEY", "").strip() or str(profile.get("kilo_api_key") or profile.get("kiloApiKey") or "").strip()
    opencode_key = os.getenv("OPENCODE_API_KEY", "").strip() or str(profile.get("opencode_api_key") or profile.get("openCodeApiKey") or "").strip()

    # 3. Inspect connected MCP servers for this user
    mcp_info = ""
    mcp_tools = []
    try:
        connections = profile.get("mcp_connections") or {}
        if connections:
            mcp_info = "\n--- ACTIVE MCP CONNECTIONS ---\n"
            for provider, conn in connections.items():
                if provider == "gmail":
                    mcp_info += (
                        "- Gmail is connected and fully authenticated via OAuth.\n"
                        "  You MUST use the 'gmail__search_threads', 'gmail__get_thread', 'gmail__create_draft', 'gmail__list_drafts', and 'gmail__list_labels' tools to access and manage the user's mailbox.\n"
                    )
                    from mcp_servers.gmail.gmail_mcp import GMAIL_TOOLS
                    tools_list = GMAIL_TOOLS
                else:
                    mcp_info += f"- {provider.title()} is connected.\n"
                    tools_list = conn.get("tools") or []

                for t in tools_list:
                    mcp_tools.append({
                        "type": "function",
                        "function": {
                            "name": f"{provider}__{t['name']}",
                            "description": f"[{provider.upper()} MCP] {t['description']}",
                            "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}
                        }
                    })
    except Exception as e:
        print(f"[-] [CronTaskAgent: {schedule_name}] Failed to resolve user MCP profile: {e}")

    system_prompt = (
        f"{get_system_prompt()}\n\n"
        f"You are VoxKage CronTaskAgent, an isolated, autonomous subagent running in the background for schedule: '{schedule_name}'.\n"
        f"--- DYNAMIC SESSION CONTEXT ---\n"
        f"The current local date and time is {current_time_str}. Use this exact timestamp when answering queries. Never guess the time.\n"
        f"{mcp_info}\n"
        f"--- USER SOUL PROFILE MEMORIES ---\n{soul_context}\n\n"
        f"Your directive is to execute the user's scheduled instruction efficiently using your available tools, and produce a clear, factual, well-formatted final report."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": instruction}
    ]

    all_tools = TOOLS_SCHEMA + mcp_tools
    variant_params = get_variant_overrides(variant)

    max_loops = 15
    loop_count = 0
    final_report = ""

    # Determine if primary model is a Kilo AI model
    is_kilo_model = (
        "/" in model_key
        or "kilo" in model_key.lower()
        or "gemini" in model_key.lower()
        or "claude" in model_key.lower()
        or "mimo" in model_key.lower()
        or (kilo_key and not opencode_key)
    )

    while loop_count < max_loops:
        loop_count += 1
        print(f"[*] [CronTaskAgent: {schedule_name}] Running loop iteration {loop_count}/{max_loops}...")

        body_base = {
            "messages": messages,
            "stream": True,
            "tools": all_tools,
            "tool_choice": "auto"
        }
        body_base.update(variant_params)

        current_content = ""
        current_tool_calls = []

        # Construct execution strategy candidates in priority order:
        strategies = []

        if is_kilo_model and kilo_key:
            from kilo_client import get_kilo_model_dynamic
            kilo_model_id = await get_kilo_model_dynamic(model_key, kilo_key)
            strategies.append({
                "name": "Kilo AI Gateway (Primary)",
                "url": "https://api.kilo.ai/api/gateway/chat/completions",
                "headers": {"Content-Type": "application/json", "Authorization": f"Bearer {kilo_key}"},
                "model": kilo_model_id
            })

        if opencode_key:
            strategies.append({
                "name": "OpenCode Zen API",
                "url": "https://opencode.ai/zen/v1/chat/completions",
                "headers": {"Content-Type": "application/json", "Authorization": f"Bearer {opencode_key}"},
                "model": get_opencode_model(model_key)
            })

        if kilo_key:
            # Fallback strategy using Kilo Code Gateway with high-availability free model
            strategies.append({
                "name": "Kilo Code Gateway (Fallback)",
                "url": "https://api.kilo.ai/api/gateway/chat/completions",
                "headers": {"Content-Type": "application/json", "Authorization": f"Bearer {kilo_key}"},
                "model": "stepfun/step-3.7-flash:free"
            })

        if not strategies:
            print(f"[-] [CronTaskAgent: {schedule_name}] Error: No valid API keys found (neither KILO_API_KEY nor OPENCODE_API_KEY configured).")
            return "Error: No valid API keys configured for background execution."

        stream_success = False
        last_fetch_err = ""

        for strat in strategies:
            strat_name = strat["name"]
            strat_url = strat["url"]
            strat_headers = strat["headers"]
            strat_model = strat["model"]

            body = dict(body_base)
            body["model"] = strat_model

            # Attempt querying target strategy with retries on 429
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(http2=False, timeout=timeout) as client:
                        async with client.stream("POST", strat_url, headers=strat_headers, json=body) as response:
                            if response.status_code == 429:
                                err_bytes = await response.aread()
                                wait_time = (attempt + 1) * 3
                                print(f"[-] [CronTaskAgent: {schedule_name}] {strat_name} ({strat_url}) returned HTTP 429 Rate Limit: {err_bytes.decode('utf-8', errors='ignore')}. Retrying in {wait_time}s...")
                                await asyncio.sleep(wait_time)
                                continue

                            if response.status_code != 200:
                                err_bytes = await response.aread()
                                print(f"[-] [CronTaskAgent: {schedule_name}] {strat_name} ({strat_url}) returned HTTP {response.status_code}: {err_bytes.decode('utf-8', errors='ignore')}")
                                break

                            async for line in response.aiter_lines():
                                clean_line = line.strip()
                                if clean_line.startswith("data:"):
                                    clean_line = clean_line[5:].strip()
                                if not clean_line or clean_line == "[DONE]":
                                    continue

                                try:
                                    chunk = json.loads(clean_line)
                                    choices = chunk.get("choices")
                                    if not choices or not isinstance(choices, list) or len(choices) == 0:
                                        continue
                                    choice = choices[0]
                                    delta = choice.get("delta", {})

                                    if delta.get("content"):
                                        current_content += delta["content"]
                                        final_report += delta["content"]
                                        stream_success = True

                                    if "tool_calls" in delta:
                                        stream_success = True
                                        for tc in delta["tool_calls"]:
                                            tc_idx = tc.get("index", 0)
                                            while len(current_tool_calls) <= tc_idx:
                                                current_tool_calls.append({
                                                    "id": "",
                                                    "type": "function",
                                                    "function": {"name": "", "arguments": ""}
                                                })
                                            if tc.get("id"):
                                                current_tool_calls[tc_idx]["id"] = tc["id"]
                                            if tc.get("function", {}).get("name"):
                                                current_tool_calls[tc_idx]["function"]["name"] = tc["function"]["name"]
                                            if tc.get("function", {}).get("arguments"):
                                                current_tool_calls[tc_idx]["function"]["arguments"] += tc["function"]["arguments"]

                                except json.JSONDecodeError:
                                    continue

                            if stream_success:
                                print(f"[+] [CronTaskAgent: {schedule_name}] Stream completed successfully using {strat_name}.")
                                break

                except Exception as fetch_err:
                    last_fetch_err = str(fetch_err)
                    print(f"[-] [CronTaskAgent: {schedule_name}] Strategy {strat_name} ({strat_url}) attempt {attempt+1} failed: {fetch_err}")
                    await asyncio.sleep(2)
                    continue

                if stream_success:
                    break

            if stream_success:
                break

        if not stream_success:
            return f"Error: All completion strategies failed. Last error: {last_fetch_err}"

        if current_tool_calls:
            print(f"[*] [CronTaskAgent: {schedule_name}] Executing {len(current_tool_calls)} tool calls...")
            messages.append({
                "role": "assistant",
                "content": current_content or None,
                "tool_calls": current_tool_calls
            })

            tool_context = {
                "web_search_called": False,
                "consulted_sources": [],
                "map_tag": None,
                "weather_tag": None,
                "chart_tag": None,
                "flow_tag": None,
                "chemistry_tag": None,
                "timeline_tag": None,
                "calculator_tag": None
            }

            tasks = [
                execute_tool_call_v2(
                    tc=tc,
                    user_id=user_id,
                    session_id="cron-background-execution",
                    client_websocket=None,
                    manager_ref=None,
                    client_time=current_time_str,
                    model_key=model_key,
                    tool_context=tool_context
                ) for tc in current_tool_calls
            ]

            results = await asyncio.gather(*tasks)

            for tc_id, out, success in results:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc_id,
                    "content": out
                })
        else:
            # Agent completed turns
            break

    print(f"[+] [CronTaskAgent: {schedule_name}] Task execution completed successfully.")
    return final_report or "No report could be compiled by the background agent."

