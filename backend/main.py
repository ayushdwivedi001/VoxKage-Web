import os
from dotenv import load_dotenv

# Load local environment variables from current backend/.env file BEFORE other imports
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

import json
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import httpx
import secrets
import hashlib
import base64


from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr

from auth import create_access_token, get_current_user
from database import (
    create_session, list_sessions, get_session, update_session_name, delete_session,
    log_message, get_session_messages, get_user_favorites, save_user_favorites,
    get_user_settings_profile, save_user_settings_profile, toggle_session_star,
    edit_message_and_truncate, log_message_feedback_db, save_oauth_session,
    get_and_delete_oauth_session
)
from opencode_client import list_opencode_models
from agent_loop import run_agentic_loop, LAPTOP_CHANNELS

app = FastAPI(title="VoxKage Web API", version="2026.06.30")

# Ensure uploads folder exists and mount it
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://voxkage.vercel.app,http://localhost:3000,http://localhost:5173,http://localhost:8081").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request

@app.middleware("http")
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
            # Include tool calls arguments length if present
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

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(websocket_heartbeat_loop())
    try:
        from scheduler import start_scheduler
        await start_scheduler()
    except Exception as e:
        print(f"[-] Failed to start background scheduler: {e}")


# --- Auth Helper Models ---
class SendOtpRequest(BaseModel):
    email: EmailStr

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str
    user_name: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: str

class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    redirect_uri: str

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    user_name: str

class LoginPasswordRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    email: EmailStr
    refresh_token: str

class SendSignupOtpRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    user_name: str

class SignUpOtpVerifyRequest(BaseModel):
    email: EmailStr
    password: str
    user_name: str
    otp: str

class SendResetCodeRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str

class SaveFavoritesRequest(BaseModel):
    favorites: List[str]

class SaveSettingsProfileRequest(BaseModel):
    settings_profile: dict

class PreparePayloadRequest(BaseModel):
    message: str
    attachments: Optional[List[dict]] = []
    model: Optional[str] = "deepseek-flash"
    variant: Optional[str] = "High"
    client_time: Optional[str] = None
    skip_tools: Optional[bool] = False

class ExecuteToolsRequest(BaseModel):
    tool_calls: List[dict]

class LogAssistantResponseRequest(BaseModel):
    content: str

class EditMessageRequest(BaseModel):
    new_content: str

class FeedbackRequest(BaseModel):
    feedback_type: str
    comments: Optional[str] = None

class CreateScheduleRequest(BaseModel):
    name: str
    instruction: str
    cron_expression: str
    interval_hours: int
    timezone: str
    retrieval_method: str

class UpdateScheduleRequest(BaseModel):
    name: Optional[str] = None
    instruction: Optional[str] = None
    cron_expression: Optional[str] = None
    interval_hours: Optional[int] = None
    timezone: Optional[str] = None
    retrieval_method: Optional[str] = None
    is_active: Optional[bool] = None



# --- Root & Health Endpoints ---
@app.get("/")
def get_root():
    return {"message": "VoxKage Web API operational.", "timestamp": datetime.utcnow().isoformat()}

