import httpx
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import StreamingResponse

from auth import get_current_user
from opencode_client import list_opencode_models
from kilo_client import fetch_kilo_models

router = APIRouter(tags=["models"])


@router.get("/models")
def get_models(user: str = Depends(get_current_user)):
    return list_opencode_models()


@router.get("/models/kilo")
async def get_kilo_models_endpoint(kilo_api_key: str = Query(None), user: str = Depends(get_current_user)):
    if not kilo_api_key:
        return []
    return await fetch_kilo_models(kilo_api_key)


@router.post("/completions/proxy")
async def completions_proxy(
    body: dict,
    authorization: Optional[str] = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=400, detail="Missing Authorization header")

    is_kilo = False
    model_str = body.get("model", "")
    auth_lower = (authorization or "").lower()
    if "/" in model_str or "kilo" in model_str.lower() or auth_lower.startswith("bearer kilo_") or auth_lower.startswith("bearer kl-"):
        is_kilo = True

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            try:
                url = "https://api.kilo.ai/api/gateway/chat/completions" if is_kilo else "https://opencode.ai/zen/v1/chat/completions"

                last_err = ""
                for attempt in range(3):
                    try:
                        async with client.stream(
                            "POST",
                            url,
                            headers={
                                "Content-Type": "application/json",
                                "Authorization": authorization
                            },
                            json=body,
                            timeout=60.0
                        ) as response:
                            if response.status_code == 200:
                                async for chunk in response.aiter_bytes():
                                    yield chunk
                                return
                            else:
                                err_bytes = await response.aread()
                                last_err = f"HTTP {response.status_code}: {err_bytes.decode(errors='ignore')}"
                                if response.status_code == 429:
                                    await asyncio.sleep(2.0)
                    except Exception as e:
                        last_err = str(e)
                        await asyncio.sleep(2.0)

                yield f"data: Error (Proxy Retry Failure): {last_err}\n\n".encode()
            except Exception as e:
                yield f"data: Error (Proxy Exception): {str(e)}\n\n".encode()

    return StreamingResponse(stream_generator(), media_type="text/event-stream")
