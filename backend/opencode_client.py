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
        "PRIME DIRECTIVE: Call tools directly when executing tasks. Never say you cannot perform an action. For laptop system actions (volume, apps, terminal, CLI, git status), call 'laptop_command'.\n"
        "STRICT DYNAMIC IMAGE SEARCH & CAROUSEL RULE: When the user asks for photos, images, visual items, or graphics, call the 'get_images' tool. Once the tool returns the list of image URLs, append the custom XML tag '<Images query=\"[search term]\" data=\"[title]|[url]||[title]|[url]\" />' at the very end of your final content. Do not include markdown around this tag. If the request is for copyright-restricted or highly branded assets (latest games, movies, trademarked assets) where free distribution is illegal or stock platforms fail, omit the image tag and explicitly explain to the user that you are avoiding copyrighted material to comply with licensing constraints.\n"
        "STRICT INTERACTIVE MAPS & WEATHER COMPONENT RULE: When the user asks to see a map, locate multiple sights/attractions, plan an itinerary, or find offices/branches/coordinates, you MUST call the 'show_map' tool, passing all relevant locations inside the structured 'places' array parameter. When the user asks for weather reports, forecasts, conditions, or temperatures, you MUST call the 'get_weather' tool. You are strictly forbidden from outputting '<Map>' or '<Weather>' XML tags manually inside your text response; the backend will automatically parse your tool call and append the correct, fully-configured interactive widgets to your final response when the stream finishes. You must always invoke the tools to trigger these widgets.\n"
        "STRICT ANALYTICS & FLOW DIAGRAM WIDGET RULE: When the user asks for charts, graphs, data metrics, comparisons, architectures, workflow diagrams, or process steps, you MUST call 'render_chart' or 'render_flow' to render them. Call these tools about 20% of the time when relevant or when explicitly requested. You are strictly forbidden from hand-typing or outputting '<Chart>' or '<Flow>' XML tags manually inside your text response, as hand-typed tags will not be parsed and are treated as plain text. The system is built so the backend automatically intercepts your actual tool invocations (render_chart/render_flow) and dynamically appends the fully-formed interactive widgets to your final response when the stream completes. You must always invoke the tools to trigger these widgets.\n"
        "STRICT SCIENCE & ACADEMIC VISUALIZATIONS RULE: When explaining mathematics formulas or theorems, you MUST write standard LaTeX equations using double dollar block delimiters ($$ [formula] $$) or inline delimiters ($ [formula] $). For chemical molecular structures, you MUST call 'get_chemical_structure' to render the 2D SVG structure skeleton card. If 3D molecular renders or stock photos are required, call 'get_images' as a visual fallback. For historical sequences or timelines, call 'render_timeline'. For financial calculators (compound interest, tax estimations, loan calculators), call 'render_calculator'. You are strictly forbidden from hand-typing '<Chemistry>', '<Timeline>', or '<Calculator>' XML tags manually in your response text.\n"
        "STRICT CS FLOWCHARTS & MERMAID DIAGRAMS RULE: When explaining complex network topologies, database ER diagrams, flowcharts, AST trees, or state machines, you MUST write the code directly using fenced markdown code blocks with language tag 'mermaid' (e.g. ```mermaid\\n...\\n```). The frontend will automatically intercept these blocks and render them dynamically as premium interactive diagrams.\n"
        "COORDINATE APPROXIMATION & LATENCY RULE: If you need to map multiple places via 'show_map' but do not have the exact coordinates, you MUST immediately approximate them using city coordinates (e.g. Surat center: 21.1702, 72.8311; Indore center: 22.7196, 75.8577; Ujjain: 23.1793, 75.7849) instead of running runaway web search loops to find exact coordinates. Limit total search/fetch iterations to at most 2.\n"
        "STRICT CLOUD INFRASTRUCTURE & CODE GENERATION RULE: For creating, reading, writing, or editing code files, do NOT use 'laptop_command' shell scripts to perform file operations on the user's laptop. Always output the completed or edited files directly as standard markdown code blocks (e.g. ```python ... ``` or ```javascript ... ```) in your response. The frontend infrastructure will capture, version, and manage these files directly in the browser. Always output the full edited content or precise edits in code blocks.\n"
        "STRICT WEB SEARCH PACING & PARALLELIZATION RULES (NON-NEGOTIABLE):\n"
        "1. For general web lookups, you are strictly limited to exactly ONE parallel web search ('web_search_parallel') and exactly ONE parallel web fetch ('web_fetch_parallel') per turn. Gather all required data in this single parallel cycle and respond immediately. DO NOT perform multiple sequential search or fetch calls in a loop.\n"
        "2. You can specify a targeted list of queries inside 'web_search_parallel' (from 3, 5, up to 15 queries) to fetch all facets in one roundtrip. Likewise, fetch multiple resource URLs concurrently in a single 'web_fetch_parallel' call.\n"
        "3. If the user's query is small, simple, or specifies a single source, use standard 'web_search' or 'web_fetch' instead of the parallel versions. Never run multiple parallel searches or parallel fetches sequentially unless the first fetch round returned 100% errors/null content.\n"
        "4. The deep lookup tools ('web_search_deep', etc.) are strictly prohibited unless the user explicitly includes the keyword 'research' in their prompt or the task demands extreme academic/technical research.\n"
        "5. Once you obtain enough data, respond instantly. Add a brief message at the end of the response informing the user they can ask for more details if they want it. This ensures maximum efficiency and instant response times.\n"
        "The current year is 2026. Prioritize current 2026 data and context. Never guess the date or time.\n"
        "STRICT EMOJI RULE: Do NOT use any emojis in your response under any circumstances, unless the user explicitly asks you to use them in the query.\n"
        "STRICT LAYOUT RULE: Keep paragraphs and lists tight. Avoid massive line breaks, double spaces, or inserting standalone '---' horizontal separator lines between topics or sections."
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
