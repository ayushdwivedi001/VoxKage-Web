import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import (
    ALLOWED_ORIGINS,
    csrf_origin_validation_middleware,
    websocket_heartbeat_loop
)

# Routers
from routers.health_router import router as health_router
from routers.auth_router import router as auth_router
from routers.user_router import router as user_router
from routers.sessions_router import router as sessions_router
from routers.schedules_router import router as schedules_router
from routers.mcp_router import router as mcp_router
from routers.media_router import router as media_router
from routers.models_router import router as models_router
from routers.websocket_router import router as websocket_router

app = FastAPI(title="VoxKage Web API", version="2026.06.30")

# Mount Static Uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(csrf_origin_validation_middleware)

# Register Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(sessions_router)
app.include_router(schedules_router)
app.include_router(mcp_router)
app.include_router(media_router)
app.include_router(models_router)
app.include_router(websocket_router)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(websocket_heartbeat_loop())
    try:
        from scheduler import start_scheduler
        await start_scheduler()
    except Exception as e:
        print(f"[-] Failed to start background scheduler: {e}")
