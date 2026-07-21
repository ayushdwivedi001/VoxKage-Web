import json
import asyncio
import os
import httpx
from database import get_db, log_message
from opencode_proxy import query_opencode_proxy
from opencode_client import get_opencode_model

async def compact_session_history(
    session_id: str,
    user_id: str,
    model_key: str,
    manager_ref,
    client_websocket=None
) -> str:
    """
    Summarizes the chat history using the active session model, deletes old message logs,
    and inserts a single compacted brief message in the database.
    Integrates retry logic and Kilo API fallback to guarantee compaction succeeds.
    """
    # 1. Fetch all database messages for the session
    db = get_db()
    res = db.table("messages").select("*").eq("session_id", session_id).order("timestamp", desc=False).execute()
    messages = res.data or []
    if not messages:
        return "No messages to compact."

    # 2. Format history into a plain text block
    history_lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if content.startswith("[COMPACTED CONTEXT BRIEF:"):
            history_lines.append(f"--- PREVIOUS COMPACTED CONTEXT BRIEF ---\n{content}\n")
        else:
            history_lines.append(f"{role.upper()}: {content}")
    history_text = "\n\n".join(history_lines)

    # 3. Instruct model to summarize history
    system_instr = (
        "You are a professional compiler. Your job is to summarize the chat history between the user and VoxKage (an advanced agentic AI assistant) into a single dense context brief.\n"
        "Extract all key facts about the user, completed laptop commands, modified files, active projects, decisions made, and pending action items.\n"
        "Keep the summary extremely detailed, precise, and developer-oriented. Do not lose critical technical details, file modifications, or decisions made.\n"
        "Output ONLY the detailed developer summary. Do not include any conversational filler, intro, or outro."
    )

    messages_payload = [
        {"role": "system", "content": system_instr},
        {"role": "user", "content": f"Here is the chat history to compact:\n\n{history_text}"}
    ]

    # Attempt compaction using a robust multi-provider strategy with retries
    summary_text = ""
    last_error = ""

    # Strategy 1: OpenCode Zen API (User's active model or default deepseek) with retries
    model_id = get_opencode_model(model_key)
    # If the user model is a Kilo model, skip OpenCode Zen strategy directly
    is_kilo_model = "/" in model_key or "kilo" in model_key.lower()

    if not is_kilo_model:
        for attempt in range(3):
            try:
                payload = {
                    "model": model_id,
                    "messages": messages_payload,
                    "temperature": 0.3
                }
                summary_chunks = []
                async for chunk in query_opencode_proxy(
                    payload=payload,
                    manager_ref=manager_ref,
                    user_id=user_id,
                    client_websocket=client_websocket,
                    timeout=90.0
                ):
                    if isinstance(chunk, dict):
                        err_msg = chunk.get("content")
                        if err_msg and err_msg.startswith("Error:"):
                            raise Exception(err_msg)
                        delta = chunk.get("content", "")
                        if delta:
                            summary_chunks.append(delta)
                summary_text = "".join(summary_chunks).strip()
                if summary_text:
                    break
            except Exception as e:
                last_error = str(e)
                print(f"[-] Compaction attempt {attempt+1} failed: {e}")
                if "429" in last_error or "limit" in last_error.lower():
                    # Quick sleep before retry or fallback
                    await asyncio.sleep(2.0)

    # Strategy 2: Fallback to Kilo Code Gateway using StepFun 3.7 Flash Free
    if not summary_text:
        print("[*] Falling back to Kilo Code Gateway for history compaction...")
        kilo_api_key = os.getenv("KILO_API_KEY", "")
        if kilo_api_key:
            headers = {
                "Authorization": f"Bearer {kilo_api_key.strip()}",
                "Content-Type": "application/json"
            }
            # Use stepfun/step-3.7-flash:free as a fast, reliable model for compaction
            req_body = {
                "model": "stepfun/step-3.7-flash:free",
                "messages": messages_payload,
                "temperature": 0.3,
                "stream": False
            }
            url = "https://api.kilo.ai/api/gateway/chat/completions"
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=90.0) as client:
                        resp = await client.post(url, headers=headers, json=req_body)
                        if resp.status_code == 200:
                            res_json = resp.json()
                            summary_text = res_json["choices"][0]["message"]["content"].strip()
                            if summary_text:
                                print("[+] Compaction succeeded using Kilo Code StepFun fallback!")
                                break
                        else:
                            last_error = f"Kilo API HTTP {resp.status_code}: {resp.text}"
                except Exception as e:
                    last_error = str(e)
                    print(f"[-] Kilo fallback compaction attempt {attempt+1} failed: {e}")
                    await asyncio.sleep(2.0)

    if not summary_text:
        raise Exception(f"Failed to generate compaction summary: {last_error or 'Empty response from models.'}")

    # 4. Perform transaction: delete old messages and insert compacted assistant brief
    try:
        db.table("messages").delete().eq("session_id", session_id).execute()
    except Exception as e:
        raise Exception(f"Database error deleting old history: {e}")

    compacted_content = f"[COMPACTED CONTEXT BRIEF:\n{summary_text}\n]"
    try:
        db.table("messages").insert({
            "session_id": session_id,
            "role": "assistant",
            "content": compacted_content
        }).execute()
    except Exception as e:
        raise Exception(f"Database error saving compacted brief: {e}")

    return summary_text
