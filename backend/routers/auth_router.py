import os
import re
import secrets
import hashlib
import base64
import httpx
import threading
from datetime import datetime, timedelta
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, status, Query

from auth import (
    create_access_token, get_current_user, generate_otp, verify_otp,
    verify_google_token, create_refresh_token, hash_refresh_token,
    generate_signup_otp_code_only, send_email_otp_async, verify_signup_otp,
    hash_password, generate_reset_code_only, verify_reset_code, verify_password
)
from database import (
    get_user_settings_profile, save_user_settings_profile, get_db,
    save_oauth_session, get_and_delete_oauth_session
)
from config import check_rate_limit
from models_schemas import (
    SendOtpRequest, VerifyOtpRequest, GoogleAuthRequest, OAuthCallbackRequest,
    SendSignupOtpRequest, SignUpOtpVerifyRequest, SendResetCodeRequest,
    ResetPasswordRequest, SignUpRequest, LoginPasswordRequest, RefreshRequest,
    RefreshMCPRequest, DisconnectRequest
)

router = APIRouter(tags=["auth"])


@router.post("/auth/send-otp")
def send_otp_endpoint(req: SendOtpRequest):
    code = generate_otp(req.email)
    return {"status": "success", "message": f"OTP sent to {req.email}", "test_otp": code}


@router.post("/auth/verify-otp")
def verify_otp_endpoint(req: VerifyOtpRequest):
    if not verify_otp(req.email, req.otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code."
        )

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


@router.post("/auth/google")
async def google_auth_endpoint(req: GoogleAuthRequest):
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


@router.post("/auth/oauth/callback")
async def oauth_callback_endpoint(req: OAuthCallbackRequest):
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
                    raise HTTPException(status_code=400, detail=f"{provider.capitalize()} token exchange failed: {err_text}")

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

        stored_name = profile.get("userName") or profile.get("user_name")
        user_name = stored_name or google_name

        profile["userName"] = user_name
        profile["user_name"] = user_name

        stored_avatar = profile.get("avatar_url")
        if not stored_avatar:
            profile["avatar_url"] = avatar_url
        else:
            avatar_url = stored_avatar

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


@router.post("/auth/send-signup-otp")
def send_signup_otp_endpoint(req: SendSignupOtpRequest):
    email = req.email.lower().strip()

    check_rate_limit(f"signup_otp_{email}", 3, 600)

    if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
        raise HTTPException(status_code=400, detail="Invalid email format syntax.")

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

    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            raise HTTPException(status_code=400, detail="An account with this email address already exists. Please Sign In.")

    code = generate_signup_otp_code_only(email)
    thread = threading.Thread(target=send_email_otp_async, args=(email, code, "signup"), daemon=True)
    thread.start()
    return {"status": "success", "message": "Verification code sent to your email address."}


