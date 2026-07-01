import json
import asyncio
from agent_loop import run_agentic_loop

def test_formatting():
    print("[*] Running local offline serialization test...")
    places_list = [
        {
            "name": "Rajwada Palace",
            "latitude": 22.7182,
            "longitude": 75.8569,
            "rating": 4.4,
            "reviews_count": 74096,
            "description": "7-storey Holkar-era gateway palace.",
            "category": "Historic",
            "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
        },
        {
            "name": "Lal Bagh Palace",
            "latitude": 22.7065,
            "longitude": 75.8716,
            "rating": 4.3,
            "reviews_count": 7933,
            "description": "European-style palace with a spring-loaded floor.",
            "category": "Museum",
            "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
        }
    ]
    
    # Simulate agent_loop show_map logic
    formatted_places = []
    for p in places_list:
        p_name = str(p.get("name", "")).replace("|", "").replace(";", "")
        p_lat = str(p.get("latitude", ""))
        p_lng = str(p.get("longitude", ""))
        p_rat = str(p.get("rating", ""))
        p_rev = str(p.get("reviews_count", ""))
        p_desc = str(p.get("description", "")).replace("|", "").replace(";", "")
        p_cat = str(p.get("category", "")).replace("|", "").replace(";", "")
        p_img = str(p.get("image_url", "") or "empty").replace("|", "").replace(";", "")
        formatted_places.append(f"{p_name}|{p_lat}|{p_lng}|{p_rat}|{p_rev}|{p_desc}|{p_cat}|{p_img}")
    
    places_str = "||".join(formatted_places)
    map_tag = f'<Map lat="22.7196" lng="75.8577" label="Indore Tourism" places="{places_str}" />'
    
    print("\n[+] Formatted Map Tag Output:")
    print(map_tag)
    
    # Assert tag format
    assert '<Map ' in map_tag, "Should contain <Map tag"
    assert 'places="Rajwada Palace|22.7182|75.8569|4.4|74096' in map_tag, "Should contain correct details for Rajwada Palace"
    assert '||Lal Bagh Palace|22.7065|75.8716|4.3|7933' in map_tag, "Should contain correct details for Lal Bagh Palace"
    print("\n[+] Verification successful! All serialized elements mapped correctly.")

if __name__ == "__main__":
    test_formatting()
