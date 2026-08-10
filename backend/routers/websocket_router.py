import os
import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError

from auth import SECRET_KEY, ALGORITHM
from database import get_session, get_session_messages, log_message
from config import manager, calculate_context_percent
from agent_loop import run_agentic_loop, LAPTOP_CHANNELS

router = APIRouter(tags=["websockets"])


async def chat_ws_reader(websocket: WebSocket, receive_queue: asyncio.Queue):
    from opencode_proxy import PROXY_REQUESTS
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload_data = json.loads(data)
                msg_type = payload_data.get("type")
                if msg_type == "pong":
                    continue
                if msg_type in ("proxy_completion_chunk", "proxy_completion_done", "proxy_completion_error"):
                    request_id = payload_data.get("request_id")
                    if request_id and request_id in PROXY_REQUESTS:
                        status_val = "chunk"
                        if msg_type == "proxy_completion_done":
                            status_val = "done"
                        elif msg_type == "proxy_completion_error":
                            status_val = "error"

                        payload_data["status"] = status_val
                        await PROXY_REQUESTS[request_id].put(payload_data)
                    continue
            except Exception:
                pass
            await receive_queue.put(data)
    except WebSocketDisconnect:
        await receive_queue.put(None)
    except Exception as e:
        await receive_queue.put(e)