@app.get("/user/boot-payload")
async def get_boot_payload(user: str = Depends(get_current_user)):
    from memory_engine import recall_user
    from database import get_user_settings_profile, get_user_favorites
    from opencode_client import list_opencode_models
    import asyncio

    # Run DB queries concurrently
    async def fetch_soul():
        return await asyncio.to_thread(recall_user, user, "")
    async def fetch_profile():
        return await asyncio.to_thread(get_user_settings_profile, user)
    async def fetch_favorites():
        return await asyncio.to_thread(get_user_favorites, user)

    soul_context, profile, favorites = await asyncio.gather(
        fetch_soul(),
        fetch_profile(),
        fetch_favorites()
    )

    # Process MCP tools
    mcp_info = ""
    mcp_tools = []
    connections = profile.get("mcp_connections") or {}
    if connections:
        mcp_info = "\n--- ACTIVE MCP CONNECTIONS ---\n"
        for provider, conn in connections.items():
            if provider == "gmail":
                mcp_info += (
                    "- Gmail is connected and fully authenticated via OAuth.\n"
                    "  You MUST use the 'gmail__search_threads', 'gmail__get_thread', 'gmail__create_draft', 'gmail__list_drafts', and 'gmail__list_labels' tools to access and manage the user's mailbox.\n"
                    "  Do not claim you cannot access emails, do not ask the user for passwords/credentials, and do not suggest opening a browser/laptop client; execute the tools directly.\n"
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

    models = list_opencode_models()
    from tool_schemas import TOOLS_SCHEMA

    return {
        "user_name": profile.get("userName") or profile.get("user_name") or "",
        "avatar_url": profile.get("avatar_url") or profile.get("avatarUrl") or "",
        "custom_proxy_url": profile.get("custom_proxy_url") or profile.get("customProxyUrl") or "",
        "selected_model": profile.get("selected_model") or profile.get("selectedModel") or "DeepSeek V4 Flash",
        "selected_variant": profile.get("selected_variant") or profile.get("selectedVariant") or "Max",
        "theme_mode": profile.get("theme_mode") or "",
        "soul_context": soul_context,
        "mcp_connections": list(connections.keys()),
        "mcp_tools": TOOLS_SCHEMA + mcp_tools,
        "mcp_info": mcp_info,
        "favorites": favorites,
        "models": models
    }


@app.post("/auth/send-otp")
def send_otp_endpoint(req: SendOtpRequest):
    from auth import generate_otp
    code = generate_otp(req.email)
    return {"status": "success", "message": f"OTP sent to {req.email}", "test_otp": code}

@app.post("/auth/verify-otp")
def verify_otp_endpoint(req: VerifyOtpRequest):
    from auth import verify_otp, create_access_token
    from database import get_user_settings_profile, save_user_settings_profile
    
    if not verify_otp(req.email, req.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code."
        )

    # Sync username to profile if provided
    profile = get_user_settings_profile(req.email)
    user_name = req.user_name or profile.get("userName") or profile.get("user_name") or req.email.split("@")[0]
    profile["userName"] = user_name
    profile["user_name"] = user_name
    save_user_settings_profile(req.email, profile)

    token = create_access_token(data={"sub": req.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": req.email,
        "user_name": user_name,
        "avatar_url": profile.get("avatar_url", "")
    }

@app.post("/auth/google")
async def google_auth_endpoint(req: GoogleAuthRequest):
    from auth import verify_google_token, create_access_token
    from database import get_user_settings_profile, save_user_settings_profile
    
    user_data = await verify_google_token(req.credential)
    if not user_data:
        raise HTTPException(status_code=401, detail="Google authentication token verification failed.")
    email = user_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google profile missing email.")

    profile = get_user_settings_profile(email)
    stored_name = profile.get("userName") or profile.get("user_name")
    user_name = stored_name or user_data.get("user_name") or email.split("@")[0]
    
    stored_avatar = profile.get("avatar_url")
    avatar_url = stored_avatar or user_data.get("avatar_url") or ""

    from auth import create_refresh_token, hash_refresh_token
    refresh_token = create_refresh_token()
    
    profile["userName"] = user_name
    profile["user_name"] = user_name
    profile["avatar_url"] = avatar_url
    profile["_refresh_token_hash"] = hash_refresh_token(refresh_token)
    save_user_settings_profile(email, profile)

    token = create_access_token(data={"sub": email})
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "email": email,
        "user_name": user_name,
        "avatar_url": avatar_url
    }

@app.post("/auth/oauth/callback")
async def oauth_callback_endpoint(req: OAuthCallbackRequest):
    import os, httpx
    from datetime import datetime, timedelta
    from auth import create_access_token
    from database import get_user_settings_profile, save_user_settings_profile, get_and_delete_oauth_session

    # 1. Check if this is an MCP connection OAuth session by state
    session = get_and_delete_oauth_session(req.state)
    if session:
        provider = session["provider"]
        code_verifier = session["code_verifier"]
        client_id = session["client_id"]
        server_url = session["server_url"]
        user_id = session["user_id"]
        
        from mcp_client import STATIC_PROVIDERS, detect_transport, introspect_server_tools, save_mcp_connection
        from crypto import encrypt_token
        
        token_url = None
        client_secret = None
        
        if provider in STATIC_PROVIDERS:
            cred = STATIC_PROVIDERS[provider]
            token_url = cred["token_url"]
            client_secret = cred["client_secret"]
        else:
            if provider == "canva":
                token_url = "https://mcp.canva.com/oauth/token"
            elif provider == "notion":
                token_url = "https://api.notion.com/v1/oauth/token"
            else:
                token_url = f"https://mcp.{provider}.com/oauth/token"
                
        payload = {
            "grant_type": "authorization_code",
            "code": req.code,
            "redirect_uri": req.redirect_uri,
            "code_verifier": code_verifier,
            "client_id": client_id
        }
        if client_secret:
            payload["client_secret"] = client_secret
            
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                if provider == "notion":
                    import base64
                    encoded = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
                    headers = {
                        "Authorization": f"Basic {encoded}",
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    }
                    notion_payload = {
                        "grant_type": "authorization_code",
                        "code": req.code,
                        "redirect_uri": req.redirect_uri
                    }
                    res = await client.post(token_url, json=notion_payload, headers=headers)
                else:
                    headers = {"Accept": "application/json"}
                    res = await client.post(token_url, data=payload, headers=headers)

                if res.status_code != 200:
                    err_text = res.text
                    print(f"[-] {provider} token exchange failed ({res.status_code}): {err_text}")
                    raise HTTPException(status_code=400, detail=f"Google token exchange failed: {err_text}" if provider != "notion" else f"Google token exchange failed: {err_text}")
                    
                token_data = res.json()
                access_token = token_data.get("access_token")
                refresh_token = token_data.get("refresh_token", "")
                
                default_expiry = 315360000 if provider == "notion" else 3600
                expires_in = token_data.get("expires_in") or default_expiry
                
                granted_scope = token_data.get("scope", "<not returned>")
                print(f"[*] OAuth token granted scopes for {provider}: {granted_scope}")
                
                expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
                
                encrypted_access = encrypt_token(access_token)
                encrypted_refresh = encrypt_token(refresh_token) if refresh_token else ""
                
                transport = detect_transport(server_url)
                tools = await introspect_server_tools(
                    server_url=server_url,
                    access_token=access_token,
                    transport=transport
                )
                
                if not encrypted_refresh:
                    existing_profile = get_user_settings_profile(user_id)
                    existing_conn = (existing_profile.get("mcp_connections") or {}).get(provider) or {}
                    if existing_conn.get("refresh_token"):
                        encrypted_refresh = existing_conn["refresh_token"]

                connection_data = {
                    "access_token": encrypted_access,
                    "refresh_token": encrypted_refresh,
                    "expires_at": expires_at,
                    "client_id": client_id,
                    "tools": tools,
                    "connected_at": datetime.utcnow().isoformat(),
                    "server_url": server_url,
                    "transport": transport,
                    "auth_status": "active"
                }
                save_mcp_connection(user_id, provider, connection_data)
                
                return {
                    "status": "connected",
                    "provider": provider,
                    "tools_count": len(tools)
                }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

    # 2. Fallback: Google Account Authentication / Login Flow
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth client credentials not configured on backend.")

    async with httpx.AsyncClient(timeout=12.0) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": req.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": req.redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        
        if token_res.status_code != 200:
            err_text = token_res.text
            print(f"[-] Google token exchange failed ({token_res.status_code}): {err_text}")
            raise HTTPException(status_code=400, detail=f"Google token exchange failed: {err_text}")

        token_data = token_res.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="Google did not return access token.")

        # Fetch Google user profile
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user profile.")

        user_info = user_res.json()
        email = user_info.get("email", "").lower().strip()
        google_name = user_info.get("name") or user_info.get("given_name") or email.split("@")[0]
        avatar_url = user_info.get("picture", "")

        if not email:
            raise HTTPException(status_code=400, detail="Google profile missing email.")

        profile = get_user_settings_profile(email)
        
        # Prioritize existing user-configured display name in database
        stored_name = profile.get("userName") or profile.get("user_name")
        user_name = stored_name or google_name
        
        profile["userName"] = user_name
        profile["user_name"] = user_name
        
        # Prioritize existing custom avatar if already set
        stored_avatar = profile.get("avatar_url")
        if not stored_avatar:
            profile["avatar_url"] = avatar_url
        else:
            avatar_url = stored_avatar
        
        from auth import create_refresh_token, hash_refresh_token
        refresh_token = create_refresh_token()
        profile["_refresh_token_hash"] = hash_refresh_token(refresh_token)
        save_user_settings_profile(email, profile)

        jwt_token = create_access_token(data={"sub": email})
        return {
            "access_token": jwt_token,
            "refresh_token": refresh_token,
            "provider": "google",
            "email": email,
            "user_name": user_name,
            "avatar_url": avatar_url,
        }

