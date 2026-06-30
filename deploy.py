import os
import sys
import socket

# Force IPv4 to bypass Jio/Airtel IPv6 SNI connection resets when talking to huggingface.co
orig_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda host, port, family=0, *args, **kwargs: orig_getaddrinfo(host, port, socket.AF_INET, *args, **kwargs)

from huggingface_hub import HfApi

# Try loading from backend/.env
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        print(f"[*] Warning: .env file not found at {env_path}")
except ImportError:
    pass

HF_TOKEN = os.getenv("HF_TOKEN")
SPACE_REPO_ID = "ShinAyush/voxkage-web-backend"
DATASET_REPO_ID = "ShinAyush/voxkage-web-dataset"

def parse_env_file(filepath):
    """Parses key-value pairs from a .env file."""
    variables = {}
    if not os.path.exists(filepath):
        return variables
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                variables[key.strip()] = val.strip()
    return variables

def run_deployment():
    print(f"[*] Initializing deployment to Hugging Face, sir...")
    
    if not HF_TOKEN:
        print("[-] Error: HF_TOKEN environment key is missing. Please set it in backend/.env or your environment.")
        sys.exit(1)
        
    api = HfApi(token=HF_TOKEN)
    
    # 1. Ensure HF Space exists
    try:
        print(f"[*] Verifying/Creating HF Space: {SPACE_REPO_ID} (Docker SDK, Public)...")
        # Keep space public to ensure WebSocket connectivity for frontend clients
        api.create_repo(
            repo_id=SPACE_REPO_ID,
            repo_type="space",
            space_sdk="docker",
            private=False,
            exist_ok=True
        )
        # Ensure it is set to public (if it was previously created as private)
        api.update_repo_settings(
            repo_id=SPACE_REPO_ID,
            repo_type="space",
            private=False
        )
        print(f"[+] Space repository verified/created and set to public.")
    except Exception as e:
        print(f"[-] Warning: Failed to verify/create Space repo: {e}")

    # 2. Ensure HF Dataset exists
    try:
        print(f"[*] Verifying/Creating HF Dataset: {DATASET_REPO_ID} (Private)...")
        api.create_repo(
            repo_id=DATASET_REPO_ID,
            repo_type="dataset",
            private=True,
            exist_ok=True
        )
        print(f"[+] Dataset repository verified/created.")
    except Exception as e:
        print(f"[-] Warning: Failed to verify/create Dataset repo: {e}")

    # 3. Configure Space Secrets from backend/.env
    backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    env_file = os.path.join(backend_path, ".env")
    if os.path.exists(env_file):
        print(f"[*] Reading secrets from local backend/.env...")
        env_vars = parse_env_file(env_file)
        if env_vars:
            print(f"[*] Syncing {len(env_vars)} secrets to HF Space settings...")
            for key, val in env_vars.items():
                # Avoid uploading empty values
                if not val:
                    continue
                try:
                    api.add_space_secret(repo_id=SPACE_REPO_ID, key=key, value=val)
                    print(f"    [+] Set secret: {key}")
                except Exception as e:
                    print(f"    [-] Failed to set secret {key}: {e}")
        else:
            print("[-] Warning: backend/.env is empty.")
    else:
        print(f"[-] Warning: backend/.env not found at {env_file}. Skipping space secrets sync.")

    # 4. Upload backend folder
    if not os.path.exists(backend_path):
        print(f"[-] Error: Backend directory not found at {backend_path}")
        sys.exit(1)
        
    try:
        print("[*] Uploading backend files. This might take a few moments...")
        api.upload_folder(
            folder_path=backend_path,
            repo_id=SPACE_REPO_ID,
            repo_type="space",
            ignore_patterns=["__pycache__/*", "*.pyc", ".env", "data/*"]
        )
        print("\n[+] Deployment successfully pushed, sir!")
        print(f"[+] Your web API is building and will run soon at: https://huggingface.co/spaces/{SPACE_REPO_ID}")
    except Exception as e:
        print(f"[-] Deployment upload failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_deployment()
