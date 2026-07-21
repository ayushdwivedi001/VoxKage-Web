import os
import httpx
import json

KILO_API_GATEWAY_URL = "https://api.kilo.ai/api/gateway"

async def fetch_kilo_models(api_key: str = None) -> list:
    """
    Fetch available models list from Kilo AI Gateway.
    Falls back to environment KILO_API_KEY if api_key not provided.
    """
    if not api_key:
        api_key = os.getenv("KILO_API_KEY", "")
    
    if not api_key:
        return []
    
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Accept": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{KILO_API_GATEWAY_URL}/models", headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                models = []
                for m in data:
                    is_free = m.get("isFree", False) or (m.get("id", "").endswith(":free"))
                    models.append({
                        "name": m.get("name") or m.get("id"),
                        "api_key": m.get("id"),
                        "provider": "kilo",
                        "desc": m.get("description") or ("Free Model" if is_free else "Paid Model"),
                        "isFree": is_free,
                        "requiresUpgrade": not is_free
                    })
                return models
            else:
                print(f"[-] Kilo API returned status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[-] Failed to fetch Kilo models: {e}")
    return []