# --- Lightweight Rate Limiting Store ---
import time
RATE_LIMIT_STORE = {}

def check_rate_limit(key: str, max_attempts: int, window_seconds: int):
    now = time.time()
    attempts = RATE_LIMIT_STORE.get(key, [])
    # Clean up expired timestamps
    attempts = [t for t in attempts if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later."
        )
    attempts.append(now)
    RATE_LIMIT_STORE[key] = attempts

@app.post("/auth/send-signup-otp")
def send_signup_otp_endpoint(req: SendSignupOtpRequest):
    import re
    from auth import generate_signup_otp
    from database import get_db
    
    email = req.email.lower().strip()
    
    # Rate limit check: max 3 attempts per 10 minutes per email
    check_rate_limit(f"signup_otp_{email}", 3, 600)
    
    # Email syntax check
    if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
        raise HTTPException(status_code=400, detail="Invalid email format syntax.")
        
    # Password complexity checks
    password = req.password
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[^a-zA-Z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")
        
    # Confirm password check
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
        
    # Check if email already exists
    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            raise HTTPException(status_code=400, detail="An account with this email address already exists. Please Sign In.")
            
    # Generate and send 4-digit code
    generate_signup_otp(email)
    return {"status": "success", "message": "Verification code sent to your email address."}

@app.post("/auth/signup-verify")
def signup_verify_endpoint(req: SignUpOtpVerifyRequest):
    from auth import verify_signup_otp, hash_password, create_access_token
    from database import get_user_settings_profile, save_user_settings_profile
    
    email = req.email.lower().strip()
    
    # 4-digit code verification
    if not verify_signup_otp(email, req.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
        
    profile = get_user_settings_profile(email)
    profile["password_hash"] = hash_password(req.password)
    profile["userName"] = req.user_name.strip()
    profile["user_name"] = req.user_name.strip()
    profile["avatar_url"] = ""  # No avatar initially
    
    from auth import create_refresh_token, hash_refresh_token
    refresh_token = create_refresh_token()
    profile["_refresh_token_hash"] = hash_refresh_token(refresh_token)
    
    save_user_settings_profile(email, profile)
    
    token = create_access_token(data={"sub": email})
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "email": email,
        "user_name": req.user_name.strip(),
        "avatar_url": ""
    }

@app.post("/auth/send-reset-code")
def send_reset_code_endpoint(req: SendResetCodeRequest):
    from auth import generate_reset_code
    from database import get_db
    
    email = req.email.lower().strip()
    
    # Rate limit check: max 3 attempts per 10 minutes per email
    check_rate_limit(f"reset_code_{email}", 3, 600)
    
    # Check if user exists
    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    user_exists = False
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            user_exists = True
            
    if not user_exists:
        raise HTTPException(status_code=404, detail="No account found with this email address.")
        
    generate_reset_code(email)
    return {"status": "success", "message": "Password reset code sent to your email address."}

@app.post("/auth/reset-password")
def reset_password_endpoint(req: ResetPasswordRequest):
    from auth import verify_reset_code, hash_password
    from database import get_user_settings_profile, save_user_settings_profile
    
    email = req.email.lower().strip()
    
    # Password complexity checks
    import re
    password = req.new_password
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[^a-zA-Z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")
        
    if not verify_reset_code(email, req.reset_code):
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")
        
    profile = get_user_settings_profile(email)
    profile["password_hash"] = hash_password(req.new_password)
    save_user_settings_profile(email, profile)
    
    return {"status": "success", "message": "Password has been reset successfully."}

@app.post("/auth/signup")
def signup_endpoint(req: SignUpRequest):
    from auth import hash_password, create_access_token
    from database import get_db, get_user_settings_profile, save_user_settings_profile
    
    email = req.email.lower().strip()
    
    # Check if email already exists
    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            raise HTTPException(status_code=400, detail="An account with this email address already exists. Please Sign In.")

    # Password complexity checks
    import re
    password = req.password
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[^a-zA-Z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")
        
    profile = get_user_settings_profile(email)
    profile["password_hash"] = hash_password(req.password)
    profile["userName"] = req.user_name.strip()
    profile["user_name"] = req.user_name.strip()
    profile["avatar_url"] = ""
    
    from auth import create_refresh_token, hash_refresh_token
    refresh_token = create_refresh_token()
    profile["_refresh_token_hash"] = hash_refresh_token(refresh_token)
    
    save_user_settings_profile(email, profile)
 
    token = create_access_token(data={"sub": email})
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "email": email,
        "user_name": req.user_name.strip(),
        "avatar_url": ""
    }

@app.post("/auth/login-password")
def login_password_endpoint(req: LoginPasswordRequest):
    from auth import verify_password, create_access_token
    from database import get_db, get_user_settings_profile
    
    email = req.email.lower().strip()
    
    # Rate limit check: max 5 login attempts per 5 minutes per email
    check_rate_limit(f"login_ip_{email}", 5, 300)
    
    # Verify email exists in database
    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    user_exists = False
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            user_exists = True
            
    if not user_exists:
        raise HTTPException(status_code=404, detail="This email address is not registered. Please Sign Up.")
        
    profile = get_user_settings_profile(email)
    stored_hash = profile.get("password_hash")
    
    if not stored_hash:
        raise HTTPException(status_code=401, detail="Invalid password.")
        
    from auth import verify_password, hash_password
    if not verify_password(req.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid password.")
        
    # Transparently upgrade legacy SHA-256 hash to bcrypt in database
    if len(stored_hash) == 64 and not stored_hash.startswith("$"):
        profile["password_hash"] = hash_password(req.password)
        print(f"[+] Transparently upgraded legacy password hash to bcrypt for {email}")

    # Generate and store refresh token
    from auth import create_refresh_token, hash_refresh_token
    refresh_token = create_refresh_token()
    profile["_refresh_token_hash"] = hash_refresh_token(refresh_token)
    
    save_user_settings_profile(email, profile)

    user_name = profile.get("userName") or profile.get("user_name") or email.split("@")[0]
    token = create_access_token(data={"sub": email})
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "email": email,
        "user_name": user_name,
        "avatar_url": profile.get("avatar_url", "")
    }

@app.get("/api/search/images")
async def search_images_endpoint(query: str, limit: int = 24):
    from image_search_engine import search_duckduckgo_images
    return await search_duckduckgo_images(query=query, limit=limit)

@app.get("/api/image-proxy")
async def image_proxy_endpoint(url: str):
    import httpx
    from fastapi.responses import Response
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": url,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/jpeg")
                return Response(content=resp.content, media_type=content_type, headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400"})
    except Exception as e:
        print(f"Image proxy error for {url}: {e}")
        
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)

@app.post("/auth/refresh")
def refresh_token_endpoint(req: RefreshRequest):
    import time
    from auth import create_access_token, create_refresh_token, hash_refresh_token
    from database import get_user_settings_profile, save_user_settings_profile

    email = req.email.lower().strip()
    profile = get_user_settings_profile(email)
    stored_hash = profile.get("_refresh_token_hash")
    prev_hash = profile.get("_prev_refresh_token_hash")
    prev_time = profile.get("_prev_refresh_token_time", 0)
    
    input_hash = hash_refresh_token(req.refresh_token)

    # Allow 60-second grace period for concurrent requests / multi-tab refresh calls
    if prev_hash and input_hash == prev_hash and (time.time() - prev_time) < 60.0:
        new_access_token = create_access_token(data={"sub": email})
        return {
            "access_token": new_access_token,
            "refresh_token": req.refresh_token,
            "token_type": "bearer"
        }

    if not stored_hash or input_hash != stored_hash:
        # Token reuse detected outside 60s grace window! Invalidate session.
        profile.pop("_refresh_token_hash", None)
        profile.pop("_prev_refresh_token_hash", None)
        save_user_settings_profile(email, profile)
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token or token reuse detected."
        )

    # Issue new pair
    new_access_token = create_access_token(data={"sub": email})
    new_refresh_token = create_refresh_token()
    profile["_prev_refresh_token_hash"] = stored_hash
    profile["_prev_refresh_token_time"] = time.time()
    profile["_refresh_token_hash"] = hash_refresh_token(new_refresh_token)
    save_user_settings_profile(email, profile)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

