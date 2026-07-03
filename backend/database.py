import os
import httpx
import time
from supabase import create_client, Client, ClientOptions
from fastapi import HTTPException
from dotenv import load_dotenv

# Load local environment variables from current backend/.env file
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_client: Client | None = None

def execute_with_retry(builder, retries=3, delay=1.0):
    for attempt in range(retries):
        try:
            return builder.execute()
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(delay)

def get_db() -> Client:
    global _client
    if _client is not None:
        return _client

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase credentials (SUPABASE_URL, SUPABASE_KEY) are not set in backend environment."
        )
    try:
        # Create a custom httpx Client with a 30s timeout and HTTP/2 disabled.
        # This prevents httpcore.RemoteProtocolError on Hugging Face Spaces and read timeouts on cold DB starts.
        custom_client = httpx.Client(http2=False, timeout=30.0)
        options = ClientOptions(httpx_client=custom_client)
        _client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
        return _client
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Supabase: {str(e)}")

# --- Session Management ---
def create_session(user_id: str, name: str = "New Chat") -> dict:
    db = get_db()
    data = {
        "name": name,
        "user_id": user_id
    }
    res = execute_with_retry(db.table("sessions").insert(data))
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create session.")
    return res.data[0]

def list_sessions(user_id: str) -> list:
    db = get_db()
    res = execute_with_retry(db.table("sessions").select("*").eq("user_id", user_id).order("created_at", desc=True))
    return res.data or []

def get_session(session_id: str, user_id: str) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("sessions").select("*").eq("id", session_id).eq("user_id", user_id))
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found.")
    return res.data[0]

def update_session_name(session_id: str, user_id: str, name: str) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("sessions").update({"name": name}).eq("id", session_id).eq("user_id", user_id))
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found or rename failed.")
    return res.data[0]

def delete_session(session_id: str, user_id: str) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("sessions").delete().eq("id", session_id).eq("user_id", user_id))
    return {"status": "success", "deleted_session_id": session_id}

def toggle_session_star(session_id: str, user_id: str, is_starred: bool) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("sessions").update({"is_starred": is_starred}).eq("id", session_id).eq("user_id", user_id))
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found or star toggle failed.")
    return res.data[0]

# --- Messages Management ---
def log_message(session_id: str, role: str, content: str) -> dict:
    db = get_db()
    data = {
        "session_id": session_id,
        "role": role,
        "content": content
    }
    res = execute_with_retry(db.table("messages").insert(data))
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to log message.")
    return res.data[0]

def get_session_messages(session_id: str) -> list:
    db = get_db()
    res = execute_with_retry(db.table("messages").select("*").eq("session_id", session_id).order("timestamp", desc=False))
    return res.data or []

# --- Projects Management (Workspace) ---
def save_playground_project(user_id: str, project_id: str | None, name: str, html: str, css: str, js: str, files: dict | None = None) -> dict:
    db = get_db()
    if not files:
        files = {
            "index.html": html or "",
            "style.css": css or "",
            "script.js": js or ""
        }
    data = {
        "name": name,
        "html": files.get("index.html", html or ""),
        "css": files.get("style.css", css or ""),
        "js": files.get("script.js", js or ""),
        "files": files,
        "user_id": user_id,
        "updated_at": "now()"
    }
    if project_id:
        res = execute_with_retry(db.table("projects").update(data).eq("id", project_id).eq("user_id", user_id))
    else:
        res = execute_with_retry(db.table("projects").insert(data))
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save playground project.")
    return res.data[0]

def list_projects(user_id: str) -> list:
    db = get_db()
    res = execute_with_retry(db.table("projects").select("*").eq("user_id", user_id).order("updated_at", desc=True))
    return res.data or []

def get_project(project_id: str, user_id: str) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("projects").select("*").eq("id", project_id).eq("user_id", user_id))
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found.")
    return res.data[0]

def delete_playground_project(project_id: str, user_id: str) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("projects").delete().eq("id", project_id).eq("user_id", user_id))
    return {"status": "success", "deleted_project_id": project_id}

# --- User Settings (Favorite Models) ---
def get_user_favorites(user_id: str) -> list:
    db = get_db()
    res = execute_with_retry(db.table("user_settings").select("favorite_models").eq("user_id", user_id))
    if not res.data:
        return []
    return res.data[0].get("favorite_models", [])

def save_user_favorites(user_id: str, favorites: list) -> list:
    db = get_db()
    data = {
        "user_id": user_id,
        "favorite_models": favorites,
        "updated_at": "now()"
    }
    res = execute_with_retry(db.table("user_settings").upsert(data))
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save user favorites.")
    return res.data[0].get("favorite_models", [])

# --- User Settings (Settings Profile) ---
def get_user_settings_profile(user_id: str) -> dict:
    db = get_db()
    res = execute_with_retry(db.table("user_settings").select("settings_profile").eq("user_id", user_id))
    if not res.data:
        return {}
    return res.data[0].get("settings_profile") or {}

def save_user_settings_profile(user_id: str, profile: dict) -> dict:
    db = get_db()
    data = {
        "user_id": user_id,
        "settings_profile": profile,
        "updated_at": "now()"
    }
    res = execute_with_retry(db.table("user_settings").upsert(data))
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save user settings profile.")
    return res.data[0].get("settings_profile") or {}
