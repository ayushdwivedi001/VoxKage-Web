import re
import json
import httpx
import os
from urllib.parse import quote

async def get_images_from_pexels(query: str, limit: int = 5) -> list[str]:
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        print("[*] Pexels API key not configured.")
        return []
    
    headers = {
        "Authorization": api_key
    }
    url = f"https://api.pexels.com/v1/search?query={quote(query)}&per_page={limit}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                photos = data.get("photos", [])
                urls = []
                for photo in photos:
                    img_url = photo.get("src", {}).get("large")
                    if img_url:
                        urls.append(img_url)
                print(f"[+] Found {len(urls)} images from Pexels.")
                return urls
            else:
                print(f"[-] Pexels API returned HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[-] Pexels fetch failed: {e}")
    return []

async def get_images_from_ddg(query: str, limit: int = 5) -> list[str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            # 1. Fetch main page to get vqd token
            res = await client.get(f"https://duckduckgo.com/?q={quote(query)}&iax=images&ia=images")
            if res.status_code != 200:
                print(f"[-] DDG main page returned HTTP {res.status_code}")
                return []
            
            # Find vqd token via regex
            match = re.search(r'vqd=([^&\'"]+)', res.text)
            if not match:
                # Try search in script tags
                match = re.search(r'vqd\s*=\s*["\']([^"\']+)["\']', res.text)
            
            if not match:
                print("[-] Could not find DDG vqd token.")
                return []
            
            vqd = match.group(1)
            
            # 2. Call the i.js image search endpoint
            img_url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={quote(query)}&vqd={vqd}&f=,,,&p=1"
            res2 = await client.get(img_url)
            if res2.status_code == 200:
                data = res2.json()
                results = data.get("results", [])
                image_urls = []
                for r in results:
                    img_src = r.get("image")
                    if img_src:
                        image_urls.append(img_src)
                    if len(image_urls) >= limit:
                        break
                print(f"[+] Found {len(image_urls)} images from DuckDuckGo.")
                return image_urls
            else:
                print(f"[-] DDG image API returned HTTP {res2.status_code}")
    except Exception as e:
        print(f"[-] DuckDuckGo image fetch failed: {e}")
    return []

async def fetch_verified_images(query: str, limit: int = 5) -> list[str]:
    print(f"[*] Starting image search for: '{query}' (limit: {limit})...")
    # Try Pexels first (since it's higher quality stock images)
    urls = await get_images_from_pexels(query, limit)
    if not urls:
        print("[*] Falling back to DuckDuckGo Image Search...")
        # Fall back to DuckDuckGo Image Search
        urls = await get_images_from_ddg(query, limit)
        
    # Verify image URLs via quick HEAD checks to make sure they are active
    verified_urls = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        for url in urls:
            try:
                # Use weserv proxy to test if the URL will load
                test_url = f"https://images.weserv.nl/?url={quote(url)}&w=10"
                res = await client.head(test_url, follow_redirects=True)
                if res.status_code < 400:
                    verified_urls.append(url)
                if len(verified_urls) >= limit:
                    break
            except Exception as e:
                print(f"[*] Weserv check failed for {url}: {e}. Appending anyway with frontend fallback.")
                verified_urls.append(url)
                if len(verified_urls) >= limit:
                    break
                    
    print(f"[+] Returning {len(verified_urls)} verified image URLs.")
    return verified_urls