# --- Sessions REST Endpoints ---
@app.get("/sessions")
def get_sessions(user: str = Depends(get_current_user)):
    return list_sessions(user)

@app.post("/sessions")
def post_session(name: str = "New Chat", user: str = Depends(get_current_user)):
    return create_session(user, name)

# --- Schedules REST Endpoints ---
@app.get("/schedules")
def get_user_schedules(user: str = Depends(get_current_user)):
    from database import list_schedules
    return list_schedules(user)

@app.post("/schedules")
def post_schedule(req: CreateScheduleRequest, user: str = Depends(get_current_user)):
    from database import create_schedule
    return create_schedule(
        user_id=user,
        name=req.name,
        instruction=req.instruction,
        cron_expression=req.cron_expression,
        interval_hours=req.interval_hours,
        timezone=req.timezone,
        retrieval_method=req.retrieval_method
    )

@app.put("/schedules/{schedule_id}")
def put_schedule(schedule_id: str, req: UpdateScheduleRequest, user: str = Depends(get_current_user)):
    from database import update_schedule
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    return update_schedule(schedule_id, user, update_data)

@app.delete("/schedules/{schedule_id}")
def delete_user_schedule(schedule_id: str, user: str = Depends(get_current_user)):
    from database import delete_schedule
    return delete_schedule(schedule_id, user)


