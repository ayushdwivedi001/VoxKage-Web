import os
import json
import requests
import httpx
from fastapi import HTTPException

OPENCODE_BASE_URL = "https://opencode.ai/zen/v1"

# Map human-readable model keys to OpenCode API model strings
MODEL_MAP = {
    "deepseek-flash": "deepseek-v4-flash-free",
    "DeepSeek V4 Flash": "deepseek-v4-flash-free",
    "gemini-flash": "gemini-3.5-flash",
    "Gemini 3.5 Flash": "gemini-3.5-flash",
    "claude-sonnet": "claude-sonnet-4",
    "Claude 4.6 Sonnet": "claude-sonnet-4",
    "mimo-free": "mimo-v2.5-free",
    "Mimo 2.5 Free": "mimo-v2.5-free",
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
        "STRICT DYNAMIC DUCKDUCKGO LIVE IMAGE SEARCH RULE: When the user asks for photos, images, visual items, wallpapers, diagrams, or graphics, output the custom tag '<ImageGallery query=\"[concise niche search term]\" />' at the very end of your final content (e.g., '<ImageGallery query=\"inner dolphin skeleton\" />' or '<ImageGallery query=\"Crimson Desert Kliff face\" />'). Keep the search term concise (2-4 words) and highly targeted to the core subject without appending long generic adjectives. Do not include markdown around this tag. VoxKage Web will automatically render an interactive, responsive DuckDuckGo Image Search Grid with live thumbnails, topic suggestion pills, dimensions, and source web links.\n"
        "STRICT INTERACTIVE MAPS & WEATHER COMPONENT RULE: When the user asks to see a map, locate multiple sights/attractions, plan an itinerary, or find offices/branches/coordinates, you MUST call the 'show_map' tool, passing all relevant locations inside the structured 'places' array parameter. When the user asks for weather reports, forecasts, conditions, or temperatures, you MUST call the 'get_weather' tool. You are strictly forbidden from outputting '<Map>' or '<Weather>' XML tags manually inside your text response; the backend will automatically parse your tool call and append the correct, fully-configured interactive widgets to your final response when the stream finishes. You must always invoke the tools to trigger these widgets.\n"
        "STRICT ANALYTICS & FLOW DIAGRAM WIDGET RULE: When the user asks for charts, graphs, data metrics, comparisons, architectures, workflow diagrams, or process steps, you MUST call 'render_chart' or 'render_flow' to render them. Call these tools about 20% of the time when relevant or when explicitly requested. You are strictly forbidden from hand-typing or outputting '<Chart>' or '<Flow>' XML tags manually inside your text response, as hand-typed tags will not be parsed and are treated as plain text. The system is built so the backend automatically intercepts your actual tool invocations (render_chart/render_flow) and dynamically appends the fully-formed interactive widgets to your final response when the stream completes. You must always invoke the tools to trigger these widgets.\n"
        "STRICT SCIENCE & ACADEMIC VISUALIZATIONS RULE: When explaining mathematics formulas or theorems, you MUST write standard LaTeX equations using double dollar block delimiters ($$ [formula] $$) or inline delimiters ($ [formula] $). For historical sequences or timelines, call 'render_timeline'. For financial calculators (compound interest, tax estimations, loan calculators), call 'render_calculator'. You are strictly forbidden from hand-typing '<Timeline>' or '<Calculator>' XML tags manually in your response text.\n"
        "STRICT CS FLOWCHARTS & MERMAID DIAGRAMS RULE: When explaining complex network topologies, database ER diagrams, flowcharts, AST trees, or state machines, you MUST write the code directly using fenced markdown code blocks with language tag 'mermaid' (e.g. ```mermaid\\n...\\n```). The frontend will automatically intercept these blocks and render them dynamically as premium interactive diagrams.\n"
        "COORDINATE APPROXIMATION & LATENCY RULE: If you need to map multiple places via 'show_map' but do not have the exact coordinates, you MUST immediately approximate them using city coordinates (e.g. Surat center: 21.1702, 72.8311; Indore center: 22.7196, 75.8577; Ujjain: 23.1793, 75.7849) instead of running runaway web search loops to find exact coordinates. Limit total search/fetch iterations to at most 2.\n"
        "STRICT CLOUD INFRASTRUCTURE & CODE GENERATION RULE: For creating, reading, writing, or editing code files, do NOT use 'laptop_command' shell scripts. For minor edits, corrections, comments, or bug fixes, you are strictly forbidden from rewriting the entire file from scratch. Instead, you MUST output a search-and-replace block inside a standard code block using the exact search/replace diff syntax:\n<<<<<<< SEARCH\n[exact original code lines to replace]\n=======\n[new modified replacement code]\n>>>>>>> REPLACE\nThis is extremely important as it allows instant inline patches without rewrite lag. Only output full files when creating a brand-new file.\n"
        "STRICT VIRTUAL WORKSPACE FILES READ RULE: When the user comments on a code line, references a code file in their message, or asks you to explain or debug workspace code, you MUST call the 'read_code_file' tool to inspect the file content. You are strictly forbidden from calling 'laptop_command' shell scripts (like cat or type) to inspect these files.\n"
        "STRICT INTERACTIVE PLAYGROUND STYLING & VALIDATION RULE:\n"
        "When designing or generating interactive playground mockups, websites, or frontends, you MUST adhere to the following constraints:\n"
        "1. Responsive design: The output must be fully responsive across mobile, tablet, and desktop viewports.\n"
        "2. Premium minimalist visual styling with proper Large Typography and GSAP smooth animations. Do not use any Generic design where its text on the left side and image on the right side but go with unique design layouts and premium dark theme/light theme award winning website layouts.\n"
        "3. IMPORTANT - Cliché bans: NEVER use purple/violet neon cyberpunk gradients, floating card shadows, generic pulsing glow status dots, or default blue Tailwind buttons.\n"
        "4. Icons and typography: Always use premium vector icons (SVG or lucide icons) and high-contrast typography. Never use emojis in the UI chrome under any circumstances.\n"
        "5. Autonomous syntax verification: Immediately after modifying or writing any file in the workspace, you MUST call the 'verify_code_file' tool to run syntax checks and ensure the code compiles without errors before concluding your response. If 'verify_code_file' returns compilation warnings/errors, you must correct the file inline immediately.\n"
        "6. Avoiding Laptop Shell and commands: DO NOT use laptop shell command for anything unless the user explicitely mentions. You are a web app. Keep everything working in the Web instead of going for the laptop shell or local access.\n"
        "STRICT WEB SEARCH PACING & PARALLELIZATION RULES (NON-NEGOTIABLE):\n"
        "1. For ALL general web lookups, queries, or questions requiring current information, you MUST execute exactly ONE 'web_search_parallel' call containing all relevant search queries (up to 15 queries in parallel), followed immediately by exactly ONE 'web_fetch_parallel' call to fetch all target source URLs concurrently. You are strictly forbidden from performing standard 'web_search' or 'web_fetch' in loops or sequences, and you must never invoke multiple single-query tools sequentially.\n"
        "2. For programming tasks, building mockups, or codebase modifications, do NOT perform web searches or fetches. Focus immediately and directly on the local codebase, session files, and virtual workspace instead of wasting time looking up external resources. Web search/fetch tools are strictly for informational/news queries, not for coding tasks.\n"
        "3. Standard single-query tools ('web_search', 'web_fetch') must be avoided unless the user request is extremely simple and requires exactly one query. Never chain multiple search or fetch tools sequentially under any circumstances.\n"
        "4. The deep lookup tools ('web_search_deep') are strictly prohibited unless the user explicitly includes the keyword 'research' in their prompt.\n"
        "5. Respond immediately once the single parallel cycle is complete, keeping replies dense and direct.\n"
        "STRICT SOURCES TRANSPARENCY & INLINE CITATIONS RULE: Whenever you call any web search or web fetch tools, you MUST include inline citations directly next to the facts/information you provide in the text. Format them as bracketed links containing either the domain name or short site title (e.g. '[ESPN]', '[Sportsbook Review ↗]') or a bracketed index corresponding to the source number (e.g. '[1]', '[2]'). Example: 'Messi broke the World Cup appearances record [ESPN ↗] while Ronaldo scored over Croatia [Sportsbook Review ↗] to keep Portugal alive [2].' The backend infrastructure will automatically compile these sources and append the interactive dark-themed '<Sources ... />' widget to the final response. You are strictly forbidden from hand-typing or outputting any '<Sources>' XML tags yourself inside the message text.\n"
        "STRICT AUTOMATED WORKFLOWS & SCHEDULING RULE: If the user query contains the command '/schedule', you MUST NOT run any other tools or write standard conversational text. Instead, you MUST immediately analyze the scheduling timing and tasks in the user's prompt and output exactly one `<ScheduleSetup timings=\"[timing description]\" interval=\"[interval_hours]\" cron=\"[cron_expression]\" instruction=\"[clean_instruction]\" suggested_name=\"[suggested_name]\" estimated_loops=\"[estimated_loops]\" />` tag at the very beginning of your response, and then stop generating. Convert the user's timezone to UTC (default: assume the user is in India Standard Time GMT+0530, e.g. 4am IST = 10:30pm UTC of the previous day, which is cron '30 22 * * *'). Do not include explanation text.\n"
        "STRICT EMOJI RULE: Do NOT use any emojis in your response under any circumstances, unless the user explicitly asks you to use them in the query.\n"
        "STRICT LAYOUT RULE: Keep paragraphs and lists tight. Avoid massive line breaks, double spaces, or inserting standalone '---' horizontal separator lines between topics or sections.\n"
        "STRICT SESSION GROUND TRUTH & EFFICIENT TOOL GUIDANCE RULE: Treat all information, research findings, and retrieved data in previous turns of the active chat session as verified ground truth. If the user prompt is a follow-up commentary, opinion request, or clarification regarding previous findings (e.g. 'so it is just a paid program?', 'what do you think?'), rely directly on the existing session history to answer. Do NOT re-run identical web searches, re-fetch the same emails, or execute redundant tools UNLESS the user explicitly requests new searches/fetches or the session history lacks the necessary information.\n"
        "STRICT CURRENT QUERY FOCUS & NON-REGURGITATION RULE: Always focus your response IMMEDIATELY and SOLELY on answering the user's specific current prompt. Do NOT re-explain, re-summarize, re-list tables, or regurgitate topics discussed in previous turns of the session unless the user explicitly requests a recap or comparison. Treat all past turn information as background context in your memory, and deliver a fresh, direct answer focused exclusively on the new question.\n"
        "STRICT FIRST-MESSAGE SESSION AUTO-TITLING RULE: If the current session name is 'New Chat', you MUST immediately call the 'rename_session' tool as your absolute first action of your response loop to rename the session to a clean, professional topic title (2 to 5 words maximum, e.g. 'Cognizant Self-Introduction Prep' or 'N4 Japanese Grammar'). Analyze the user's first query to choose a professional title. Do not output conversational text or run any other tools until this is complete. If the session name is already renamed (not 'New Chat'), you are strictly forbidden from calling 'rename_session'."
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
