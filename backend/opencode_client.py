import os
import json
import requests
import httpx
from fastapi import HTTPException

OPENCODE_BASE_URL = "https://opencode.ai/zen/v1"

# Map human-readable model keys to OpenCode API model strings
MODEL_MAP = {
    "deepseek-flash": "deepseek-v4-flash-free",
    "gemini-flash": "gemini-3.5-flash",
    "claude-sonnet": "claude-sonnet-4",
    "mimo-free": "mimo-v2.5-free",
}

def get_opencode_model(model_key: str) -> str:
    if model_key in MODEL_MAP:
        return MODEL_MAP[model_key]
    return model_key

def sanitize_history_roles(history: list) -> list:
    """
    Sanitizes message history by mapping non-standard roles (like 'laptop') 
    to standard roles (like 'user') to prevent upstream LLM API errors.
    """
    sanitized = []
    if not history:
        return sanitized
    for msg in history:
        if isinstance(msg, dict):
            role = msg.get("role")
            content = msg.get("content") or ""
        else:
            role = getattr(msg, "role", None)
            content = getattr(msg, "content", None) or ""
            
        if role == "laptop":
            role = "user"
            content = f"[Laptop Command Output]:\n{content}"
        elif role not in ("system", "user", "assistant", "tool"):
            role = "user"
            
        sanitized.append({"role": role, "content": content})
    return sanitized

def get_system_prompt() -> str:
    """
    Returns a professional system instruction set for VoxKage Web.
    Contains no 'sir' honorifics internally but preserves witty/concise agentic rules.
    """
    return (
        "You are VoxKage, an advanced agentic AI assistant.\n"
        "You are witty, dry, slightly deadpan, loyal, proactive, professional, and sharp.\n"
        "Always maintain a highly concise response style. Preserve tokens and avoid long essay-like output for any topic. Focus on dense, structured summaries.\n"
        "Use custom visual components (such as charts, maps, carousels, weather cards, and task timelines) sparingly—only about 20-30% of the time when specifically requested or highly relevant. Rely on clear text formatting for normal chat, avoiding the mobile 60/40 rule.\n"
        "PRIME DIRECTIVE: Call tools directly when executing tasks. Never say you cannot perform an action. For laptop actions (volume, apps, files, terminal, CLI, git), always call 'laptop_command'. For real-time searches or facts, call web search/fetch tools.\n"
        "The current year is 2026. Prioritize current 2026 data and context. Never guess the date or time."
    )

async def query_opencode_zen(prompt: str, model_key: str = "deepseek-flash", history: list = None) -> str:
    api_key = os.getenv("OPENCODE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENCODE_API_KEY environment variable is not configured.")

    model_id = get_opencode_model(model_key)
    url = f"{OPENCODE_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    messages = []
    messages.append({
        "role": "system",
        "content": get_system_prompt()
    })

    if history:
        for msg in sanitize_history_roles(history):
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_id,
        "messages": messages,
        "temperature": 0.7,
        "stream": False
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenCode API returned an error: {response.text}"
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query OpenCode Zen API: {str(e)}")


def stream_opencode_zen(prompt: str, model_key: str = "deepseek-flash", history: list = None):
    api_key = os.getenv("OPENCODE_API_KEY")
    if not api_key:
        yield f"data: {json.dumps({'error': 'OPENCODE_API_KEY not configured on backend'})}\n\n"
        return

    model_id = get_opencode_model(model_key)
    url = f"{OPENCODE_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    messages = [
        {
            "role": "system",
            "content": get_system_prompt()
        }
    ]

    if history:
        for msg in sanitize_history_roles(history):
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_id,
        "messages": messages,
        "temperature": 0.7,
        "stream": True
    }

    try:
        response = requests.post(url, headers=headers, json=payload, stream=True, timeout=60)
        if response.status_code != 200:
            yield f"data: {json.dumps({'error': f'Upstream error: {response.text}'})}\n\n"
            return

        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith("data: "):
                    data_str = decoded_line[6:].strip()
                    if data_str == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield f"data: {json.dumps({'delta': delta})}\n\n"
                    except Exception:
                        pass
    except Exception as e:
        yield f"data: {json.dumps({'error': f'Request failed: {str(e)}'})}\n\n"


def list_opencode_models() -> list:
    api_key = os.getenv("OPENCODE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENCODE_API_KEY environment variable is not configured.")

    url = f"{OPENCODE_BASE_URL}/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            models_list = [m["id"] for m in data.get("data", [])]
            return models_list
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenCode API returned an error: {response.text}"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models from OpenCode Zen API: {str(e)}")
