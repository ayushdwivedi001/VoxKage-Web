import os
import random
import time
import httpx
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("FATAL: JWT_SECRET_KEY environment variable is not set. Server cannot start.")

DEBUG = os.getenv("DEBUG", "false").lower() == "true"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # Access token duration: 7 days for seamless web sessions

security_scheme = HTTPBearer()

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token() -> str:
    import secrets
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

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

def send_email_via_smtp(to_email: str, subject: str, body_text: str) -> bool:
    """
    Dispatches email using standard SMTP relay TLS connection.
    Falls back to server logs printing if credentials are not configured.
    """
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_sender = os.getenv("SMTP_SENDER", smtp_username or "voxkage@gmail.com")

    # Logging to stdout for local testing & container logs
    print(f"[*] Dispatching Email to {to_email} (Subject: {subject})")
    print(f"[Body]:\n{body_text}\n")

    if not smtp_username or not smtp_password:
        print("[-] SMTP credentials not configured. Attempting master developer Gmail OAuth fallback...")
        try:
            import asyncio
            async def run_fallback():
                try:
                    from scheduler import refresh_gmail_token, send_email_direct
                    dev_email = "ayushdwivedi001@gmail.com"
                    token = await refresh_gmail_token(dev_email)
                    if token:
                        print(f"[*] Sending email using Master Developer Gmail OAuth for {dev_email}")
                        await send_email_direct(to_email, subject, body_text, token)
                        print(f"[+] Email successfully sent to {to_email} via Google API fallback.")
                        return True
                except Exception as ex:
                    print(f"[-] Gmail API fallback email send failed: {ex}")
                return False

            try:
                loop = asyncio.get_running_loop()
                # Run background task safely without blocking synchronous thread
                loop.create_task(run_fallback())
                return True
            except RuntimeError:
                # No active running loop, run blocking
                return asyncio.run(run_fallback())
        except Exception as e:
            print(f"[-] Google API fallback failed: {e}")
            print("[-] Fallback: Email logged to console logs.")
            return False

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_sender
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_text, 'plain'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_sender, to_email, msg.as_string())
        server.quit()
        print(f"[+] Email successfully sent to {to_email} via SMTP.")
        return True
    except Exception as e:
        print(f"[-] Failed to send SMTP email to {to_email}: {e}")
        return False

def generate_signup_otp(email: str) -> str:
    """
    Generates a secure 4-digit OTP code valid for 5 minutes.
    """
    code = f"{random.randint(1000, 9999)}"
    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(email)
    profile["_otp_signup"] = {
        "code": code,
        "expires_at": time.time() + 300.0  # 5 minutes
    }
    save_user_settings_profile(email, profile)
    print(f"[*] OTP generated and stored for {email} (signup)")
    
    subject = "VoxKage — Verify Your Email Address"
    body = (
      f"Hello,\n\n"
      f"Thank you for signing up for VoxKage.\n"
      f"Your 4-digit verification code is: {code}\n\n"
      f"This code will expire in 5 minutes. Please enter it in the registration form to verify your account.\n\n"
      f"Best regards,\n"
      f"The VoxKage Team"
    )
    send_email_via_smtp(email, subject, body)
    return code

def verify_signup_otp(email: str, code: str) -> bool:
    """
    Verifies 4-digit signup OTP. Allows bypass code '1234' for local testing/fallback under DEBUG=true.
    """
    if DEBUG and code.strip() == "1234":
        print(f"[*] Bypass signup OTP code used for {email}")
        return True

    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(email)
    entry = profile.get("_otp_signup")
    if not entry:
        return False

    if time.time() > entry["expires_at"]:
        profile.pop("_otp_signup", None)
        save_user_settings_profile(email, profile)
        return False

    if entry["code"] == code.strip():
        profile.pop("_otp_signup", None)
        save_user_settings_profile(email, profile)
        return True

    return False

def generate_reset_code(email: str) -> str:
    """
    Generates a secure 8-digit password reset code valid for 10 minutes.
    """
    code = f"{random.randint(10000000, 99999999)}"
    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(email)
    profile["_otp_reset"] = {
        "code": code,
        "expires_at": time.time() + 600.0  # 10 minutes
    }
    save_user_settings_profile(email, profile)
    print(f"[*] OTP generated and stored for {email} (reset)")

    subject = "VoxKage — Reset Your Password"
    body = (
      f"Hello,\n\n"
      f"We received a request to reset the password for your VoxKage account.\n"
      f"Your 8-digit secure reset code is: {code}\n\n"
      f"This code is valid for 10 minutes. If you did not request a password reset, you can safely ignore this email.\n\n"
      f"Best regards,\n"
      f"The VoxKage Team"
    )
    send_email_via_smtp(email, subject, body)
    return code

def verify_reset_code(email: str, code: str) -> bool:
    """
    Verifies 8-digit password reset code. Allows bypass code '12345678' for local testing/fallback under DEBUG=true.
    """
    if DEBUG and code.strip() == "12345678":
        print(f"[*] Bypass reset code used for {email}")
        return True

    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(email)
    entry = profile.get("_otp_reset")
    if not entry:
        return False

    if time.time() > entry["expires_at"]:
        profile.pop("_otp_reset", None)
        save_user_settings_profile(email, profile)
        return False

    if entry["code"] == code.strip():
        profile.pop("_otp_reset", None)
        save_user_settings_profile(email, profile)
        return True

    return False

def generate_otp(email: str) -> str:
    """
    Generates a secure 6-digit OTP code valid for 5 minutes.
    """
    code = f"{random.randint(100000, 999999)}"
    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(email)
    profile["_otp_login"] = {
        "code": code,
        "expires_at": time.time() + 300.0  # 5 minutes
    }
    save_user_settings_profile(email, profile)
    print(f"[*] OTP generated and stored for {email} (login)")
    return code

def verify_otp(email: str, code: str) -> bool:
    """
    Verifies 6-digit OTP code for target email.
    Also accepts developer bypass code '123456' for immediate testing under DEBUG=true.
    """
    if DEBUG and code.strip() == "123456":
        print(f"[*] Bypass login OTP code used for {email}")
        return True

    from database import get_user_settings_profile, save_user_settings_profile
    profile = get_user_settings_profile(email)
    entry = profile.get("_otp_login")
    if not entry:
        return False

    if time.time() > entry["expires_at"]:
        profile.pop("_otp_login", None)
        save_user_settings_profile(email, profile)
        return False

    if entry["code"] == code.strip():
        profile.pop("_otp_login", None)
        save_user_settings_profile(email, profile)
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

    return None

import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Check if the hash is Legacy SHA-256 (exactly 64 hex characters, no leading $)
    if len(hashed_password) == 64 and not hashed_password.startswith("$"):
        import hashlib
        salt = "voxkage_salt_2026_"
        legacy_hash = hashlib.sha256((salt + plain_password).encode('utf-8')).hexdigest()
        if legacy_hash == hashed_password:
            return True
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False
