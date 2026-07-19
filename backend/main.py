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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def handle_first_message_rename(session_id: str, query: str, user: str, websocket=None):
    try:
        from database import get_session, update_session_name
        session = get_session(session_id, user)
        if session.get("name") == "New Chat":
            words = [w for w in query.split() if not w.startswith('/')]
            generated_title = " ".join(words[:5])
            if len(words) > 5:
                generated_title += "..."
            for char in ['"', "'", '`', '*', '#', '.', ',']:
                generated_title = generated_title.replace(char, '')
            generated_title = generated_title.strip()
            if not generated_title:
                generated_title = "New Chat"
                
            update_session_name(session_id, user, generated_title)
            
            async def notify_rename(title):
                # Wait 1.5 seconds for UI telemetry socket to connect/stabilize
                await asyncio.sleep(1.5)
                chat_sockets = manager._active_chats.get(user, [])
                for s in chat_sockets:
                    try:
                        if is_websocket_connected(s):
                            await s.send_text(json.dumps({"type": "rename", "name": title}))
                    except:
                        pass
                if websocket:
                    try:
                        if is_websocket_connected(websocket):
                            await websocket.send_text(json.dumps({"type": "rename", "name": title}))
                    except:
                        pass
                        
            asyncio.create_task(notify_rename(generated_title))
    except Exception as e:
        print(f"[-] Heuristic rename failed: {e}")


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
class MasterLoginRequest(BaseModel):
    email: EmailStr
    master_key: str

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

@app.get("/health")
def health():
    return {"status": "alive", "engine": "VoxKage Web Backend", "timestamp": "2026-06-30"}

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
        "selected_model": profile.get("selected_model") or profile.get("selectedModel") or "DeepSeek V4 Flash",
        "selected_variant": profile.get("selected_variant") or profile.get("selectedVariant") or "Max",
        "soul_context": soul_context,
        "mcp_connections": list(connections.keys()),
        "mcp_tools": TOOLS_SCHEMA + mcp_tools,
        "mcp_info": mcp_info,
        "favorites": favorites,
        "models": models
    }

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
    profile = req.settings_profile
    if not isinstance(profile, dict):
        profile = {}
    profile["user_id"] = user
    saved_profile = save_user_settings_profile(user, profile)
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


@app.post("/auth/oauth/callback")
async def oauth_callback(req: OAuthCallbackRequest):
    session = get_and_delete_oauth_session(req.state)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")
        
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
        async with httpx.AsyncClient(timeout=10.0) as client:
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
                raise HTTPException(status_code=400, detail=f"Token exchange failed: {res.text}")
                
            token_data = res.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token", "")
            
            default_expiry = 315360000 if provider == "notion" else 3600
            expires_in = token_data.get("expires_in") or default_expiry

            # Log the granted scopes for debugging
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
            
            # Preserve existing refresh_token if re-authenticating without OAuth prompt consent
            if not encrypted_refresh:
                from database import get_user_settings_profile
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
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

@app.post("/auth/disconnect")
def disconnect_mcp_provider(req: DisconnectRequest, user: str = Depends(get_current_user)):
    from mcp_client import delete_mcp_connection
    delete_mcp_connection(user, req.provider)
    return {"status": "disconnected", "provider": req.provider}



@app.get("/models")

def get_models(user: str = Depends(get_current_user)):
    return list_opencode_models()

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

    # Log user query and handle rename in non-blocking background tasks
    asyncio.create_task(asyncio.to_thread(log_message, session_id, "user", db_content))
    asyncio.create_task(asyncio.to_thread(handle_first_message_rename, session_id, query, user))

    # Retrieve history, soul context, and profile in parallel using asyncio.gather
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
    # Include all previous logs from DB history except the very last user message we just logged (as we will send the enriched version)
    for msg in messages_history[:-1]:
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
            sources_str = "||".join([f"{s['title'].replace('|', '-').replace('<', '').replace('>', '')}|{s['url']}" for s in unique_sources])
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
        
    async def stream_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    "https://opencode.ai/zen/v1/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": authorization
                    },
                    json=body,
                    timeout=60.0
                ) as response:
                    if response.status_code != 200:
                        err_bytes = await response.aread()
                        yield f"data: Error (HTTP {response.status_code}): {err_bytes.decode(errors='ignore')}\n\n".encode()
                        return
                    async for chunk in response.aiter_bytes():
                        yield chunk
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

            # Log user query and handle rename in non-blocking background tasks
            asyncio.create_task(asyncio.to_thread(log_message, session_id, "user", db_content))
            asyncio.create_task(asyncio.to_thread(handle_first_message_rename, session_id, query, user, websocket))

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
