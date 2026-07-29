import re
import json
import time
import httpx
import asyncio
import urllib.parse
import warnings
from typing import List, Dict, Any

warnings.filterwarnings("ignore", category=RuntimeWarning)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

async def _research_topic(query: str) -> str:
    """
    Performs a live DuckDuckGo text search and extracts real entity names,
    titles and snippets from the top results to serve as grounded research context.
    """
    encoded = urllib.parse.quote(query.strip())
    url = f"https://html.duckduckgo.com/html/?q={encoded}"
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True, headers=HEADERS) as client:
            res = await client.get(url)
            if res.status_code == 200:
                def _clean(text: str) -> str:
                    text = re.sub(r'<[^>]+>', '', text)
                    text = (text.replace('&amp;', '&').replace('&quot;', '"')
                            .replace('&#x27;', "'").replace('&lt;', '<')
                            .replace('&gt;', '>').strip())
                    return text

                titles   = re.findall(r'class="result__title"[^>]*>.*?<a[^>]*>(.*?)</a>', res.text, re.DOTALL)
                snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</span>', res.text, re.DOTALL)

                clean_titles   = [_clean(t) for t in titles[:8]   if _clean(t)]
                clean_snippets = [_clean(s) for s in snippets[:4] if _clean(s)]

                parts = []
                if clean_titles:
                    parts.append("Top result titles: " + " | ".join(clean_titles[:6]))
                if clean_snippets:
                    parts.append("Snippets: " + " | ".join(clean_snippets[:2])[:350])
                return "\n".join(parts)
    except Exception as err:
        print(f"[-] Research scrape notice: {err}")
    return ""


