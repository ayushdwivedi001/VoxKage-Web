import os
import json
import time
import asyncio
from typing import Dict, List, Optional
from dotenv import load_dotenv
from fastapi import Request, HTTPException
from starlette.websockets import WebSocket, WebSocketState

# Load local environment variables from current backend/.env file BEFORE other imports
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://voxkage.vercel.app,https://voxkage-ai.vercel.app,https://voxkage-web.vercel.app,http://localhost:3000,http://localhost:5173,http://localhost:8081"
).split(",")


async def csrf_origin_validation_middleware(request: Request, call_next):
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        path = request.url.path
        if path.startswith("/auth/"):
            origin = request.headers.get("origin")
            referer = request.headers.get("referer")

            is_allowed = False
            if origin:
                if origin in ALLOWED_ORIGINS:
                    is_allowed = True
            elif referer:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                referer_origin = f"{parsed.scheme}://{parsed.netloc}"
                if referer_origin in ALLOWED_ORIGINS:
                    is_allowed = True
            else:
                is_allowed = True

            if (origin or referer) and not is_allowed:
                raise HTTPException(status_code=403, detail="Forbidden: CSRF Origin/Referer check failed.")

    return await call_next(request)


def estimate_tokens(messages: list) -> int:
    total_chars = 25000  # baseline for system prompt + tools schemas
    for m in messages:
        content = ""
        role = ""
        if isinstance(m, dict):
            content = m.get("content") or ""
            role = m.get("role") or ""
            tool_calls = m.get("tool_calls") or []
            for tc in tool_calls:
                if isinstance(tc, dict):
                    fn = tc.get("function") or {}
                    content += str(fn.get("name", "")) + str(fn.get("arguments", ""))
        elif hasattr(m, "content") and hasattr(m, "role"):
            content = m.content or ""
            role = m.role or ""
        total_chars += len(str(content)) + len(str(role))
    return int(total_chars / 4.0)


def calculate_context_percent(messages: list) -> int:
    tokens = estimate_tokens(messages)
    percent = int((tokens / 1000000) * 100)  # 1M-token baseline context window for all models
    return min(100, max(0, percent))


def is_websocket_connected(ws) -> bool:
    try:
        return ws is not None and ws.client_state == WebSocketState.CONNECTED and ws.application_state == WebSocketState.CONNECTED
    except Exception:
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


async def websocket_heartbeat_loop():
    while True:
        await asyncio.sleep(20)
        # Ping active chats
        for user, wss in list(manager._active_chats.items()):
            for ws in list(wss):
                try:
                    await ws.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    pass
        # Ping active laptops
        for user, ws in list(manager._active_laptops.items()):
            try:
                await ws.send_text(json.dumps({"type": "ping"}))
            except Exception:
                pass


RATE_LIMIT_STORE = {}


def check_rate_limit(key: str, max_attempts: int, window_seconds: int):
    now = time.time()
    attempts = RATE_LIMIT_STORE.get(key, [])
    attempts = [t for t in attempts if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later."
        )
    attempts.append(now)
    RATE_LIMIT_STORE[key] = attempts
