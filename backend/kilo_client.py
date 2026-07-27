import os
import httpx
import json

KILO_API_GATEWAY_URL = "https://api.kilo.ai/api/gateway"

async def get_kilo_model_dynamic(model_key: str, api_key: str = None) -> str:
    """
    Dynamically resolves the exact Kilo model ID (api_key) for any model_key string
    without hardcoded dictionaries. If model_key is already a Kilo model ID (contains '/' or ':free'),
    it returns model_key directly. Otherwise, it queries live models from Kilo API or matches traits.
    """
    if not model_key:
        return "stepfun/step-3.7-flash:free"
    
    clean_key = model_key.strip()
    
    # 1. If model_key is already a valid Kilo model ID (e.g. stepfun/step-3.7-flash:free)
    if "/" in clean_key or clean_key.endswith(":free"):
        return clean_key

    # 2. Dynamically fetch models from Kilo Gateway to find exact model object by name
    try:
        models = await fetch_kilo_models(api_key)
        for m in models:
            m_name = (m.get("name") or "").strip()
            m_id = (m.get("api_key") or "").strip()
            if m_name.lower() == clean_key.lower() or m_id.lower() == clean_key.lower():
                return m_id
    except Exception as e:
        print(f"[-] Dynamic Kilo model lookup notice: {e}")

    # 3. Dynamic trait matching (e.g. "StepFun", "Step 3.7 Flash", "DeepSeek", "Gemini")
    key_lower = clean_key.lower()
    if "stepfun" in key_lower or "step 3.7" in key_lower or "step" in key_lower:
        return "stepfun/step-3.7-flash:free"
    elif "deepseek" in key_lower:
        return "deepseek/deepseek-v4-flash:free" if "free" in key_lower else "deepseek/deepseek-r1"
    elif "gemini" in key_lower:
        return "google/gemini-2.5-flash:free"
    elif "claude" in key_lower:
        return "anthropic/claude-3.5-sonnet:free"

    return clean_key

def is_vision_model_dynamic(model_id: str, model_name: str = "") -> bool:
    """
    Dynamically checks if a model supports vision/multimodal payloads
    based on model ID, name, or capability indicators.
    """
    combined = f"{model_id} {model_name}".lower()
    vision_keywords = ["vision", "vl", "multimodal", "step", "gemini", "claude", "mimo", "gpt-4", "pixtral", "image", "media"]
    return any(kw in combined for kw in vision_keywords)

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


async def query_kilo_ai(
    prompt: str,
    model_key: str = "stepfun/step-3.7-flash:free",
    image_url: str = None,
    kilo_api_key: str = None
) -> str:
    """
    Executes completions against Kilo AI Gateway supporting both multimodal image payloads and text.
    Dynamically resolves model_key to raw API model ID.
    """
    api_key = kilo_api_key or os.getenv("KILO_API_KEY", "")
    if not api_key:
        raise ValueError("KILO_API_KEY environment variable is not configured.")

    model_id = await get_kilo_model_dynamic(model_key, api_key=api_key)

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }

    # Only send multimodal array if image_url is present AND model dynamically supports vision
    use_multimodal = bool(image_url and is_vision_model_dynamic(model_id, model_key))

    if use_multimodal:
        content = [
            {"type": "image_url", "image_url": {"url": image_url}},
            {"type": "text", "text": prompt}
        ]
    elif image_url:
        content = f"Image URL: {image_url}\n{prompt}"
    else:
        content = prompt

    messages = [
        {"role": "system", "content": "You are VoxKage's AI Image Search Query Synthesizer."},
        {"role": "user", "content": content}
    ]

    payload = {
        "model": model_id,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 250
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{KILO_API_GATEWAY_URL}/chat/completions", headers=headers, json=payload)
        if res.status_code == 200:
            data = res.json()
            choice = data.get("choices", [{}])[0]
            msg = choice.get("message", {})
            text = msg.get("content") or choice.get("text") or msg.get("reasoning") or ""
            return text
        
        # If multimodal payload failed (e.g. format rejected by provider), retry with text prompt fallback
        if use_multimodal:
            print(f"[-] Kilo multimodal payload returned {res.status_code}. Retrying with text prompt fallback...")
            fallback_messages = [
                {"role": "system", "content": "You are VoxKage's AI Image Search Query Synthesizer."},
                {"role": "user", "content": f"Image URL: {image_url}\n{prompt}"}
            ]
            fallback_payload = {**payload, "messages": fallback_messages}
            res_fb = await client.post(f"{KILO_API_GATEWAY_URL}/chat/completions", headers=headers, json=fallback_payload)
            if res_fb.status_code == 200:
                data_fb = res_fb.json()
                choice_fb = data_fb.get("choices", [{}])[0]
                msg_fb = choice_fb.get("message", {})
                return msg_fb.get("content") or choice_fb.get("text") or msg_fb.get("reasoning") or ""

        raise RuntimeError(f"Kilo API returned status {res.status_code}: {res.text[:250]}")
