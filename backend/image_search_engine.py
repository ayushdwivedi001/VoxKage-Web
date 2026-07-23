import re
import json
import httpx
import urllib.parse
from typing import List, Dict, Any

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def generate_suggestion_pills(query: str) -> List[str]:
    """Generates context-aware visual filter pills for a given search query."""
    q_lower = query.lower()
    
    if "dolphin" in q_lower:
        return ["Close up shot", "Underwater pod", "Deep sea", "Jumping ocean", "Anatomical diagram", "4K Wallpaper", "Pacific Bottlenose"]
    elif "antimatter" in q_lower:
        return ["CERN accelerator", "Positron beam", "Quark interaction", "Particle collision", "Science diagram", "Universe origins"]
    elif "car" in q_lower or "automobile" in q_lower:
        return ["Side profile", "Interior cabin", "Engine bay", "Track performance", "Concept design", "Night aesthetic"]
    elif "space" in q_lower or "planet" in q_lower or "galaxy" in q_lower:
        return ["Hubble telescope", "James Webb 8K", "Surface terrain", "Orbit view", "Atmosphere glow", "Cosmic dust"]
    elif "cat" in q_lower or "dog" in q_lower or "animal" in q_lower:
        return ["Portrait close up", "In natural habitat", "Action shot", "Cute eyes", "High resolution"]
    
    clean_q = query.strip()
    return [
        f"{clean_q} close up",
        f"{clean_q} 4K wallpaper",
        f"{clean_q} diagram",
        f"{clean_q} natural environment",
        f"{clean_q} aesthetic view"
    ]

async def search_duckduckgo_images(query: str, limit: int = 24) -> Dict[str, Any]:
    """
    Performs a live Zero-OpEx Web Image Search (DuckDuckGo / Bing powered).
    Returns 24+ structured image items + topic suggestion pills.
    """
    clean_query = query.strip()
    encoded = urllib.parse.quote(clean_query)
    formatted_images = []
    
    # Primary Method: Bing / DuckDuckGo Async Web Scraping Endpoint (Zero API key / $0 OpEx)
    url = f"https://www.bing.com/images/async?q={encoded}&first=1&count={limit}&scenario=ImageBasicHover"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=HEADERS) as client:
            res = await client.get(url)
            if res.status_code == 200:
                matches = re.findall(r'm=["\'](\{.*?\})["\']', res.text)
                for m_str in matches:
                    clean_json = m_str.replace("&quot;", '"').replace("&amp;", "&")
                    try:
                        data = json.loads(clean_json)
                        murl = data.get("murl")      # Original image
                        turl = data.get("turl")      # Thumbnail image
                        purl = data.get("purl")      # Source website
                        title = data.get("t") or data.get("desc") or "Web Image"
                        
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
                                "width": data.get("ow", 1200),
                                "height": data.get("oh", 800)
                            })
                    except Exception:
                        pass
    except Exception as err:
        print(f"[-] Image search primary async fetch error: {err}")
        
    # Secondary Fallback: DDGS library if primary method yielded no images
    if not formatted_images:
        try:
            from duckduckgo_search import DDGS
            import asyncio
            
            def _fetch_ddg():
                with DDGS() as ddgs:
                    return list(ddgs.images(clean_query, max_results=limit))
                    
            ddg_results = await asyncio.to_thread(_fetch_ddg)
            for item in ddg_results:
                title = item.get("title", "Web Image")
                image_url = item.get("image", "")
                thumbnail_url = item.get("thumbnail", "")
                source_url = item.get("url", "")
                width = item.get("width", 0)
                height = item.get("height", 0)
                
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
        except Exception as fallback_err:
            print(f"[-] Image search fallback DDGS error: {fallback_err}")

    return {
        "query": clean_query,
        "count": len(formatted_images),
        "images": formatted_images[:limit],
        "pills": generate_suggestion_pills(clean_query)
    }
