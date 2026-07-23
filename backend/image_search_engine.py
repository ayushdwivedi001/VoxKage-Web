import re
import json
import httpx
import urllib.parse
from typing import List, Dict, Any

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
}

def generate_suggestion_pills(query: str) -> List[str]:
    """Generates context-aware visual filter pills for a given search query."""
    q_lower = query.lower()
    
    if "skeleton" in q_lower or "inner" in q_lower or "anatomy" in q_lower:
        return ["Anatomy X-Ray", "Bone Structure", "Internal Organ Layout", "Skull Anatomy", "Vertebrae Column", "3D Skeletal Render"]
    elif "dolphin" in q_lower:
        return ["Inner Skeleton", "Close up shot", "Underwater pod", "Deep sea", "Jumping ocean", "Pacific Bottlenose"]
    elif "antimatter" in q_lower:
        return ["CERN accelerator", "Positron beam", "Quark interaction", "Particle collision", "Science diagram", "Universe origins"]
    elif "car" in q_lower or "automobile" in q_lower:
        return ["Side profile", "Interior cabin", "Engine bay", "Track performance", "Concept design", "Night aesthetic"]
    elif "space" in q_lower or "planet" in q_lower or "galaxy" in q_lower:
        return ["Hubble telescope", "James Webb 8K", "Surface terrain", "Orbit view", "Atmosphere glow", "Cosmic dust"]
    
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
    Performs an exact live DuckDuckGo Image Search via DDG's i.js endpoint.
    Returns 24+ structured image items + topic suggestion pills.
    """
    clean_query = query.strip()
    encoded = urllib.parse.quote(clean_query)
    formatted_images = []
    
    # Primary Method: Direct DuckDuckGo i.js Search Protocol
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=HEADERS) as client:
            token_res = await client.get(f"https://duckduckgo.com/?q={encoded}&iar=images&t=h_")
            if token_res.status_code == 200:
                vqd_match = re.search(r'vqd=["\']([^"\']+)["\']', token_res.text) or re.search(r"vqd=([\d-]+)", token_res.text) or re.search(r'vqd=([a-zA-Z0-9_-]+)', token_res.text)
                vqd = vqd_match.group(1) if vqd_match else None
                
                if vqd:
                    i_url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={encoded}&vqd={vqd}&f=,,,&p=1"
                    headers_i = {
                        **HEADERS,
                        "Referer": f"https://duckduckgo.com/?q={encoded}&iar=images&t=h_",
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
        print(f"[-] DDG i.js primary search error: {err}")
        
    # Secondary Fallback: Bing Async endpoint if DDG primary yielded no images
    if not formatted_images:
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
                            murl = data.get("murl")
                            turl = data.get("turl")
                            purl = data.get("purl")
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
            print(f"[-] Image search secondary fallback error: {err}")

    return {
        "query": clean_query,
        "count": len(formatted_images),
        "images": formatted_images[:limit],
        "pills": generate_suggestion_pills(clean_query)
    }