@router.post("/auth/signup-verify")
def signup_verify_endpoint(req: SignUpOtpVerifyRequest):
    email = req.email.lower().strip()

    if not verify_signup_otp(email, req.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    profile = get_user_settings_profile(email)
    profile["password_hash"] = hash_password(req.password)
    profile["userName"] = req.user_name.strip()
    profile["user_name"] = req.user_name.strip()
    profile["avatar_url"] = ""

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


@router.post("/auth/send-reset-code")
def send_reset_code_endpoint(req: SendResetCodeRequest):
    email = req.email.lower().strip()

    check_rate_limit(f"reset_code_{email}", 3, 600)

    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    user_exists = False
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            user_exists = True

    if not user_exists:
        raise HTTPException(status_code=404, detail="No account found with this email address.")

    code = generate_reset_code_only(email)
    thread = threading.Thread(target=send_email_otp_async, args=(email, code, "reset"), daemon=True)
    thread.start()
    return {"status": "success", "message": "Password reset code sent to your email address."}


@router.post("/auth/reset-password")
def reset_password_endpoint(req: ResetPasswordRequest):
    email = req.email.lower().strip()

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


@router.post("/auth/signup")
def signup_endpoint(req: SignUpRequest):
    email = req.email.lower().strip()

    db = get_db()
    res = db.table("user_settings").select("settings_profile").eq("user_id", email).execute()
    if res.data:
        profile = res.data[0].get("settings_profile") or {}
        if "password_hash" in profile or "user_name" in profile:
            raise HTTPException(status_code=400, detail="An account with this email address already exists. Please Sign In.")

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


@router.post("/auth/login-password")
def login_password_endpoint(req: LoginPasswordRequest):
    email = req.email.lower().strip()

    check_rate_limit(f"login_ip_{email}", 5, 300)

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

    if not verify_password(req.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid password.")

    if len(stored_hash) == 64 and not stored_hash.startswith("$"):
        profile["password_hash"] = hash_password(req.password)
        print(f"[+] Transparently upgraded legacy password hash to bcrypt for {email}")

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


@router.post("/auth/refresh")
def refresh_token_endpoint(req: RefreshRequest):
    import time
    email = req.email.lower().strip()
    profile = get_user_settings_profile(email)
    stored_hash = profile.get("_refresh_token_hash")
    prev_hash = profile.get("_prev_refresh_token_hash")
    prev_time = profile.get("_prev_refresh_token_time", 0)

    input_hash = hash_refresh_token(req.refresh_token)

    if prev_hash and input_hash == prev_hash and (time.time() - prev_time) < 60.0:
        new_access_token = create_access_token(data={"sub": email})
        return {
            "access_token": new_access_token,
            "refresh_token": req.refresh_token,
            "token_type": "bearer"
        }

    if not stored_hash or input_hash != stored_hash:
        profile.pop("_refresh_token_hash", None)
        profile.pop("_prev_refresh_token_hash", None)
        save_user_settings_profile(email, profile)
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token or token reuse detected."
        )

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


@router.get("/auth/oauth/authorize-url")
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


@router.post("/auth/mcp/refresh")
async def refresh_mcp_tools(req: RefreshMCPRequest, user: str = Depends(get_current_user)):
    """Refresh the list of tools for a connected MCP provider by fetching them dynamically."""
    profile = get_user_settings_profile(user)
    connections = profile.get("mcp_connections") or {}
    conn = connections.get(req.provider)
    if not conn:
        raise HTTPException(status_code=400, detail=f"Connection for provider '{req.provider}' not found.")

    try:
        if req.provider in ("microsoft_word", "word"):
            from word_mcp import WORD_TOOLS
            tools = WORD_TOOLS
        else:
            from mcp_client import get_valid_token, introspect_server_tools, detect_transport
            access_token = await get_valid_token(user, req.provider, conn)
            server_url = conn.get("server_url")
            if not server_url:
                raise Exception("Server URL not found in connection data.")

            transport = detect_transport(server_url)

            tools = await introspect_server_tools(
                server_url=server_url,
                access_token=access_token,
                transport=transport
            )

        conn["tools"] = tools
        from mcp_client import save_mcp_connection
        save_mcp_connection(user, req.provider, conn)

        return {
            "status": "success",
            "provider": req.provider,
            "tools_count": len(tools)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh tools: {str(e)}")


@router.post("/auth/disconnect")
def disconnect_mcp_provider(req: DisconnectRequest, user: str = Depends(get_current_user)):
    from mcp_client import delete_mcp_connection
    try:
        delete_mcp_connection(user, req.provider)
    except Exception:
        pass

    try:
        profile = get_user_settings_profile(user)
        mcp_conns = profile.get("mcp_connections", {})
        if req.provider in mcp_conns:
            delete_key = req.provider
            del mcp_conns[delete_key]
            profile["mcp_connections"] = mcp_conns
            save_user_settings_profile(user, profile)
    except Exception:
        pass

    return {"status": "disconnected", "provider": req.provider}
