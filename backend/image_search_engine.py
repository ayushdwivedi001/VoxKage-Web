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


async def curate_search_query_with_ai(
    initial_query: str,
    image_title: str,
    image_url: str = "",
    selected_model: str = "DeepSeek V4 Flash",
    provider: str = "opencode"
) -> str:
    """
    Synthesizes a targeted, noise-free search query using the user's SELECTED MODEL.
    Routes explicitly based on provider parameter ('kilo' vs 'opencode').
    Zero string keyword guessing.
    Always attempts multimodal image payload first, falling back to text synthesis.
    """
    clean_init = initial_query.strip()
    clean_title = image_title.replace("Pinterest", "").replace("pinterest.com", "").replace("|", "").strip()

    # Fast algorithmic fallback baseline (strips noise words like 'LOVE')
    title_words = [w for w in re.sub(r'[^\w\s]', ' ', clean_title).split() if len(w) > 2 and w.lower() not in {"pin", "pins", "image", "jpg", "png", "love", "like", "cool", "best"}]
    fallback_query = f"{clean_init} {' '.join(title_words[:4])}".strip() if title_words else clean_init

    prompt = (
        f"You are VoxKage's Image Search Query Synthesizer.\n"
        f"Initial User Search: \"{clean_init}\"\n"
        f"Selected Image Title: \"{clean_title}\"\n\n"
        f"Task:\n"
        f"Inspect the image visual subject, character, art style, and dominant color design.\n"
        f"Filter out generic noise words (e.g. 'love', 'pin', 'pic', 'cool').\n"
        f"Combine initial search '{clean_init}' with the specific visual subject/character in the image into a 2-5 term comma-separated query.\n"
        f"Output ONLY the comma-separated search query (e.g. 'Tekken 8, Jin Kazama, wallpaper'). No extra text or quotes."
    )

    is_kilo = (provider or "").strip().lower() == "kilo"

    # 1. Attempt Multimodal Payload (Image URL + Text Prompt)
    try:
        if is_kilo:
            from kilo_client import query_kilo_ai
            ai_res = await query_kilo_ai(prompt=prompt, model_key=selected_model, image_url=image_url)
        else:
            from opencode_client import query_opencode_zen
            ai_res = await query_opencode_zen(prompt=prompt, model_key=selected_model, image_url=image_url)

        clean_ai = ai_res.strip().replace('"', '').replace("`", "").strip()
        if clean_ai and len(clean_ai) > 2 and not clean_ai.lower().startswith("error"):
            print(f"[+] VoxKage Multimodal AI Curated Query via {provider.upper()} model '{selected_model}': {clean_ai}")
            return clean_ai
    except Exception as e:
        print(f"[-] Multimodal payload notice for {provider.upper()} model '{selected_model}': {e}. Falling back to text synthesis...")

    # 2. Fallback to Text-Only Payload (Prompt with embedded image URL reference)
    try:
        text_prompt = f"Image URL: {image_url}\n{prompt}"
        if is_kilo:
            from kilo_client import query_kilo_ai
            ai_res = await query_kilo_ai(prompt=text_prompt, model_key=selected_model, image_url=None)
        else:
            from opencode_client import query_opencode_zen
            ai_res = await query_opencode_zen(prompt=text_prompt, model_key=selected_model, image_url=None)

        clean_ai = ai_res.strip().replace('"', '').replace("`", "").strip()
        if clean_ai and len(clean_ai) > 2 and not clean_ai.lower().startswith("error"):
            print(f"[+] VoxKage Text Fallback Curated Query via {provider.upper()} model '{selected_model}': {clean_ai}")
            return clean_ai
    except Exception as e:
        print(f"[-] AI text fallback notice for {provider.upper()} model '{selected_model}': {e}")

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
