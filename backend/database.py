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

def edit_message_and_truncate(session_id: str, message_id: str, new_content: str) -> dict:
    import re
    import uuid as _uuid
    db = get_db()

    # --- Resolve client IDs to real DB UUIDs ---
    # Frontend generates IDs like "user-1783042764666" or "assistant-1783042764666".
    # Supabase messages.id is a UUID — we must resolve to real UUID first.
    real_message_id = message_id
    is_client_id = False
    try:
        _uuid.UUID(message_id)  # will throw if not a valid UUID
    except (ValueError, AttributeError):
        is_client_id = True

    if is_client_id:
        # Extract embedded timestamp from "user-TIMESTAMP" or "assistant-TIMESTAMP"
        ts_match = re.search(r'-(\d{10,15})$', message_id)
        if not ts_match:
            raise HTTPException(status_code=400, detail=f"Cannot resolve message_id to a database record: {message_id}")
        
        ts_ms = int(ts_match.group(1))
        # Determine role from prefix
        role = "user" if message_id.startswith("user-") else "assistant"
        
        # Query all messages in this session with matching role, ordered by timestamp
        all_msgs_res = execute_with_retry(
            db.table("messages")
            .select("id, timestamp, role")
            .eq("session_id", session_id)
            .eq("role", role)
            .order("timestamp", desc=False)
        )
        if not all_msgs_res.data:
            raise HTTPException(status_code=404, detail=f"No {role} messages found in session to resolve against.")
        
        # Find the message whose timestamp is closest to ts_ms
        from datetime import datetime, timezone, timedelta
        target_dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
        
        best_match = None
        best_diff = None
        for m in all_msgs_res.data:
            try:
                # Supabase timestamps are ISO8601 strings
                raw_ts = m["timestamp"]
                if raw_ts.endswith("+00:00"):
                    msg_dt = datetime.fromisoformat(raw_ts)
                else:
                    msg_dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
                diff = abs((msg_dt - target_dt).total_seconds())
                if best_diff is None or diff < best_diff:
                    best_diff = diff
                    best_match = m
            except Exception:
                continue
        
        if not best_match or best_diff > 300:  # 5-minute tolerance
            raise HTTPException(status_code=404, detail=f"Could not find matching DB message for client ID: {message_id}")
        
        real_message_id = best_match["id"]
        print(f"[+] Resolved client ID '{message_id}' → DB UUID '{real_message_id}' (diff: {best_diff:.1f}s)")

    # 1. Retrieve target message to get its timestamp
    res = execute_with_retry(db.table("messages").select("*").eq("id", real_message_id).eq("session_id", session_id))
    if not res.data:
        raise HTTPException(status_code=404, detail="Message not found.")
    target_msg = res.data[0]
    target_timestamp = target_msg["timestamp"]

    # 2. Find and delete files of any messages that will be truncated
    later_res = execute_with_retry(
        db.table("messages")
        .select("content")
        .eq("session_id", session_id)
        .gt("timestamp", target_timestamp)
    )
    
    files_to_delete = []
    if later_res.data:
        for msg in later_res.data:
            content = msg.get("content") or ""
            if "<attachments>" in content:
                try:
                    filenames = re.findall(r'filename="([^"]+)"', content)
                    files_to_delete.extend(filenames)
                except Exception as e:
                    print(f"Error parsing filenames for deletion: {e}")

    for fn in files_to_delete:
        file_path = os.path.join("uploads", str(session_id), fn)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"[+] Deleted orphaned file: {file_path}")
            except Exception as e:
                print(f"[-] Failed to delete orphaned file {file_path}: {e}")

    # 3. Truncate subsequent messages in database
    execute_with_retry(
        db.table("messages")
        .delete()
        .eq("session_id", session_id)
        .gt("timestamp", target_timestamp)
    )

    # 4. Update the target message's content
    update_res = execute_with_retry(
        db.table("messages")
        .update({"content": new_content})
        .eq("id", real_message_id)
        .eq("session_id", session_id)
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to update message.")
    return update_res.data[0]


def log_message_feedback_db(session_id: str, message_id: str, feedback_type: str, comments: str | None) -> dict:
    db = get_db()
    data = {
        "message_id": message_id,
        "session_id": session_id,
        "feedback_type": feedback_type,
        "comments": comments
    }
    res = execute_with_retry(db.table("feedback").insert(data))
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to log feedback.")
    return res.data[0]

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