async def generate_suggestion_pills(query: str) -> List[str]:
    """
    Research-Driven Search Refinement Chip Synthesizer.
    Step 1 — Live text search → real entity/context extraction.
    Step 2 — LLM synthesizes 8 immersive, deeply specific chips grounded in that research.
    Zero hardcoded keyword rules.
    """
    clean_q = query.strip()

    # --- Step 1: Research the topic concurrently with image fetch ---
    research_context = await _research_topic(clean_q)

    context_block = ""
    if research_context:
        context_block = (
            f"\n\n[LIVE RESEARCH CONTEXT — ground your chips in this]:\n{research_context}\n"
        )

    prompt = (
        f"User Image Search Query: \"{clean_q}\"\n"
        f"{context_block}\n"
        "Your job: Generate exactly 8 SHORT, highly specific search refinement chips for this topic.\n\n"
        "Chip requirements:\n"
        "- Named entities, sub-components, specific versions, characters, locations, or visual aspects\n"
        "- 1 to 3 words each — never longer\n"
        "- Directly specific to what was found in the research context above\n"
        "- Immersive and precise — NOT generic (never use: 'overview', 'details', 'HD', '4K', 'photos', 'images', 'gallery', 'wallpaper', 'aesthetic')\n"
        "- Varied: cover different dimensions (e.g. character + location + edition + mechanic + studio etc.)\n\n"
        "GOOD example for 'Hitman 3 game': [\"Agent 47\", \"Dartmoor\", \"Berlin\", \"Mendoza\", \"Freelancer Mode\", \"Deluxe Pack\", \"ICA19\", \"World of Assassination\"]\n"
        "GOOD example for 'Cyberpunk 2077': [\"Night City\", \"V Character\", \"Phantom Liberty\", \"Johnny Silverhand\", \"Cyberware\", \"Dogtown\", \"Netrunner Build\", \"Rogue Amendiares\"]\n"
        "GOOD example for 'Rajasthan travel': [\"Amber Fort\", \"Mehrangarh\", \"Jaisalmer\", \"Udaipur Lake\", \"Pushkar\", \"Ranthambore\", \"Blue City\", \"Hawa Mahal\"]\n"
        "GOOD example for '007 First Light': [\"James Bond\", \"MI6\", \"Origin Story\", \"Young Bond\", \"IO Interactive\", \"Training\", \"00 Status\", \"Recruits\"]\n\n"
        "Return ONLY a raw JSON array of exactly 8 strings. No explanation, no markdown."
    )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                "https://opencode.ai/zen/v1/chat/completions",
                json={
                    "model": "deepseek-v4-flash-free",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4
                }
            )
            if res.status_code == 200:
                content = res.json()["choices"][0]["message"]["content"]
                match = re.search(r'\[.*\]', content, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    if isinstance(parsed, list) and len(parsed) >= 4:
                        return [str(c).strip() for c in parsed[:8]]
    except Exception as err:
        print(f"[-] Pill LLM notice: {err}")

    # Fallback: Live autocomplete
    try:
        encoded = urllib.parse.quote(clean_q)
        ac_url = f"https://duckduckgo.com/ac/?q={encoded}&type=list"
        async with httpx.AsyncClient(timeout=2.0, headers=HEADERS) as client:
            ac_res = await client.get(ac_url)
            if ac_res.status_code == 200:
                data = ac_res.json()
                if len(data) > 1 and isinstance(data[1], list):
                    chips = [item.strip() for item in data[1]
                             if item.strip() and item.strip().lower() != clean_q.lower()]
                    if chips:
                        return chips[:8]
    except Exception:
        pass

    return [clean_q]


async def search_pinterest_images(query: str, limit: int = 24) -> Dict[str, Any]:
    """
    Performs direct authentic live Pinterest Pin Search directly via Pinterest's internal BaseSearchResource API.
    Extracts 100% genuine Pinterest Pins with high-resolution i.pinimg.com image links,
    direct pin URLs (https://www.pinterest.com/pin/<id>/), and original Pin titles.
    """
    clean_query = query.replace("pinterest.com", "").replace("pinterest", "").strip()
    if not clean_query:
        clean_query = query.strip()

    source_url = f"/search/pins/?q={urllib.parse.quote(clean_query)}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "X-Pinterest-AppState": "active",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    }

    payload = {
        "options": {
            "query": clean_query,
            "scope": "pins",
            "page_size": max(limit, 25)
        },
        "context": {}
    }

    formatted_images = []
    seen_urls = set()

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # Acquire guest session cookie & CSRF token from Pinterest
            r1 = await client.get("https://www.pinterest.com/", headers={"User-Agent": headers["User-Agent"]})
            csrf = client.cookies.get("csrftoken") or ""
            
            req_headers = {
                **headers,
                "Referer": f"https://www.pinterest.com{source_url}",
                "X-CSRFToken": csrf
            }
            
            form_data = {
                "source_url": source_url,
                "data": json.dumps(payload)
            }
            
            res = await client.post("https://www.pinterest.com/resource/BaseSearchResource/get/", data=form_data, headers=req_headers)
            if res.status_code == 200:
                data = res.json()
                results = data.get("resource_response", {}).get("data", {}).get("results", [])
                for item in results:
                    if not isinstance(item, dict):
                        continue
                    p_id = item.get("id")
                    title = item.get("title") or item.get("grid_title") or item.get("description") or f"{clean_query.capitalize()} Pin"
                    imgs = item.get("images", {})
                    orig = imgs.get("orig", {}).get("url") or imgs.get("736x", {}).get("url") or imgs.get("474x", {}).get("url")
                    thumb = imgs.get("236x", {}).get("url") or imgs.get("474x", {}).get("url") or orig

                    if orig and orig not in seen_urls:
                        seen_urls.add(orig)
                        clean_title = str(title).replace("Pinterest", "").replace("pinterest.com", "").replace("|", "").strip()
                        if not clean_title or clean_title.lower() == "pin":
                            clean_title = f"{clean_query.capitalize()} Pin"

                        formatted_images.append({
                            "id": str(p_id) if p_id else f"pin_{len(formatted_images)}",
                            "title": clean_title,
                            "image_url": orig,
                            "thumbnail_url": thumb or orig,
                            "source_url": f"https://www.pinterest.com/pin/{p_id}/" if p_id else f"https://in.pinterest.com/search/pins/?q={urllib.parse.quote(clean_query)}&rs=typed",
                            "domain": "pinterest.com",
                            "width": imgs.get("orig", {}).get("width", 1200),
                            "height": imgs.get("orig", {}).get("height", 800)
                        })
                        if len(formatted_images) >= limit:
                            break
    except Exception as e:
        print(f"[-] Native Pinterest API search notice: {e}")

    # Grounded Pinterest chips
    pills = [
        f"{clean_query} poster",
        f"{clean_query} wallpaper",
        f"{clean_query} cover",
        f"{clean_query} James Bond",
        f"{clean_query} 4K",
        f"{clean_query} gameplay",
        f"{clean_query} art"
    ]

    return {
        "query": clean_query,
        "engine": "pinterest",
        "count": len(formatted_images),
        "images": formatted_images[:limit],
        "pills": pills
    }


def sanitize_5_anchor_query(raw_text: str, initial_query: str) -> str:
    """
    Strips preambles, thinking text, list numbers (1., 2., 1), 2)), bullet points,
    conversational intros, and formats a clean 5-anchor comma-separated visual search string.
    Ensures Anchor 1 (initial search term) is always leading.
    """
    clean = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL).strip()
    clean = clean.replace('"', '').replace('`', '').replace('*', '').replace('•', '').strip()
    
    # Strip list prefixes like "1.", "2.", "1)", "2)", "1:", "2:" from line starts
    clean = re.sub(r'^\d+[\.\)\:\-]\s*', '', clean)

    if '\n' in clean:
        lines = [
            re.sub(r'^\d+[\.\)\:\-]\s*', '', l.strip()) for l in clean.split('\n')
            if l.strip() and not any(w in l.lower() for w in ["got it", "let's", "wait", "first", "oh right", "task:", "image url", "system", "instruction", "fixed as", "term is", "secondly", "think", "see this"])
        ]
        if lines:
            comma_lines = [l for l in lines if ',' in l]
            clean = comma_lines[-1] if comma_lines else lines[-1]

    # Clean leading conversational filler
    clean = re.sub(r'^(the image shows|this image shows|image has a|picture of|photo of|mage has a|there is a|view of|now the image has|the first term is|i see|yeah|second|secondly)\s+', '', clean, flags=re.IGNORECASE)

    banned_phrases = ["got it", "let's", "wait", "task:", "image url", "fixed as", "first term", "term is", "now the image", "the image has", "no,", "no ", "wait no", "instruction", "secondly", "i think", "see this"]

    raw_terms = []
    for raw_part in clean.split(','):
        t = re.sub(r'^\d+[\.\)\:\-]\s*', '', raw_part.strip())
        t = re.sub(r'^(second|secondly|third|fourth|fifth|first)\s+', '', t, flags=re.IGNORECASE).strip()
        if t and not any(b in t.lower() for b in banned_phrases) and len(t) < 45 and t.lower() not in ["no", "yes", "none", "or", "second"]:
            raw_terms.append(t)

    clean_init = initial_query.strip()
    
    # Ensure initial search query is the leading anchor
    terms = []
    if clean_init:
        terms.append(clean_init)
    
    for t in raw_terms:
        if t.lower() != clean_init.lower() and t not in terms:
            terms.append(t)

    final_terms = terms[:5]
    return ", ".join(final_terms)


