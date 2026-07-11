import os
import httpx
from datetime import datetime, timedelta
from crypto import encrypt_token, decrypt_token

# --- Gmail is the only supported OAuth provider ---
STATIC_PROVIDERS = {
    "gmail": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "token_url": "https://oauth2.googleapis.com/token",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth"
    }
}

def detect_transport(server_url: str) -> str:
    """Detect transport type based on URL suffix or convention."""
    if not server_url:
        return "streamable_http"
    if server_url.endswith("/sse"):
        return "sse"
    return "streamable_http"

async def introspect_server_tools(server_url: str, access_token: str, transport: str) -> list:
    """Return static tool schemas for Gmail (the only supported provider)."""
    if not server_url:
        return []
    from mcp_servers.gmail.gmail_mcp import GMAIL_TOOLS
    return GMAIL_TOOLS

def save_mcp_connection(user_id: str, provider: str, connection_data: dict):
    """Save connected server data (encrypted tokens, tools list) to settings_profile in Supabase."""
    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(user_id)
    if "mcp_connections" not in profile:
        profile["mcp_connections"] = {}
    profile["mcp_connections"][provider] = connection_data
    save_user_settings_profile(user_id, profile)

def delete_mcp_connection(user_id: str, provider: str):
    """Erase connected server data from settings_profile in Supabase."""
    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(user_id)
    if "mcp_connections" in profile and provider in profile["mcp_connections"]:
        del profile["mcp_connections"][provider]
        save_user_settings_profile(user_id, profile)

async def refresh_oauth_token(provider: str, refresh_token: str, client_id: str = None) -> dict:
    """Refresh expired Gmail access token using OAuth refresh token."""
    cred = STATIC_PROVIDERS["gmail"]
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id or cred["client_id"],
        "client_secret": cred["client_secret"]
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(cred["token_url"], data=payload)
        if res.status_code != 200:
            raise Exception(f"Failed to refresh Gmail token: {res.text}")
        return res.json()

async def get_valid_token(user_id: str, provider: str, connection: dict) -> str:
    """Decrypt token and refresh if within 5 min of expiry (300s buffer)."""
    expires_at_str = connection.get("expires_at")
    access_token = decrypt_token(connection["access_token"])

    if not expires_at_str:
        return access_token

    try:
        expires_at = datetime.fromisoformat(expires_at_str)
        if datetime.utcnow() + timedelta(minutes=5) >= expires_at:
            refresh_token = decrypt_token(connection.get("refresh_token", ""))
            if not refresh_token:
                return access_token

            new_tokens = await refresh_oauth_token(
                provider,
                refresh_token,
                connection.get("client_id")
            )

            access_token = new_tokens["access_token"]
            connection["access_token"] = encrypt_token(access_token)
            expires_in = new_tokens.get("expires_in", 3600)
            connection["expires_at"] = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
            if new_tokens.get("refresh_token"):
                connection["refresh_token"] = encrypt_token(new_tokens["refresh_token"])

            save_mcp_connection(user_id, provider, connection)
    except Exception as e:
        print(f"[-] Token refresh failed for {provider}: {e}")

    return access_token
