import os
from dotenv import load_dotenv

# Load local environment variables from current backend/.env file BEFORE other imports
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

import json
import asyncio
from typing import List, Dict, Optional
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from auth import create_access_token, get_current_user
from database import (
    create_session, list_sessions, get_session, update_session_name, delete_session,
    log_message, get_session_messages, get_user_favorites, save_user_favorites,
    get_user_settings_profile, save_user_settings_profile, toggle_session_star
)
from opencode_client import list_opencode_models
from agent_loop import run_agentic_loop, LAPTOP_CHANNELS

app = FastAPI(title="VoxKage Web API", version="2026.06.30")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def estimate_tokens(messages: list) -> int:
    total_chars = 15000 
    for m in messages:
        content = ""
        role = ""
        if isinstance(m, dict):
            content = m.get("content") or ""
            role = m.get("role") or ""
        elif hasattr(m, "content") and hasattr(m, "role"):
            content = m.content or ""
            role = m.role or ""
        total_chars += len(str(content)) + len(str(role))
    return int(total_chars / 4.2)

def calculate_context_percent(messages: list) -> int:
    tokens = estimate_tokens(messages)
    percent = int((tokens / 200000) * 100)
    return min(100, max(0, percent))

# --- Connection Registry Manager ---
from starlette.websockets import WebSocketState

def is_websocket_connected(ws) -> bool:
    try:
        return ws is not None and ws.client_state == WebSocketState.CONNECTED and ws.application_state == WebSocketState.CONNECTED
    except:
        return False

class ConnectionManager:
    def __init__(self):
        self._active_chats: Dict[str, List[WebSocket]] = {}
        self._active_laptops: Dict[str, WebSocket] = {}

    @property
    def active_chats(self) -> Dict[str, List[WebSocket]]:
        cleaned = {}
        for email, wss in list(self._active_chats.items()):
            active_wss = [ws for ws in wss if is_websocket_connected(ws)]
            if active_wss:
                cleaned[email] = active_wss
            else:
                self._active_chats.pop(email, None)
        return cleaned

    @property
    def active_laptops(self) -> Dict[str, WebSocket]:
        cleaned = {}
        for email, ws in list(self._active_laptops.items()):
            if is_websocket_connected(ws):
                cleaned[email] = ws
            else:
                self._active_laptops.pop(email, None)
        return cleaned

    async def connect_chat(self, email: str, websocket: WebSocket):
        await websocket.accept()
        if email not in self._active_chats:
            self._active_chats[email] = []
        self._active_chats[email].append(websocket)

    def disconnect_chat(self, email: str, websocket: WebSocket):
        if email in self._active_chats:
            try:
                self._active_chats[email].remove(websocket)
            except ValueError:
                pass
            if not self._active_chats[email]:
                del self._active_chats[email]

    async def connect_laptop(self, email: str, websocket: WebSocket):
        await websocket.accept()
        self._active_laptops[email] = websocket

    def disconnect_laptop(self, email: str):
        if email in self._active_laptops:
            del self._active_laptops[email]

manager = ConnectionManager()

# --- Auth Helper Models ---
class MasterLoginRequest(BaseModel):
    email: EmailStr
    master_key: str

class SaveFavoritesRequest(BaseModel):
    favorites: List[str]

class SaveSettingsProfileRequest(BaseModel):
    settings_profile: dict

# --- Root & Health Endpoints ---
@app.get("/")
def get_root():
    return {"message": "VoxKage Web API operational.", "timestamp": datetime.utcnow().isoformat()}

@app.get("/health")
def health():
    return {"status": "alive", "engine": "VoxKage Web Backend", "timestamp": "2026-06-30"}

@app.post("/auth/master-login")
def master_login(req: MasterLoginRequest):
    """
    Direct developer login using the Master Key, returning a real JWT token.
    """
    expected_master = os.getenv("VOXKAGE_MASTER_KEY", "sir")
    if req.master_key == expected_master:
        token = create_access_token(data={"sub": req.email})
        return {"access_token": token, "token_type": "bearer"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Master Key verification failed."
    )

# --- Sessions REST Endpoints ---
@app.get("/sessions")
def get_sessions(user: str = Depends(get_current_user)):
    return list_sessions(user)

@app.post("/sessions")
def post_session(name: str = "New Chat", user: str = Depends(get_current_user)):
    return create_session(user, name)

@app.get("/sessions/{session_id}")
def get_single_session(session_id: str, user: str = Depends(get_current_user)):
    session = get_session(session_id, user)
    messages = get_session_messages(session_id)
    percent = calculate_context_percent(messages)
    return {"session": session, "messages": messages, "context_percent": percent}

@app.delete("/sessions/{session_id}")
def delete_single_session(session_id: str, user: str = Depends(get_current_user)):
    return delete_session(session_id, user)

@app.put("/sessions/{session_id}/rename")
def rename_session(session_id: str, name: str, user: str = Depends(get_current_user)):
    return update_session_name(session_id, user, name)

@app.put("/sessions/{session_id}/star")
def star_session_endpoint(session_id: str, starred: bool, user: str = Depends(get_current_user)):
    return toggle_session_star(session_id, user, starred)

# --- User Settings REST Endpoints ---
@app.get("/user/favorites")
def get_favorites(user: str = Depends(get_current_user)):
    return {"favorite_models": get_user_favorites(user)}

