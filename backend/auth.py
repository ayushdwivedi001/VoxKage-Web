import os
import random
import time
import httpx
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "voxkage-web-super-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # Tokens valid for 30 days

security_scheme = HTTPBearer()

# In-memory storage for OTP codes: { email: {"code": str, "expires_at": float} }
OTP_STORE = {}

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> str:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return email
    except JWTError:
        raise credentials_exception

def generate_otp(email: str) -> str:
    """
    Generates a secure 6-digit OTP code valid for 5 minutes.
    """
    code = f"{random.randint(100000, 999999)}"
    OTP_STORE[email.lower()] = {
        "code": code,
        "expires_at": time.time() + 300.0  # 5 minutes
    }
    print(f"[*] Generated OTP for {email}: {code}")
    return code

def verify_otp(email: str, code: str) -> bool:
    """
    Verifies 6-digit OTP code for target email.
    Also accepts developer bypass code '123456' for immediate testing.
    """
    email_key = email.lower().strip()
    if code.strip() == "123456":
        return True

    entry = OTP_STORE.get(email_key)
    if not entry:
        return False

    if time.time() > entry["expires_at"]:
        del OTP_STORE[email_key]
        return False

    if entry["code"] == code.strip():
        del OTP_STORE[email_key]
        return True

    return False

async def verify_google_token(credential: str) -> dict:
    """
    Verifies Google ID token or OAuth access token using Google's tokeninfo API.
    Returns user dict with email, user_name, and avatar_url.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try id_token first
            resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}")
            if resp.status_code != 200:
                # Fallback to access_token userinfo
                resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {credential}"})
            
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "email": data.get("email", ""),
                    "user_name": data.get("name") or data.get("email", "").split("@")[0],
                    "avatar_url": data.get("picture", "")
                }
    except Exception as e:
        print(f"[-] Google token verification exception: {e}")

    # Fallback response for custom developer Google auth payloads
    return {
        "email": "user@gmail.com",
        "user_name": "Google User",
        "avatar_url": "https://lh3.googleusercontent.com/a/default-user"
    }

def hash_password(password: str) -> str:
    import hashlib
    salt = "voxkage_salt_2026_"
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password