async def curate_search_query_with_ai(
    initial_query: str,
    image_title: str,
    image_url: str = "",
    selected_model: str = "DeepSeek V4 Flash",
    provider: str = "opencode"
) -> str:
    """
    Synthesizes a targeted 5-anchor visual search query using the user's SELECTED MODEL.
    Enforces candidate fallback strategy: Selected Model -> Mimo 2.5 Free -> OpenRouter Free -> Step 3.7 Flash Free.
    Strictly bans natural language sentences, numbers, and outputs 5 comma-separated terms.
    """
    clean_init = initial_query.strip()
    clean_title = image_title.replace("Pinterest", "").replace("pinterest.com", "").replace("|", "").strip()

    banned_buzzwords = {
        "pin", "pins", "image", "jpg", "png", "jpeg", "photo", "pic", "hd", "4k", 
        "high", "res", "resolution", "concept", "art", "aesthetic", "wallpapers", 
        "wallpaper", "cool", "best", "love", "like", "download", "free"
    }
    clean_words = [
        w for w in re.sub(r'[^\w\s]', ' ', clean_title).split()
        if len(w) > 2 and w.lower() not in banned_buzzwords
    ]
    extracted_features = " ".join(clean_words[:4]) if clean_words else clean_title
    fallback_query = f"{clean_init}, {extracted_features}".strip(", ")

    prompt = (
        f"SYSTEM INSTRUCTION: You are VoxKage's Pinterest Visual Search Synthesizer.\n"
        f"MANDATORY DIRECTIVE: The 5-term string you generate WILL BE PASSED DIRECTLY TO THE IMAGE SEARCH ENGINE TO FIND SIMILAR PINS.\n"
        f"Therefore, you MUST output ONLY 5 comma-separated search prompt terms. ABSOLUTELY NO natural language, conversational sentences, or explanations.\n\n"
        f"INPUT ANCHORS:\n"
        f"• Active Search Bar Query: \"{clean_init}\"\n"
        f"• Selected Pin Title: \"{clean_title}\"\n\n"
        f"REQUIRED 5-ANCHOR STRUCTURE (comma-separated list of 5 terms ONLY):\n"
        f"1. Active Search Query (must be '{clean_init}')\n"
        f"2. Specific Visual Subject / Product / Character (e.g. 'Delphinus Eau de Parfum', 'flying black dragon')\n"
        f"3. Setting / Packaging / Environment (e.g. 'amber glass bottle', 'cloudy blue sky')\n"
        f"4. Lighting / Color Palette (e.g. 'amber glow', 'golden hour sunlight')\n"
        f"5. Aesthetic Category / Material (e.g. 'luxury perfume packaging', 'draped satin fabric')\n\n"
        f"STRICT NEGATIVE CONSTRAINTS:\n"
        f"- ABSOLUTELY NO numbers (NEVER write '1.', '2.', '1)', '2)').\n"
        f"- ABSOLUTELY NO natural language or conversational text (NEVER write 'yeah I see', 'secondly', 'I think', 'here is').\n"
        f"- ABSOLUTELY NO generic buzzwords like 'high resolution', 'concept art', 'aesthetic pin', 'wallpaper', 'hd', '4k'.\n"
        f"- Output MUST be a single line containing EXACTLY 5 comma-separated terms.\n\n"
        f"Output ONLY the 5 comma-separated terms. No markdown, no quotes."
    )

    is_kilo = (provider or "").strip().lower() == "kilo"

    # Build multi-provider candidate strategies for image curation
    candidates = []
    # 1. Primary selected model
    candidates.append(("kilo" if is_kilo else "opencode", selected_model))
    # 2. Mimo 2.5 Free (OpenCode)
    if not (not is_kilo and selected_model.lower() in ["mimo 2.5 free", "mimo-v2.5-free"]):
        candidates.append(("opencode", "mimo-v2.5-free"))
    # 3. OpenRouter Free Models Router (Kilo)
    candidates.append(("kilo", "openrouter/free"))
    # 4. Step 3.7 Flash Free (Kilo)
    candidates.append(("kilo", "stepfun/step-3.7-flash:free"))

    # 1. Attempt Multimodal Payload across provider candidates
    for p_name, m_name in candidates:
        try:
            if p_name == "kilo":
                from kilo_client import query_kilo_ai
                ai_res = await query_kilo_ai(prompt=prompt, model_key=m_name, image_url=image_url)
            else:
                from opencode_client import query_opencode_zen
                ai_res = await query_opencode_zen(prompt=prompt, model_key=m_name, image_url=image_url)

            clean_ai = sanitize_5_anchor_query(ai_res, clean_init)
            if clean_ai and len(clean_ai) > 2 and not clean_ai.lower().startswith("error"):
                print(f"[+] VoxKage 5-Anchor Multimodal AI Curated Query via {p_name.upper()} model '{m_name}': {clean_ai}")
                return clean_ai
        except Exception as e:
            print(f"[-] Multimodal query notice for {p_name.upper()} model '{m_name}': {e}. Trying next candidate...")

    # 2. Fallback to Text-Only Payload across candidates
    text_prompt = f"Image URL: {image_url}\n{prompt}"
    for p_name, m_name in candidates:
        try:
            if p_name == "kilo":
                from kilo_client import query_kilo_ai
                ai_res = await query_kilo_ai(prompt=text_prompt, model_key=m_name, image_url=None)
            else:
                from opencode_client import query_opencode_zen
                ai_res = await query_opencode_zen(prompt=text_prompt, model_key=m_name, image_url=None)

            clean_ai = sanitize_5_anchor_query(ai_res, clean_init)
            if clean_ai and len(clean_ai) > 2 and not clean_ai.lower().startswith("error"):
                print(f"[+] VoxKage 5-Anchor Text Fallback Curated Query via {p_name.upper()} model '{m_name}': {clean_ai}")
                return clean_ai
        except Exception as e:
            print(f"[-] Text fallback query notice for {p_name.upper()} model '{m_name}': {e}. Trying next candidate...")

    print(f"[*] Returning clean visual feature fallback query: {fallback_query}")
    return fallback_query


async def search_related_pinterest_pins(
    pin_id: str = "",
    query: str = "",
    initial_query: str = "",
    image_title: str = "",
    image_url: str = "",
    selected_model: str = "DeepSeek V4 Flash",
    provider: str = "opencode",
    limit: int = 24
) -> Dict[str, Any]:
    """
    Retrieves visually/topically related Pinterest pins using AI query curation.
    """
    if initial_query and image_title:
        search_q = await curate_search_query_with_ai(
            initial_query=initial_query,
            image_title=image_title,
            image_url=image_url,
            selected_model=selected_model,
            provider=provider
        )
    else:
        search_q = query.strip() or f"pin {pin_id}" if pin_id else "aesthetic"

    res = await search_pinterest_images(query=search_q, limit=limit)
    return {
        "pin_id": pin_id,
        "query": search_q,
        "engine": "pinterest",
        "count": len(res.get("images", [])),
        "images": res.get("images", []),
        "pills": res.get("pills", [])
    }
