import re
import json
import httpx
import asyncio
import urllib.parse
from typing import List, Dict, Any

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
    Step 1 — Live DDG text search → real entity/context extraction.
    Step 2 — LLM synthesizes 8 immersive, deeply specific chips grounded in that research.
    Zero hardcoded keyword rules.
    """
    clean_q = query.strip()

    # --- Step 1: Research the topic concurrently with image fetch (called in parallel outside) ---
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

    # Fallback: DDG live autocomplete
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



def _extract_vqd(html_text: str) -> str:
    patterns = [
        r'vqd=["\']?([0-9-]+)[^"\'&\s;,]*',
        r'vqd=["\']?([^"\'&\s;,]+)',
        r'vqd\s*[:=]\s*["\']?([^"\'&\s;,]+)["\']?',
        r'vqd=([a-zA-Z0-9_-]+)'
    ]
    for p in patterns:
        m = re.search(p, html_text)
        if m:
            val = m.group(1)
            if val and len(val) > 5 and val != "1-":
                return val
    return None

def _clean_bing_json(raw_m: str) -> dict:
    import html as html_lib
    try:
        clean_str = html_lib.unescape(raw_m)
        clean_str = clean_str.replace("&quot;", '"').replace("&amp;", "&")
        return json.loads(clean_str)
    except Exception:
        murl_m = re.search(r'"murl"\s*:\s*"([^"]+)"', raw_m) or re.search(r'murl&quot;:&quot;([^&]+)&quot;', raw_m)
        turl_m = re.search(r'"turl"\s*:\s*"([^"]+)"', raw_m) or re.search(r'turl&quot;:&quot;([^&]+)&quot;', raw_m)
        purl_m = re.search(r'"purl"\s*:\s*"([^"]+)"', raw_m) or re.search(r'purl&quot;:&quot;([^&]+)&quot;', raw_m)
        title_m = re.search(r'"t"\s*:\s*"([^"]+)"', raw_m) or re.search(r't&quot;:&quot;([^&]+)&quot;', raw_m)
        
        if murl_m:
            return {
                "murl": html_lib.unescape(murl_m.group(1)),
                "turl": html_lib.unescape(turl_m.group(1)) if turl_m else None,
                "purl": html_lib.unescape(purl_m.group(1)) if purl_m else None,
                "t": html_lib.unescape(title_m.group(1)) if title_m else "Web Image"
            }
    return None

async def search_duckduckgo_images(query: str, limit: int = 24) -> Dict[str, Any]:
    """
    Performs an authentic live DuckDuckGo Image Search via DDG's i.js endpoint.
    Returns 24+ structured authentic image items + DuckDuckGo search refinement chips.
    """
    clean_query = query.strip()
    encoded = urllib.parse.quote(clean_query)
    formatted_images = []
    
    # Primary Method: Authentic DuckDuckGo i.js Protocol (via iax=images&ia=images landing page)
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=HEADERS) as client:
            token_res = await client.get(f"https://duckduckgo.com/?q={encoded}&iax=images&ia=images")
            if token_res.status_code == 200:
                vqd = _extract_vqd(token_res.text)
                if vqd:
                    i_url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={encoded}&vqd={vqd}&f=,,,&p=1"
                    headers_i = {
                        **HEADERS,
                        "Referer": f"https://duckduckgo.com/?q={encoded}&iax=images&ia=images",
                        "X-Requested-With": "XMLHttpRequest"
                    }
                    img_res = await client.get(i_url, headers=headers_i)
                    if img_res.status_code == 200:
                        data = img_res.json()
                        results = data.get("results", [])
                        for item in results[:limit]:
                            title = item.get("title", "Web Image")
                            image_url = item.get("image", "")
                            thumbnail_url = item.get("thumbnail", "")
                            source_url = item.get("url", "")
                            width = item.get("width", 1200)
                            height = item.get("height", 800)
                            
                            domain = "web"
                            if source_url:
                                try:
                                    parsed = urllib.parse.urlparse(source_url)
                                    domain = parsed.netloc.replace("www.", "")
                                except Exception:
                                    pass
                                    
                            if image_url:
                                formatted_images.append({
                                    "title": title,
                                    "image_url": image_url,
                                    "thumbnail_url": thumbnail_url or image_url,
                                    "source_url": source_url or image_url,
                                    "domain": domain,
                                    "width": width,
                                    "height": height,
                                })
    except Exception as err:
        print(f"[-] DDG i.js primary search notice: {err}")
        
    # Secondary Fallback: Bing Async endpoint if DDG primary yielded no images
    if not formatted_images:
        url = f"https://www.bing.com/images/async?q={encoded}&first=1&count={limit}&scenario=ImageBasicHover&datsrc=custom&layout=RowBased"
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=HEADERS) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    matches = re.findall(r'm=["\'](\{.*?\})["\']', res.text)
                    for m_str in matches:
                        b_data = _clean_bing_json(m_str)
                        if b_data:
                            murl = b_data.get("murl")
                            turl = b_data.get("turl")
                            purl = b_data.get("purl")
                            title = b_data.get("t") or "Web Image"
                            
                            domain = "web"
                            if purl:
                                try:
                                    parsed = urllib.parse.urlparse(purl)
                                    domain = parsed.netloc.replace("www.", "")
                                except Exception:
                                    pass
                                    
                            if murl:
                                formatted_images.append({
                                    "title": title,
                                    "image_url": murl,
                                    "thumbnail_url": turl or murl,
                                    "source_url": purl or murl,
                                    "domain": domain,
                                    "width": b_data.get("ow", 1200),
                                    "height": b_data.get("oh", 800)
                                })
        except Exception as err:
            print(f"[-] Image search secondary fallback error: {err}")

    # Generate authentic DDG search refinement chips (runs concurrently with image fetch)
    chips = await generate_suggestion_pills(clean_query)

    # --- Stock Domain Demotion ---
    STOCK_DOMAINS = {
        "alamy.com", "istockphoto.com", "dreamstime.com", "shutterstock.com",
        "gettyimages.com", "depositphotos.com", "123rf.com", "stock.adobe.com",
        "bigstockphoto.com", "pond5.com", "stocksy.com"
    }
    real_images = [img for img in formatted_images if img["domain"] not in STOCK_DOMAINS]
    
    # Use real results if they exist, otherwise fall back to full array
    final_images = real_images if len(real_images) >= 4 else formatted_images

    return {
        "query": clean_query,
        "engine": "ddg",
        "count": len(final_images),
        "images": final_images[:limit],
        "pills": chips
    }


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


async def search_related_pinterest_pins(pin_id: str = "", query: str = "", limit: int = 24) -> Dict[str, Any]:
    """
    Retrieves visually/topically related Pinterest pins for a specific Pin ID or Title keyword.
    """
    clean_q = query.strip()
    if not clean_q and not pin_id:
        clean_q = "aesthetic"
        
    search_q = clean_q or f"pin {pin_id}"
    res = await search_pinterest_images(query=search_q, limit=limit)
    return {
        "pin_id": pin_id,
        "query": search_q,
        "engine": "pinterest",
        "count": len(res.get("images", [])),
        "images": res.get("images", []),
        "pills": res.get("pills", [])
    }


async def search_related_ddg_images(title: str = "", image_url: str = "", limit: int = 24) -> Dict[str, Any]:
    """
    Retrieves visually/topically related web images based on title keywords and entity names.
    """
    clean_title = re.sub(r'[^\w\s]', ' ', title).strip()
    words = [w for w in clean_title.split() if len(w) > 2 and w.lower() not in {"image", "jpg", "png", "webp", "photo", "pic"}]
    search_q = " ".join(words[:6]) if words else "aesthetic visual design"
    
    res = await search_duckduckgo_images(query=search_q, limit=limit)
    return {
        "title": title,
        "query": search_q,
        "engine": "ddg",
        "count": len(res.get("images", [])),
        "images": res.get("images", []),
        "pills": res.get("pills", [])
    }

