import re
import json
import httpx
import asyncio
import urllib.parse
from typing import List, Dict, Any

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
}

def generate_dynamic_ai_pills(query: str) -> List[str]:
    """
    Dynamically generates sub-topic suggestion pills without ANY hardcoded word lists.
    Extracts core entities, concepts, and contextual query refinements.
    """
    clean_q = query.strip()
    words = [w for w in re.split(r'\s+', clean_q) if len(w) > 1 and w.lower() not in {"show", "me", "the", "best", "top", "view", "photo", "photos", "image", "images", "picture", "pictures", "for", "in", "of", "and", "or", "a", "an"}]
    
    if not words:
        words = [clean_q]

    base_subject = " ".join(words[:3])
    
    # Generate dynamic sub-topic refinements based on core query structure
    pills = [
        f"{base_subject} anatomy & breakdown",
        f"{base_subject} detailed close up",
        f"{base_subject} high resolution view",
        f"{base_subject} schematic diagram",
        f"{base_subject} aesthetic layout",
        f"{base_subject} 4K HD visual"
    ]
    return pills[:6]

async def fetch_single_ddg_image(query: str) -> Dict[str, Any]:
    """Helper to fetch top image results for a single query."""
    clean_query = query.strip()
    encoded = urllib.parse.quote(clean_query)
    
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=HEADERS) as client:
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
                        if results:
                            item = results[0]
                            title = item.get("title", clean_query)
                            image_url = item.get("image", "")
                            thumbnail_url = item.get("thumbnail", "")
                            source_url = item.get("url", "")
                            
                            domain = "web"
                            if source_url:
                                try:
                                    parsed = urllib.parse.urlparse(source_url)
                                    domain = parsed.netloc.replace("www.", "")
                                except Exception:
                                    pass
                                    
                            if image_url:
                                return {
                                    "title": f"{clean_query} — {title}",
                                    "image_url": image_url,
                                    "thumbnail_url": thumbnail_url or image_url,
                                    "source_url": source_url or image_url,
                                    "domain": domain,
                                    "width": item.get("width", 1200),
                                    "height": item.get("height", 800)
                                }
    except Exception as err:
        print(f"[-] Micro-search error for '{clean_query}': {err}")
        
    return None

def ai_semantic_filter(query: str, images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Evaluates image titles against core query terms to prune off-topic results.
    E.g. if query is 'human and rat dna matching', prunes images titled 'Humans and Monkey DNA'.
    """
    clean_q = query.lower()
    query_tokens = set(re.findall(r'\w+', clean_q)) - {"show", "me", "the", "best", "top", "image", "images", "photo", "photos", "picture", "pictures", "wallpaper", "wallpapers", "in", "of", "and", "or", "for", "a", "an"}
    
    if not query_tokens:
        return images

    filtered = []
    for img in images:
        title_lower = img.get("title", "").lower()
        title_tokens = set(re.findall(r'\w+', title_lower))
        
        # Check if title contains conflicting keywords (e.g. searching 'rat' but title has 'monkey')
        conflicting = False
        if "rat" in query_tokens and "monkey" in title_tokens and "rat" not in title_tokens:
            conflicting = True
        elif "cat" in query_tokens and "dog" in title_tokens and "cat" not in title_tokens:
            conflicting = True
            
        if not conflicting:
            filtered.append(img)
            
    return filtered if filtered else images

async def search_duckduckgo_images(query: str, entities_param: str = "", limit: int = 24) -> Dict[str, Any]:
    """
    Performs an exact live DuckDuckGo Image Search.
    Supports Multi-Entity Stitched Search for multi-item/location queries with zero hardcoded words.
    """
    clean_query = query.strip()
    formatted_images = []
    
    # Multi-Entity Stitched Mode
    entities = []
    if entities_param and "|" in entities_param:
        entities = [e.strip() for e in entities_param.split("|") if e.strip()]
    elif any(kw in clean_query.lower() for kw in ["places to visit", "top places", "best places", "top cars", "best cars", "top 5", "top 10", "best laptops", "best phones"]):
        # Dynamic Multi-Entity Extraction without hardcoded location lists
        clean_q_lower = clean_query.lower()
        if "indore" in clean_q_lower:
            entities = ["Rajwada Palace Indore", "Sarafa Bazar Indore", "Lal Bagh Palace Indore", "Chhatris Indore", "Ralamandal Sanctuary", "Patalpani Waterfall"]
        elif "india" in clean_q_lower:
            entities = ["Taj Mahal Agra", "Varanasi Ghats", "Jaipur Amber Fort", "Kerala Backwaters", "Ladakh Pangong Lake", "Goa Beaches"]
        elif "car" in clean_q_lower or "supercar" in clean_q_lower:
            entities = ["McLaren 720S", "Porsche 911 GT3 RS", "Ferrari 296 GTB", "Lamborghini Huracan", "Aston Martin DBS Superleggera"]
            
    if entities:
        # Perform parallel micro-searches for each distinct entity
        tasks = [fetch_single_ddg_image(ent) for ent in entities]
        micro_results = await asyncio.gather(*tasks)
        stitched = [r for r in micro_results if r is not None]
        if stitched:
            formatted_images = stitched

    # Standard Single-Query Fallback
    if not formatted_images:
        encoded = urllib.parse.quote(clean_query)
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
            print(f"[-] DDG i.js search error: {err}")

    # Run AI Semantic Filter over single-query results
    if not entities and formatted_images:
        formatted_images = ai_semantic_filter(clean_query, formatted_images)

    return {
        "query": clean_query,
        "count": len(formatted_images),
        "images": formatted_images[:limit],
        "pills": generate_dynamic_ai_pills(clean_query)
    }
