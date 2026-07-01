import asyncio
import os
import sys
from dotenv import load_dotenv

# Load local environment variables from backend/.env BEFORE imports
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_path)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from image_engine import fetch_verified_images

async def main():
    query = "humpback whale"
    print(f"[*] Testing fetch_verified_images with query: '{query}'")
    print(f"[*] Pexels API Key loaded: {os.getenv('PEXELS_API_KEY') is not None}")
    
    # Verify with limit of 3 images
    urls = await fetch_verified_images(query, limit=3)
    
    print("\n[+] Verification Results:")
    if not urls:
        print("[-] FAILED: No image URLs returned.")
    else:
        for idx, url in enumerate(urls):
            print(f"    {idx + 1}. {url}")
        print(f"[+] SUCCESS: Retrieved {len(urls)} active image URLs.")

if __name__ == "__main__":
    asyncio.run(main())
