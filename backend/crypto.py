from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import base64
import hashlib

TOKEN_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")
if not TOKEN_ENCRYPTION_KEY:
    # Safe fallback derived from SUPABASE_KEY so it's unique per deployment but remains stable
    fallback_seed = os.getenv("SUPABASE_KEY", "voxkage_default_fallback_seed_32_bytes_long!")
    TOKEN_ENCRYPTION_KEY = base64.b64encode(hashlib.sha256(fallback_seed.encode()).digest()).decode()

def get_key_bytes() -> bytes:
    try:
        return base64.b64decode(TOKEN_ENCRYPTION_KEY)
    except Exception:
        return hashlib.sha256(TOKEN_ENCRYPTION_KEY.encode()).digest()

def encrypt_token(plaintext: str) -> str:
    if not plaintext:
        return ""
    key = get_key_bytes()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()

def decrypt_token(encrypted: str) -> str:
    if not encrypted:
        return ""
    key = get_key_bytes()
    try:
        data = base64.b64decode(encrypted)
        nonce, ciphertext = data[:12], data[12:]
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, None).decode()
    except Exception as e:
        # Safe fallback if decryption fails
        print(f"[-] Token decryption failed: {e}")
        return ""