@router.websocket("/ws/chat/{session_id}")
async def websocket_chat_endpoint(websocket: WebSocket, session_id: str, token: str = Query(...)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user: str = payload.get("sub")
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        get_session(session_id, user)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect_chat(user, websocket)
    receive_queue = asyncio.Queue()
    reader_task = asyncio.create_task(chat_ws_reader(websocket, receive_queue))

    try:
        messages_history = get_session_messages(session_id)
        initial_percent = calculate_context_percent(messages_history)
        await websocket.send_text(json.dumps({"type": "context_sync", "percent": initial_percent}))

        while True:
            data = await receive_queue.get()
            if data is None:
                break
            if isinstance(data, Exception):
                raise data

            payload_data = json.loads(data)
            query = payload_data.get("message", "").strip()
            model_key = payload_data.get("model", "deepseek-flash")
            client_time = payload_data.get("client_time", None)
            variant = payload_data.get("variant", "High")

            if not query:
                continue

            if query == "/compact":
                try:
                    log_message(session_id, "user", "/compact")

                    await websocket.send_text(json.dumps({
                        "type": "hud_log",
                        "content": "Compacting..."
                    }))

                    from compaction import compact_session_history
                    summary = await compact_session_history(
                        session_id=session_id,
                        user_id=user,
                        model_key=model_key,
                        manager_ref=manager,
                        client_websocket=websocket
                    )

                    messages_history = get_session_messages(session_id)
                    new_percent = calculate_context_percent(messages_history)

                    await websocket.send_text(json.dumps({"type": "tool_success"}))

                    confirm_header = "\n[Chat history has been successfully compacted.]\n\n**Compaction Summary Brief:**\n"
                    confirm_footer = "\n"

                    full_compact_msg = f"{confirm_header}{summary}{confirm_footer}"
                    log_message(session_id, "assistant", full_compact_msg)

                    await websocket.send_text(json.dumps({"type": "token", "content": confirm_header}))
                    await websocket.send_text(json.dumps({"type": "token", "content": summary}))
                    await websocket.send_text(json.dumps({"type": "token", "content": confirm_footer}))

                    latest_msgs = get_session_messages(session_id)
                    await websocket.send_text(json.dumps({
                        "type": "messages_synced",
                        "messages": latest_msgs
                    }))
                    await websocket.send_text(json.dumps({"type": "context_sync", "percent": new_percent}))
                    await websocket.send_text(json.dumps({"type": "done"}))

                except Exception as ex:
                    print(f"[-] Compaction failed: {ex}")
                    err_msg = f"\n[Compaction Error: {str(ex)}]\n"
                    log_message(session_id, "assistant", err_msg)
                    await websocket.send_text(json.dumps({"type": "tool_failed"}))
                    await websocket.send_text(json.dumps({"type": "token", "content": err_msg}))
                    await websocket.send_text(json.dumps({"type": "done"}))
                continue

            elif "/schedule" in query.lower():
                try:
                    log_message(session_id, "user", query)
                    await websocket.send_text(json.dumps({
                        "type": "hud_log",
                        "content": "Designing the Scheduled job component"
                    }))
                    from scheduler import parse_schedule_prompt_with_llm
                    schedule_tag = await parse_schedule_prompt_with_llm(query, user)
                    await websocket.send_text(json.dumps({"type": "tool_success"}))
                    log_message(session_id, "assistant", schedule_tag)
                    await websocket.send_text(json.dumps({"type": "token", "content": schedule_tag}))
                    messages_history = get_session_messages(session_id)
                    post_percent = calculate_context_percent(messages_history)
                    await websocket.send_text(json.dumps({"type": "context_sync", "percent": post_percent}))
                    await websocket.send_text(json.dumps({"type": "done"}))
                except Exception as ex:
                    print(f"[-] Schedule parsing failed: {ex}")
                    err_msg = f"\n[Schedule Parsing Error: {str(ex)}]\n"
                    log_message(session_id, "assistant", err_msg)
                    await websocket.send_text(json.dumps({"type": "tool_failed"}))
                    await websocket.send_text(json.dumps({"type": "token", "content": err_msg}))
                    await websocket.send_text(json.dumps({"type": "done"}))
                continue

            attachments = payload_data.get("attachments", [])
            enriched_query_parts = []

            for att in attachments:
                fn = att.get("filename")
                on = att.get("original_name")
                file_path = os.path.join("uploads", str(session_id), fn)
                if not os.path.exists(file_path):
                    file_path = os.path.join("uploads", fn)
                if os.path.exists(file_path):
                    try:
                        from rag_parser import extract_text_async
                        extracted_text = await extract_text_async(file_path, model=model_key)
                        enriched_query_parts.append(
                            f"--- ATTACHED FILE: {on} ---\n"
                            f"{extracted_text}\n"
                            f"--------------------------------------"
                        )
                    except Exception as extract_err:
                        print(f"Error extracting text from attachment {fn}: {extract_err}")

            if enriched_query_parts:
                context_header = "\n\n".join(enriched_query_parts)
                model_query = f"{context_header}\n\nUser Question:\n{query}"
            else:
                model_query = query

            db_content = query
            if attachments:
                attachments_xml_parts = ["<attachments>"]
                for att in attachments:
                    fn_esc = att.get("filename", "").replace('"', '&quot;')
                    on_esc = att.get("original_name", "").replace('"', '&quot;')
                    url_esc = att.get("url", "").replace('"', '&quot;')
                    tp_esc = att.get("type", "").replace('"', '&quot;')
                    sz_esc = str(att.get("size", 0))
                    pg_esc = str(att.get("num_pages", ""))
                    attachments_xml_parts.append(
                        f'  <attachment filename="{fn_esc}" original_name="{on_esc}" url="{url_esc}" type="{tp_esc}" size="{sz_esc}" num_pages="{pg_esc}" />'
                    )
                attachments_xml_parts.append("</attachments>")
                db_content = f"{query}\n\n" + "\n".join(attachments_xml_parts)

            asyncio.create_task(asyncio.to_thread(log_message, session_id, "user", db_content))

            formatted_history = []
            for msg in messages_history:
                formatted_history.append({"role": msg["role"], "content": msg["content"]})

            full_response = ""
            async_generator = run_agentic_loop(
                prompt=model_query,
                user_id=user,
                session_id=session_id,
                model_key=model_key,
                history=formatted_history,
                manager_ref=manager,
                client_time=client_time,
                client_websocket=websocket,
                variant=variant
            )

            async for chunk_sse in async_generator:
                await websocket.send_text(chunk_sse)
                try:
                    parsed = json.loads(chunk_sse)
                    if parsed.get("type") == "token":
                        full_response += parsed["content"]
                except Exception:
                    pass

            if full_response:
                asyncio.create_task(asyncio.to_thread(log_message, session_id, "assistant", full_response))
                messages_history.append({"role": "user", "content": query})
                messages_history.append({"role": "assistant", "content": full_response})

            post_percent = calculate_context_percent(messages_history)
            await websocket.send_text(json.dumps({"type": "context_sync", "percent": post_percent}))
            await websocket.send_text(json.dumps({"type": "done"}))

    except WebSocketDisconnect:
        manager.disconnect_chat(user, websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect_chat(user, websocket)
    finally:
        reader_task.cancel()


@router.websocket("/ws/laptop")
async def websocket_laptop_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user: str = payload.get("sub")
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect_laptop(user, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload_data = json.loads(data)

                msg_type = payload_data.get("type")
                if msg_type == "pong":
                    continue
                if msg_type in ("proxy_completion_chunk", "proxy_completion_done", "proxy_completion_error"):
                    from opencode_proxy import PROXY_REQUESTS
                    request_id = payload_data.get("request_id")
                    if request_id and request_id in PROXY_REQUESTS:
                        status_val = "chunk"
                        if msg_type == "proxy_completion_done":
                            status_val = "done"
                        elif msg_type == "proxy_completion_error":
                            status_val = "error"

                        payload_data["status"] = status_val
                        await PROXY_REQUESTS[request_id].put(payload_data)
                    continue

                if payload_data.get("type") == "tool_execution_result":
                    request_id = payload_data.get("request_id")
                    future = LAPTOP_CHANNELS.get(request_id)
                    if future and not future.done():
                        future.set_result(payload_data)

                chat_sockets = manager.active_chats.get(user, [])
                for s in chat_sockets:
                    await s.send_text(json.dumps({
                        "type": "laptop_log",
                        "content": payload_data.get("output", data)
                    }))
            except Exception:
                chat_sockets = manager.active_chats.get(user, [])
                for s in chat_sockets:
                    await s.send_text(json.dumps({"type": "laptop_log", "content": data}))

    except WebSocketDisconnect:
        manager.disconnect_laptop(user)
    except Exception as e:
        print(f"Laptop connection error: {e}")
        manager.disconnect_laptop(user)
