import os
import httpx
from datetime import datetime, timedelta
from crypto import encrypt_token, decrypt_token

# --- Google OAuth Providers ---
STATIC_PROVIDERS = {
    "gmail": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "token_url": "https://oauth2.googleapis.com/token",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth"
    },
    "google_drive": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "token_url": "https://oauth2.googleapis.com/token",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth"
    },
    "google_calendar": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "token_url": "https://oauth2.googleapis.com/token",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth"
    },
    "notion": {
        "client_id": os.getenv("NOTION_CLIENT_ID", ""),
        "client_secret": os.getenv("NOTION_CLIENT_SECRET", ""),
        "token_url": "https://api.notion.com/v1/oauth/token",
        "auth_url": "https://api.notion.com/v1/oauth/authorize"
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
    """Return tool schemas from Gmail (statically) or retrieve them dynamically from a remote MCP server."""
    if not server_url:
        return []
    
    if "gmail" in server_url.lower():
        from mcp_servers.gmail.gmail_mcp import GMAIL_TOOLS
        return GMAIL_TOOLS

    if server_url == "local://google_drive_v3":
        from mcp_servers.google_drive.google_drive_mcp import discover_drive_tools
        return await discover_drive_tools(access_token)

    if server_url == "local://google_calendar_v3":
        from mcp_servers.google_calendar.google_calendar_mcp import discover_calendar_tools
        return await discover_calendar_tools(access_token)

    if "notion" in server_url.lower():
        from mcp_servers.notion.notion_mcp import NOTION_TOOLS
        return NOTION_TOOLS

    # Connect to the remote server and query it dynamically
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        if transport == "sse":
            from mcp.client.sse import sse_client
            from mcp import ClientSession
            
            async with sse_client(server_url, headers=headers) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    res = await session.list_tools()
                    tools_list = []
                    for t in res.tools:
                        tools_list.append({
                            "name": t.name,
                            "description": t.description,
                            "inputSchema": t.inputSchema
                        })
                    return tools_list
        else:
            from mcp.client.streamable_http import streamable_http_client
            from mcp import ClientSession
            import httpx
            
            async_client = httpx.AsyncClient(headers=headers, timeout=15.0)
            async with streamable_http_client(server_url, http_client=async_client) as (read_stream, write_stream, _):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    res = await session.list_tools()
                    tools_list = []
                    for t in res.tools:
                        tools_list.append({
                            "name": t.name,
                            "description": t.description,
                            "inputSchema": t.inputSchema
                        })
                    return tools_list
    except Exception as e:
        print(f"[-] Failed to introspect remote server tools from {server_url}: {e}")
        return []

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
    """Refresh expired access token using OAuth refresh token."""
    cred = STATIC_PROVIDERS.get(provider) or STATIC_PROVIDERS.get("gmail")
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id or cred["client_id"],
        "client_secret": cred["client_secret"]
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(cred["token_url"], data=payload)
        if res.status_code != 200:
            raise Exception(f"Failed to refresh {provider} token: {res.text}")
        return res.json()

async def get_valid_token(user_id: str, provider: str, connection: dict, force_refresh: bool = False) -> str:
    """Decrypt token and refresh if within 5 min of expiry (300s buffer) or if force_refresh is True."""
    expires_at_str = connection.get("expires_at")
    access_token = decrypt_token(connection["access_token"])

    should_refresh = force_refresh
    if not should_refresh and expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
            if datetime.utcnow() + timedelta(minutes=5) >= expires_at:
                should_refresh = True
        except Exception:
            should_refresh = True

    if should_refresh:
        try:
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
            # Ensure existing refresh_token is preserved if new response doesn't rotate it
            elif refresh_token:
                connection["refresh_token"] = encrypt_token(refresh_token)

            connection["auth_status"] = "active"
            connection.pop("error_message", None)
            save_mcp_connection(user_id, provider, connection)
        except Exception as e:
            err_str = str(e)
            print(f"[-] Token refresh failed for {provider}: {err_str}")
            if "invalid_grant" in err_str.lower() or "revoked" in err_str.lower():
                connection["auth_status"] = "expired"
                connection["error_message"] = "OAuth token expired or revoked. Please re-authenticate."
                save_mcp_connection(user_id, provider, connection)

    return access_token
