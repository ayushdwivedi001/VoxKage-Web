import httpx
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import Response, RedirectResponse

from image_search_engine import search_pinterest_images, search_related_pinterest_pins

router = APIRouter(tags=["media"])


@router.get("/api/search/images")
async def search_images_endpoint(query: str, limit: int = 24):
    return await search_pinterest_images(query=query, limit=limit)


@router.get("/api/search/pinterest")
async def search_pinterest_endpoint(query: str, limit: int = 24):
    return await search_pinterest_images(query=query, limit=limit)


@router.get("/api/search/images/related")
async def search_images_related_endpoint(
    title: str = "",
    image_url: str = "",
    initial_query: str = "",
    model: Optional[str] = None,
    provider: Optional[str] = "opencode",
    limit: int = 24
):
    return await search_related_pinterest_pins(
        pin_id="",
        query=title or initial_query,
        initial_query=initial_query,
        image_title=title,
        image_url=image_url,
        selected_model=model or "DeepSeek V4 Flash",
        provider=provider or "opencode",
        limit=limit
    )


@router.get("/api/search/pinterest/related")
async def search_pinterest_related_endpoint(
    pin_id: str = "",
    query: str = "",
    initial_query: str = "",
    image_title: str = "",
    image_url: str = "",
    model: Optional[str] = None,
    provider: Optional[str] = "opencode",
    limit: int = 24
):
    return await search_related_pinterest_pins(
        pin_id=pin_id,
        query=query,
        initial_query=initial_query,
        image_title=image_title,
        image_url=image_url,
        selected_model=model or "DeepSeek V4 Flash",
        provider=provider or "opencode",
        limit=limit
    )


@router.get("/api/image-proxy")
async def image_proxy_endpoint(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": url,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/jpeg")
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400"}
                )
    except Exception as e:
        print(f"Image proxy error for {url}: {e}")

    return RedirectResponse(url=url)