@app.post("/user/favorites")
def save_favorites(
    req: SaveFavoritesRequest,
    user: str = Depends(get_current_user)
):
    saved_favs = save_user_favorites(user, req.favorites)
    return {"favorite_models": saved_favs}

@app.get("/user/settings-profile")
def get_settings_profile(user: str = Depends(get_current_user)):
    return {"settings_profile": get_user_settings_profile(user)}

@app.post("/user/settings-profile")
def save_settings_profile(
    req: SaveSettingsProfileRequest,
    user: str = Depends(get_current_user)
):
    saved_profile = save_user_settings_profile(user, req.settings_profile)
    return {"settings_profile": saved_profile}

@app.get("/models")
def get_models(user: str = Depends(get_current_user)):
    return list_opencode_models()

# --- WebSocket Chat Streaming ---
async def chat_ws_reader(websocket: WebSocket, receive_queue: asyncio.Queue):
    from opencode_proxy import PROXY_REQUESTS
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload_data = json.loads(data)
                msg_type = payload_data.get("type")
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

@app.websocket("/ws/chat/{session_id}")
async def websocket_chat_endpoint(websocket: WebSocket, session_id: str, token: str = Query(...)):
    from jose import jwt, JWTError
    from auth import SECRET_KEY, ALGORITHM
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user: str = payload.get("sub")
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
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

            # Intercept manual compaction query
            if query == "/compact":
                try:
                    # 1. Log user query "/compact"
                    log_message(session_id, "user", "/compact")
                    
                    # 2. Send "Compacting..." step status start
                    await websocket.send_text(json.dumps({
                        "type": "hud_log",
                        "content": "Compacting..."
                    }))
                    
                    # 3. Call compaction service
                    from compaction import compact_session_history
                    summary = await compact_session_history(
                        session_id=session_id,
                        user_id=user,
                        model_key=model_key,
                        manager_ref=manager,
                        client_websocket=websocket
                    )
                    
                    # 4. Fetch updated messages and calculate new percent
                    messages_history = get_session_messages(session_id)
                    new_percent = calculate_context_percent(messages_history)
                    
                    # 5. Send compaction completion status
                    await websocket.send_text(json.dumps({"type": "tool_success"}))
                    
                    # 6. Stream final compaction summary response to client
                    confirm_header = "\n[Chat history has been successfully compacted.]\n\n**Compaction Summary Brief:**\n"
                    confirm_footer = "\n"
                    
                    # Log assistant response to DB
                    log_message(session_id, "assistant", f"{confirm_header}{summary}{confirm_footer}")
                    
                    # Send token chunk confirmation
                    await websocket.send_text(json.dumps({"type": "token", "content": confirm_header}))
                    await websocket.send_text(json.dumps({"type": "token", "content": summary}))
                    await websocket.send_text(json.dumps({"type": "token", "content": confirm_footer}))
                    
                    # Sync new context percentage
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

            # Log user query to database
            log_message(session_id, "user", query)

            # Instantly kick off dynamic rename in background concurrently
            async def run_smart_rename(sid: str, q: str, m_key: str, uid: str, ws):
                try:
                    db_msgs = get_session_messages(sid)
                    user_msgs = [m for m in db_msgs if m["role"] == "user"]
                    if len(user_msgs) <= 1:
                        from opencode_proxy import query_opencode_proxy
                        from opencode_client import get_opencode_model
                        title_prompt = f"Summarize this query into a short, creative 3-5 word title for a chat thread (do not include quotes or markdown): '{q}'"
                        title_payload = {
                            "model": get_opencode_model(m_key),
                            "messages": [{"role": "user", "content": title_prompt}],
                            "temperature": 0.7
                        }
                        title_chunks = []
                        async for chunk in query_opencode_proxy(
                            payload=title_payload,
                            manager_ref=manager,
                            user_id=uid,
                            client_websocket=ws,
                            timeout=15.0
                        ):
                            if isinstance(chunk, dict):
                                err_msg = chunk.get("content")
                                if err_msg and err_msg.startswith("Error:"):
                                    continue
                                content = chunk.get("content", "")
                                if content:
                                    title_chunks.append(content)
                        generated_title = "".join(title_chunks).strip()
                        for char in ['"', "'", '`', '*', '#']:
                            generated_title = generated_title.replace(char, '')
                        generated_title = generated_title.strip().strip('.')
                        if generated_title:
                            update_session_name(sid, uid, generated_title)
                            if is_websocket_connected(ws):
                                await ws.send_text(json.dumps({"type": "rename", "name": generated_title}))
                except Exception as re_err:
                    print(f"Async Rename failed: {re_err}")

            asyncio.create_task(run_smart_rename(session_id, query, model_key, user, websocket))

            formatted_history = []
            for msg in messages_history:
                formatted_history.append({"role": msg["role"], "content": msg["content"]})

            # Stream response
            full_response = ""
            async_generator = run_agentic_loop(
                prompt=query,
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
                except:
                    pass

            if full_response:
                log_message(session_id, "assistant", full_response)
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

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# --- WebSocket Laptop Daemon Bridge ---
@app.websocket("/ws/laptop")
async def websocket_laptop_endpoint(websocket: WebSocket, token: str = Query(...)):
    from jose import jwt, JWTError
    from auth import SECRET_KEY, ALGORITHM
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
