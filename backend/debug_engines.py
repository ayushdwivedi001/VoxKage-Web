import asyncio
import httpx
import json
import urllib.parse

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "X-Pinterest-AppState": "active"
}

async def test_pinterest_unauth_react(query="007 first light game"):
    clean_query = query.strip()
    source_url = f"/search/pins/?q={urllib.parse.quote(clean_query)}"
    
    data_payload = {
        "options": {
            "isPrefetch": False,
            "query": clean_query,
            "scope": "pins",
            "no_fetch_context": False,
            "field_set_key": "unauth_react"
        },
        "context": {}
    }
    
    encoded_source = urllib.parse.quote(source_url)
    encoded_data = urllib.parse.quote(json.dumps(data_payload))
    
    url = f"https://www.pinterest.com/resource/BaseSearchResource/get/?source_url={encoded_source}&data={encoded_data}"
    
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        # Get session cookies
        r1 = await client.get("https://www.pinterest.com/", headers={"User-Agent": HEADERS["User-Agent"]})
        csrf = client.cookies.get("csrftoken") or ""
        
        headers = {
            **HEADERS,
            "Referer": f"https://www.pinterest.com{source_url}",
            "X-CSRFToken": csrf
        }
        
        res = await client.get(url, headers=headers)
        print("BaseSearchResource status:", res.status_code)
        if res.status_code == 200:
            resp_data = res.json()
            results = resp_data.get("resource_response", {}).get("data", {}).get("results", [])
            print(f"BaseSearchResource returned {len(results)} REAL PINS for '{clean_query}'!")
            if results:
                for item in results[:3]:
                    if isinstance(item, dict):
                        print(" - Pin Title:", item.get("title") or item.get("grid_title"))
                        print("   Pin Image:", item.get("images", {}).get("orig", {}).get("url") or item.get("images", {}).get("736x", {}).get("url"))
        else:
            print("Response text:", res.text[:200])

if __name__ == "__main__":
    asyncio.run(test_pinterest_unauth_react("007 first light game"))