@app.get("/sessions/{session_id}")
def get_single_session(session_id: str, user: str = Depends(get_current_user)):
    session = get_session(session_id, user)
    messages = get_session_messages(session_id)
    percent = calculate_context_percent(messages)
    return {"session": session, "messages": messages, "context_percent": percent}

@app.post("/sessions/{session_id}/upload")
async def upload_session_file(
    session_id: str,
    file: UploadFile = File(...),
    user: str = Depends(get_current_user)
):
    # Enforce 50MB size limit
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 50MB.")
    
    # Save file locally under uploads/{session_id}/{timestamp}-{filename}
    import time
    import uuid
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    safe_filename = f"{timestamp}-{unique_id}-{file.filename}"
    
    session_dir = os.path.join("uploads", str(session_id))
    os.makedirs(session_dir, exist_ok=True)
    file_path = os.path.join(session_dir, safe_filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    # Calculate pages if it is a PDF
    num_pages = None
    _, ext = os.path.splitext(file.filename.lower())
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            num_pages = len(reader.pages)
        except Exception as e:
            print(f"Error reading PDF page count: {e}")
            
    url = f"/uploads/{session_id}/{safe_filename}"
    
    return {
        "filename": safe_filename,
        "original_name": file.filename,
        "url": url,
        "type": file.content_type or "application/octet-stream",
        "size": size,
        "num_pages": num_pages
    }

@app.delete("/sessions/{session_id}/files/{filename}")
def delete_session_file(session_id: str, filename: str, user: str = Depends(get_current_user)):
    file_path = os.path.join("uploads", str(session_id), filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return {"status": "success", "detail": f"File {filename} deleted."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
    raise HTTPException(status_code=404, detail="File not found.")

@app.post("/sessions/{session_id}/adopt-draft/{draft_id}")
def adopt_draft_files(session_id: str, draft_id: str, user: str = Depends(get_current_user)):
    draft_dir = os.path.join("uploads", str(draft_id))
    session_dir = os.path.join("uploads", str(session_id))
    import shutil
    if os.path.exists(draft_dir):
        os.makedirs(session_dir, exist_ok=True)
        for filename in os.listdir(draft_dir):
            src = os.path.join(draft_dir, filename)
            dst = os.path.join(session_dir, filename)
            if os.path.exists(dst):
                os.remove(dst)
            shutil.move(src, dst)
        try:
            shutil.rmtree(draft_dir)
        except Exception:
            pass
        return {"status": "success", "detail": "Draft files adopted successfully."}
    return {"status": "success", "detail": "No draft files to adopt."}

@app.delete("/sessions/{session_id}")
def delete_single_session(session_id: str, user: str = Depends(get_current_user)):
    res = delete_session(session_id, user)
    
    # Clean up local uploads directory for this session
    import shutil
    session_dir = os.path.join("uploads", str(session_id))
    if os.path.exists(session_dir):
        try:
            shutil.rmtree(session_dir)
            print(f"[+] Cleaned up uploads folder for deleted session: {session_id}")
        except Exception as e:
            print(f"[-] Failed to delete uploads folder: {e}")
            
    return res

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
    profile = get_user_settings_profile(user)
    if not isinstance(profile, dict):
        profile = {}
    profile["user_id"] = user
    return {"settings_profile": profile}

@app.post("/user/settings-profile")
def save_settings_profile(
    req: SaveSettingsProfileRequest,
    user: str = Depends(get_current_user)
):
    from database import get_user_settings_profile
    existing = get_user_settings_profile(user)
    if not isinstance(existing, dict):
        existing = {}
    
    profile = req.settings_profile
    if not isinstance(profile, dict):
        profile = {}
        
    merged = {**existing, **profile}
    merged["user_id"] = user
    saved_profile = save_user_settings_profile(user, merged)
    return {"settings_profile": saved_profile}

# --- MCP Registry REST Endpoints ---
@app.get("/mcp/registry")
def get_mcp_registry(query: Optional[str] = None, user: str = Depends(get_current_user)):
    registry_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcp_registry.json")
    if not os.path.exists(registry_path):
        return {"servers": [], "source": "curated", "total": 0}
    try:
        with open(registry_path, "r", encoding="utf-8") as f:
            servers = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read registry: {str(e)}")

    if query:
        q = query.lower()
        servers = [
            s for s in servers
            if q in s.get("name", "").lower() or q in s.get("description", "").lower() or q in s.get("category", "").lower()
        ]

    return {"servers": servers, "source": "curated", "total": len(servers)}



# --- OAuth Authorization Models & Endpoints ---
class OAuthCallbackRequest(BaseModel):
    code: str
    state: str
    redirect_uri: str

class DisconnectRequest(BaseModel):
    provider: str

class RefreshMCPRequest(BaseModel):
    provider: str

@app.get("/auth/oauth/authorize-url")
async def get_authorize_url(provider: str, user_id: str, redirect_uri: str):
    """Build OAuth 2.0 authorization URL for Gmail, Google Drive, Google Calendar, or Notion."""
    if provider not in ("gmail", "google_drive", "google_calendar", "notion"):
        raise HTTPException(status_code=400, detail="Only gmail, google_drive, google_calendar, and notion are supported as external providers.")

    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip("=")

    from mcp_client import STATIC_PROVIDERS
    cred = STATIC_PROVIDERS[provider]
    client_id = cred["client_id"]
    auth_endpoint = cred["auth_url"]

    # Choose scopes and server URL based on provider
    if provider == "gmail":
        scope = "https://www.googleapis.com/auth/gmail.modify"
        server_url = "https://gmailmcp.googleapis.com/mcp/v1"
    elif provider == "google_drive":
        scope = (
            "https://www.googleapis.com/auth/drive.readonly "
            "https://www.googleapis.com/auth/drive.file"
        )
        server_url = "local://google_drive_v3"
    elif provider == "google_calendar":
        scope = "https://www.googleapis.com/auth/calendar"
        server_url = "local://google_calendar_v3"
    elif provider == "notion":
        scope = ""
        server_url = "https://mcp.notion.com/mcp"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'.")

    from urllib.parse import urlencode

    params = {
        "response_type": "code",
        "client_id": client_id,
        "state": state,
        "redirect_uri": redirect_uri
    }

    if provider == "notion":
        params["owner"] = "user"
    else:
        params["scope"] = scope
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = "S256"
        params["access_type"] = "offline"
        params["prompt"] = "consent"

    auth_url = f"{auth_endpoint}?{urlencode(params)}"

    save_oauth_session(
        state=state,
        code_verifier=code_verifier,
        user_id=user_id,
        provider=provider,
        client_id=client_id,
        server_url=server_url
    )

    return {"url": auth_url}


@app.post("/auth/mcp/refresh")
async def refresh_mcp_tools(req: RefreshMCPRequest, user: str = Depends(get_current_user)):
    """Refresh the list of tools for a connected MCP provider by fetching them dynamically."""
    from database import get_user_settings_profile
    from mcp_client import get_valid_token, introspect_server_tools, save_mcp_connection
    
    profile = get_user_settings_profile(user)
    connections = profile.get("mcp_connections") or {}
    conn = connections.get(req.provider)
    if not conn:
        raise HTTPException(status_code=400, detail=f"Connection for provider '{req.provider}' not found.")
        
    try:
        access_token = await get_valid_token(user, req.provider, conn)
        server_url = conn.get("server_url")
        if not server_url:
            raise Exception("Server URL not found in connection data.")
            
        from mcp_client import detect_transport
        transport = detect_transport(server_url)
        
        tools = await introspect_server_tools(
            server_url=server_url,
            access_token=access_token,
            transport=transport
        )
        
        conn["tools"] = tools
        save_mcp_connection(user, req.provider, conn)
        
        return {
            "status": "success",
            "provider": req.provider,
            "tools_count": len(tools)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh tools: {str(e)}")




@app.post("/auth/disconnect")
def disconnect_mcp_provider(req: DisconnectRequest, user: str = Depends(get_current_user)):
    from mcp_client import delete_mcp_connection
    delete_mcp_connection(user, req.provider)
    return {"status": "disconnected", "provider": req.provider}



@app.get("/models")
def get_models(user: str = Depends(get_current_user)):
    return list_opencode_models()

@app.get("/models/kilo")
async def get_kilo_models_endpoint(kilo_api_key: str = Query(None), user: str = Depends(get_current_user)):
    from kilo_client import fetch_kilo_models
    if not kilo_api_key:
        return []
    return await fetch_kilo_models(kilo_api_key)

# --- Client-Side Agent Loop Endpoints ---

@app.post("/sessions/{session_id}/prepare")
async def prepare_agent_payload(
    session_id: str,
    req: PreparePayloadRequest,
    user: str = Depends(get_current_user)
):
    from opencode_client import get_opencode_model, sanitize_history_roles, get_system_prompt
    from memory_engine import recall_user
    
    # 1. Handle user query and extract text from attachments
    query = req.message.strip()
    enriched_query_parts = []
    
    for att in req.attachments:
        fn = att.get("filename")
        on = att.get("original_name")
        file_path = os.path.join("uploads", str(session_id), fn)
        if not os.path.exists(file_path):
            file_path = os.path.join("uploads", fn)
        if os.path.exists(file_path):
            try:
                from rag_parser import extract_text_async
                extracted_text = await extract_text_async(file_path, model=req.model)
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

    # Format database content with XML attachments tags
    db_content = query
    if req.attachments:
        attachments_xml_parts = ["<attachments>"]
        for att in req.attachments:
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

    # Retrieve history, soul context, and profile in parallel using asyncio.gather first
    async def fetch_history():
        return await asyncio.to_thread(get_session_messages, session_id)

    async def fetch_soul():
        return await asyncio.to_thread(recall_user, user, "")

    async def fetch_profile():
        from database import get_user_settings_profile
        return await asyncio.to_thread(get_user_settings_profile, user)

    messages_history, soul_context, profile = await asyncio.gather(
        fetch_history(),
        fetch_soul(),
        fetch_profile()
    )

    # Log user query asynchronously in the background AFTER retrieving history (avoids race condition)
    asyncio.create_task(asyncio.to_thread(log_message, session_id, "user", db_content))

    current_time_str = req.client_time or datetime.now().strftime("%A, %B %d, %Y, %I:%M:%S %p")

    system_prompt = get_system_prompt()
    
    # Check connected MCP providers
    mcp_info = ""
    mcp_tools = []
    if profile:
        try:
            connections = profile.get("mcp_connections") or {}
            print(f"[*] /prepare user: {user}, active mcp connections: {list(connections.keys())}")
            if connections:
                mcp_info = "\n--- ACTIVE MCP CONNECTIONS ---\n"
                for provider, conn in connections.items():
                    if provider == "gmail":
                        mcp_info += (
                            "- Gmail is connected and fully authenticated via OAuth.\n"
                            "  You MUST use the 'gmail__search_threads', 'gmail__get_thread', 'gmail__create_draft', 'gmail__list_drafts', and 'gmail__list_labels' tools to access and manage the user's mailbox.\n"
                            "  Do not claim you cannot access emails, do not ask the user for passwords/credentials, and do not suggest opening a browser/laptop client; execute the tools directly.\n"
                        )
                        from mcp_servers.gmail.gmail_mcp import GMAIL_TOOLS
                        tools_list = GMAIL_TOOLS
                    else:
                        mcp_info += f"- {provider.title()} is connected.\n"
                        tools_list = conn.get("tools") or []
                    
                    if not req.skip_tools:
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
            print(f"[-] Failed to get MCP info/tools for /prepare: {e}")

    system_prompt += (
        f"\n\n--- DYNAMIC SESSION CONTEXT ---\n"
        f"The current local date and time is {current_time_str}. Use this exact timestamp when answering any queries. Never guess the time.\n"
        f"{mcp_info}"
        f"--- USER SOUL PROFILE MEMORIES ---\n{soul_context}\n\n"
    )

    messages = [{"role": "system", "content": system_prompt}]
    formatted_history = []
    # Include all previous logs from DB history in full
    for msg in messages_history:
        formatted_history.append({"role": msg["role"], "content": msg["content"]})
        
    for msg in sanitize_history_roles(formatted_history):
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    # Append the current enriched query
    messages.append({"role": "user", "content": model_query})

    model_id = get_opencode_model(req.model)
    from agent_loop import get_variant_overrides
    from tool_schemas import TOOLS_SCHEMA
    
    # Return everything needed by the browser client
    return {
        "model": model_id,
        "messages": messages,
        "tools": None if req.skip_tools else (TOOLS_SCHEMA + mcp_tools),
        "variant_overrides": get_variant_overrides(req.variant)
    }

@app.post("/sessions/{session_id}/execute-tools")
async def execute_agent_tools(
    session_id: str,
    req: ExecuteToolsRequest,
    user: str = Depends(get_current_user)
):
    from agent_loop import execute_tool_call_v2
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
            user_id=user,
            session_id=session_id,
            client_websocket=None,
            manager_ref=manager,
            client_time=datetime.now().isoformat(),
            model_key="deepseek-flash",
            tool_context=tool_context
        ) for tc in req.tool_calls
    ]
    
    results = await asyncio.gather(*tasks)
    
    response_list = []
    for tc_id, out, success in results:
        response_list.append({
            "role": "tool",
            "tool_call_id": tc_id,
            "content": out
        })
        
    # Extra tags context if any map, chart, weather etc tags were generated
    consulted_sources = tool_context.get("consulted_sources") or []
    web_search_called = tool_context.get("web_search_called") or False
    sources_tag = None
    if web_search_called or consulted_sources:
        if not consulted_sources:
            consulted_sources.append({"title": "Google Search", "url": "https://www.google.com"})
        seen_urls = set()
        unique_sources = []
        for s in consulted_sources:
            if s.get("url") and s["url"] not in seen_urls:
                seen_urls.add(s["url"])
                unique_sources.append(s)
        if unique_sources:
            sources_parts = []
            for s in unique_sources:
                t_clean = str(s.get("title", "")).replace("|", "-").replace("<", "").replace(">", "").replace('"', '&quot;')
                u_clean = str(s.get("url", "")).replace("|", "%7C").replace('"', '&quot;')
                snip_clean = str(s.get("snippet", "empty")).replace("|", "-").replace("<", "").replace(">", "").replace('"', '&quot;').replace("\n", " ")
                sources_parts.append(f"{t_clean}|{u_clean}|{snip_clean}")
            sources_str = "||".join(sources_parts)
            sources_tag = f'<Sources data="{sources_str}" />'

    tags = {
        "map_tag": tool_context.get("map_tag"),
        "weather_tag": tool_context.get("weather_tag"),
        "chart_tag": tool_context.get("chart_tag"),
        "flow_tag": tool_context.get("flow_tag"),
        "chemistry_tag": tool_context.get("chemistry_tag"),
        "timeline_tag": tool_context.get("timeline_tag"),
        "calculator_tag": tool_context.get("calculator_tag"),
        "sources_tag": sources_tag
    }
    
    return {
        "results": response_list,
        "tags": tags
    }

@app.post("/completions/proxy")
async def completions_proxy(
    body: dict,
    authorization: Optional[str] = Header(None)
):
    import httpx
    from fastapi.responses import StreamingResponse
    
    if not authorization:
        raise HTTPException(status_code=400, detail="Missing Authorization header")
        
    is_kilo = False
    model_str = body.get("model", "")
    if "/" in model_str or "kilo" in model_str.lower() or authorization.startswith("Bearer eyJ"):
        is_kilo = True

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            try:
                # 1. Map target URL
                url = "https://api.kilo.ai/api/gateway/chat/completions" if is_kilo else "https://opencode.ai/zen/v1/chat/completions"
                # Strip models prefix if it was passed with kilo-auto/ or similar prefix
                
                # 2. Query with retries for resilience
                last_err = ""
                for attempt in range(3):
                    try:
                        async with client.stream(
                            "POST",
                            url,
                            headers={
                                "Content-Type": "application/json",
                                "Authorization": authorization
                            },
                            json=body,
                            timeout=60.0
                        ) as response:
                            if response.status_code == 200:
                                async for chunk in response.aiter_bytes():
                                    yield chunk
                                return
                            else:
                                err_bytes = await response.aread()
                                last_err = f"HTTP {response.status_code}: {err_bytes.decode(errors='ignore')}"
                                if response.status_code == 429:
                                    await asyncio.sleep(2.0)
                    except Exception as e:
                        last_err = str(e)
                        await asyncio.sleep(2.0)
                
                yield f"data: Error (Proxy Retry Failure): {last_err}\n\n".encode()
            except Exception as e:
                yield f"data: Error (Proxy Exception): {str(e)}\n\n".encode()

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@app.post("/sessions/{session_id}/log")
async def log_agent_response(
    session_id: str,
    req: LogAssistantResponseRequest,
    user: str = Depends(get_current_user)
):
    asyncio.create_task(asyncio.to_thread(log_message, session_id, "assistant", req.content))
    return {"status": "success"}

@app.post("/sessions/{session_id}/compact")
async def compact_session_endpoint(
    session_id: str,
    body: dict = {},
    user: str = Depends(get_current_user)
):
    from compaction import compact_session_history
    model_key = body.get("model", "deepseek-flash")
    
    # Log user query "/compact"
    log_message(session_id, "user", "/compact")
    
    summary = await compact_session_history(
        session_id=session_id,
        user_id=user,
        model_key=model_key,
        manager_ref=manager,
        client_websocket=None
    )
    
    confirm_header = "\n[Chat history has been successfully compacted.]\n\n**Compaction Summary Brief:**\n"
    confirm_footer = "\n"
    full_compact_msg = f"{confirm_header}{summary}{confirm_footer}"
    
    # Log assistant response to DB
    log_message(session_id, "assistant", full_compact_msg)
    
    latest_msgs = get_session_messages(session_id)
    new_percent = calculate_context_percent(latest_msgs)
    
    return {
        "summary": summary,
        "full_message": full_compact_msg,
        "messages": latest_msgs,
        "context_percent": new_percent
    }

@app.put("/sessions/{session_id}/messages/{message_id}/edit")
def edit_session_message(
    session_id: str,
    message_id: str,
    req: EditMessageRequest,
    user: str = Depends(get_current_user)
):
    return edit_message_and_truncate(session_id, message_id, req.new_content)

@app.post("/sessions/{session_id}/messages/{message_id}/feedback")
def log_message_feedback(
    session_id: str,
    message_id: str,
    req: FeedbackRequest,
    user: str = Depends(get_current_user)
):
    return log_message_feedback_db(session_id, message_id, req.feedback_type, req.comments)


# --- WebSocket Chat Streaming ---
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

    # Verify session ownership before establishing connection
    from database import get_session
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
                    
                    full_compact_msg = f"{confirm_header}{summary}{confirm_footer}"
                    # Log assistant response to DB
                    log_message(session_id, "assistant", full_compact_msg)
                    
                    # Send token chunk confirmation
                    await websocket.send_text(json.dumps({"type": "token", "content": confirm_header}))
                    await websocket.send_text(json.dumps({"type": "token", "content": summary}))
                    await websocket.send_text(json.dumps({"type": "token", "content": confirm_footer}))
                    
                    # Sync new context percentage and emit updated full message list
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

            # Parse attachments and construct enriched prompt

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

            # Format database content with XML attachments tags
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

            # Log user query synchronously as the first step
            asyncio.create_task(asyncio.to_thread(log_message, session_id, "user", db_content))

            formatted_history = []
            for msg in messages_history:
                formatted_history.append({"role": msg["role"], "content": msg["content"]})

            # Stream response
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
                except:
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

@app.get("/health")
def health_check():
    from database import get_db
    try:
        get_db().table("user_settings").select("user_id").limit(1).execute()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "alive", "database": db_status, "engine": "VoxKage Web Backend"}

# NOTE: There is also a /health endpoint at line 293 that is superseded by this one.

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
