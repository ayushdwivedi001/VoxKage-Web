import asyncio
import uuid
import json
import os
import httpx
from typing import AsyncGenerator

# Global registry of client completion streams: { request_id: asyncio.Queue }
PROXY_REQUESTS = {}

async def query_opencode_proxy(
    payload: dict,
    manager_ref,
    user_id: str,
    client_websocket = None,
    timeout: float = 180.0
) -> AsyncGenerator[str, None]:
    """
    Delegates OpenCode completions stream query to a client (laptop daemon)
    to route requests through residential/cellular IPs, bypassing server rate limits.
    If the laptop bridge is offline or fails, falls back directly to querying the
    OpenCode Zen API from the backend server.
    """
    request_id = f"proxy_{uuid.uuid4()}"
    queue = asyncio.Queue()
    PROXY_REQUESTS[request_id] = queue

    # Check if Laptop Daemon is connected
    laptop_ws = None
    if manager_ref and hasattr(manager_ref, "active_laptops"):
        laptops_dict = manager_ref.active_laptops
        laptop_ws = laptops_dict.get(user_id)
        if not laptop_ws and laptops_dict:
            laptop_ws = list(laptops_dict.values())[0]

    candidates = []
    if laptop_ws:
        candidates.append((laptop_ws, "laptop"))
    
    # We do NOT add browser client websockets as candidates because they do not
    # implement proxy completion request handlers. Falling back to browser chat
    # sockets causes a silent hang.

    api_key = os.getenv("OPENCODE_API_KEY")
    req_payload = {
        "type": "proxy_completion_request",
        "request_id": request_id,
        "payload": {
            "model": payload.get("model"),
            "messages": payload.get("messages"),
            "tools": payload.get("tools"),
            "tool_choice": payload.get("tool_choice"),
            "temperature": payload.get("temperature", 0.7),
            "stream": True,
            "api_key": api_key
        }
    }

    success_sent = False
    last_err = "Laptop bridge daemon is not connected."
    
    for ws, ws_type in candidates:
        try:
            await ws.send_text(json.dumps(req_payload))
            success_sent = True
            break
        except Exception as e:
            last_err = f"Failed to send to {ws_type}: {e}"
            if manager_ref:
                try:
                    if ws_type == "laptop" and hasattr(manager_ref, "disconnect_laptop"):
                        manager_ref.disconnect_laptop(user_id)
                except Exception as clean_err:
                    print(f"Error cleaning up socket: {clean_err}")

    # Fall back directly to OpenCode Zen API from the server if bridge is unavailable
    if not success_sent:
        if request_id in PROXY_REQUESTS:
            del PROXY_REQUESTS[request_id]
        
        print(f"[*] Laptop bridge unavailable ({last_err}). Falling back to direct OpenCode Zen API call...")
        if not api_key:
            yield {"content": "Error: OPENCODE_API_KEY environment variable is not configured."}
            return

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        url = "https://opencode.ai/zen/v1/chat/completions"
        
        req_body = {
            "model": payload.get("model"),
            "messages": payload.get("messages"),
            "temperature": payload.get("temperature", 0.7),
            "stream": True
        }
        if payload.get("tools"):
            req_body["tools"] = payload.get("tools")
        if payload.get("tool_choice"):
            req_body["tool_choice"] = payload.get("tool_choice")

        try:
            async with httpx.AsyncClient(http2=False, timeout=timeout) as client:
                async with client.stream("POST", url, headers=headers, json=req_body) as response:
                    if response.status_code != 200:
                        err_text = await response.aread()
                        yield {"content": f"Error: OpenCode API returned HTTP {response.status_code}: {err_text.decode('utf-8')}"}
                        return
                    
                    async for line in response.aiter_lines():
                        clean_line = line.strip()
                        if clean_line.startswith("data:"):
                            clean_line = clean_line[5:].strip()
                        if not clean_line:
                            continue
                        if clean_line == "[DONE]":
                            break
                        try:
                            chunk = json.loads(clean_line)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            if delta:
                                yield delta
                        except json.JSONDecodeError:
                            # Skip non-JSON metadata lines or keepalive signals in SSE stream
                            continue
            return
        except Exception as e:
            yield {"content": f"Error: Direct OpenCode request failed: {str(e)}"}
            return

    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=timeout)
            except asyncio.TimeoutError:
                yield {"content": "Error: Client proxy completion request timed out."}
                break

            status = msg.get("status")
            if status == "chunk":
                delta = msg.get("delta")
                if delta:
                    yield delta
            elif status == "done":
                break
            elif status == "error":
                err_msg = msg.get("error", "Unknown client error")
                yield {"content": f"Error: Client-side completion failed: {err_msg}"}
                break
    finally:
        if request_id in PROXY_REQUESTS:
            del PROXY_REQUESTS[request_id]
