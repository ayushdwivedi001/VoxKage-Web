import os
import json
import asyncio
import httpx
from datetime import datetime

from opencode_client import get_opencode_model, get_system_prompt
from memory_engine import recall_user
from database import get_user_settings_profile
from tool_schemas import TOOLS_SCHEMA
from agent_loop import execute_tool_call_v2

# Cloudflare CORS Proxy Target URL
CLOUDFLARE_PROXY_URL = "https://voxkage-proxy.ayushdwivedi001.workers.dev"

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
    Inherits active user model and variant settings, routing completions
    directly through the Cloudflare CORS proxy endpoint to avoid IP rate limits.
    """
    print(f"[*] [CronTaskAgent: {schedule_name}] Starting background execution (Model: {model_key}, Variant: {variant}) for user {user_id}...")
    
    # 1. Resolve memories & local time
    soul_context = recall_user(user_id, "")
    current_time_str = datetime.now().strftime("%A, %B %d, %Y, %I:%M:%S %p")
    
    # 2. Inspect connected MCP servers for this user
    mcp_info = ""
    mcp_tools = []
    try:
        profile = get_user_settings_profile(user_id)
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

    open_code_key = os.getenv("OPENCODE_API_KEY", "")
    if not open_code_key:
        print(f"[-] [CronTaskAgent: {schedule_name}] Error: OPENCODE_API_KEY environment variable missing.")
        return "Error: OPENCODE_API_KEY is not configured on backend."

    model_id = get_opencode_model(model_key)
    all_tools = TOOLS_SCHEMA + mcp_tools

    from agent_loop import get_variant_overrides
    variant_params = get_variant_overrides(variant)

    max_loops = 15
    loop_count = 0
    final_report = ""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {open_code_key}"
    }

    while loop_count < max_loops:
        loop_count += 1
        print(f"[*] [CronTaskAgent: {schedule_name}] Running loop iteration {loop_count}/{max_loops}...")

        body = {
            "model": model_id,
            "messages": messages,
            "stream": True,
            "tools": all_tools,
            "tool_choice": "auto"
        }
        body.update(variant_params)

        # Query completions proxy (Worker Proxy → Direct Zen API)
        current_content = ""
        current_tool_calls = []
        
        is_local = os.getenv("IS_LOCAL", "").lower() in ("true", "1")
        target_urls = ["https://voxkage-proxy.ayushdwivedi001.workers.dev/zen/v1/chat/completions"]
        if is_local:
            target_urls.append("http://localhost:3000/api/completions/proxy")
        target_urls.append("https://opencode.ai/zen/v1/chat/completions")

        stream_success = False
        last_fetch_err = ""

        for target_url in target_urls:
            try:
                async with httpx.AsyncClient(http2=False, timeout=timeout) as client:
                    async with client.stream("POST", target_url, headers=headers, json=body) as response:
                        if response.status_code != 200:
                            err_text = await response.aread()
                            print(f"[-] [CronTaskAgent: {schedule_name}] Target {target_url} returned HTTP {response.status_code}: {err_text.decode('utf-8')}")
                            continue

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
                            break

            except Exception as fetch_err:
                last_fetch_err = str(fetch_err)
                print(f"[-] [CronTaskAgent: {schedule_name}] Target {target_url} failed: {fetch_err}")
                continue

        if not stream_success:
            return f"Error: Failed to stream from completions proxies: {last_fetch_err}"

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
