import asyncio
import httpx
import json
import urllib.parse

async def verify_pinterest_live(query="007 first light"):
    clean_q = query.strip()
    source_url = f"/search/pins/?q={urllib.parse.quote(clean_q)}"
    
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
            "query": clean_q,
            "scope": "pins",
            "page_size": 25
        },
        "context": {}
    }

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
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
        print("POST BaseSearchResource Status:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            results = data.get("resource_response", {}).get("data", {}).get("results", [])
            print(f"\n==================================================")
            print(f"SUCCESS! Retrieved {len(results)} AUTHENTIC PINTEREST PINS for '{clean_q}'!")
            print(f"==================================================\n")
            
            formatted = []
            for idx, p in enumerate(results):
                if isinstance(p, dict):
                    p_id = p.get("id")
                    title = p.get("title") or p.get("grid_title") or p.get("description") or f"{clean_q.capitalize()} Pin"
                    imgs = p.get("images", {})
                    orig = imgs.get("orig", {}).get("url") or imgs.get("736x", {}).get("url") or imgs.get("474x", {}).get("url")
                    
                    if orig:
                        formatted.append({
                            "id": p_id,
                            "title": title.strip(),
                            "image_url": orig,
                            "source_url": f"https://www.pinterest.com/pin/{p_id}/" if p_id else f"https://in.pinterest.com/search/pins/?q={urllib.parse.quote(clean_q)}&rs=typed"
                        })
                        print(f"[{idx+1}] Pin ID: {p_id}")
                        print(f"    Title: {title.strip()[:80]}")
                        print(f"    Image: {orig}")
                        print(f"    Link:  https://www.pinterest.com/pin/{p_id}/\n")

if __name__ == "__main__":
    asyncio.run(verify_pinterest_live("007 first light"))
