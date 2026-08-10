import asyncio
from fastapi import APIRouter, Depends

from auth import get_current_user
from database import (
    get_user_favorites, save_user_favorites,
    get_user_settings_profile, save_user_settings_profile
)
from memory_engine import recall_user
from opencode_client import list_opencode_models
from tool_schemas import TOOLS_SCHEMA
from models_schemas import SaveFavoritesRequest, SaveSettingsProfileRequest

router = APIRouter(tags=["user"])


@router.get("/user/boot-payload")
async def get_boot_payload(user: str = Depends(get_current_user)):
    async def fetch_soul():
        return await asyncio.to_thread(recall_user, user, "")
    async def fetch_profile():
        return await asyncio.to_thread(get_user_settings_profile, user)
    async def fetch_favorites():
        return await asyncio.to_thread(get_user_favorites, user)

    soul_context, profile, favorites = await asyncio.gather(
        fetch_soul(),
        fetch_profile(),
        fetch_favorites()
    )

    mcp_info = ""
    mcp_tools = []
    connections = profile.get("mcp_connections") or {}
    if connections:
        mcp_info = "\n--- ACTIVE MCP CONNECTIONS ---\n"
        for provider, conn in connections.items():
            if provider == "gmail":
                mcp_info += (
                    "- Gmail is connected and fully authenticated via OAuth.\n"
                    "  You MUST use the 'gmail__search_threads', 'gmail__get_thread', 'gmail__create_draft', 'gmail__list_drafts', and 'gmail__list_labels' tools to access and manage the user's mailbox.\n"
                    "  Do not claim you cannot access emails, do not ask the user for passwords/credentials, and do not suggest opening a browser/laptop client; execute the tools directly.\n"
                )
                from mcp_servers.gmail.gmail_mcp import GMAIL_TOOLS
                tools_list = GMAIL_TOOLS
            elif provider in ("microsoft_word", "word"):
                mcp_info += (
                    "- Microsoft Word (VoxKage Custom MCP) is connected.\n"
                    "  You MUST use 'microsoft_word__create_word_document', 'microsoft_word__edit_word_document', 'microsoft_word__get_word_document', and 'microsoft_word__export_word_document' tools to create, view, edit, and export formatted .docx Word documents.\n"
                    "  Do not claim you cannot create or edit Word documents; call the Microsoft Word tools directly.\n"
                )
                from word_mcp import WORD_TOOLS
                tools_list = WORD_TOOLS
            else:
                mcp_info += f"- {provider.title()} is connected.\n"
                tools_list = conn.get("tools") if isinstance(conn.get("tools"), list) and conn["tools"] and isinstance(conn["tools"][0], dict) else []

            for t in tools_list:
                mcp_tools.append({
                    "type": "function",
                    "function": {
                        "name": f"{provider}__{t['name']}",
                        "description": f"[{provider.upper()} MCP] {t['description']}",
                        "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}
                    }
                })

    models = list_opencode_models()

    return {
        "user_name": profile.get("userName") or profile.get("user_name") or "",
        "avatar_url": profile.get("avatar_url") or profile.get("avatarUrl") or "",
        "custom_proxy_url": profile.get("custom_proxy_url") or profile.get("customProxyUrl") or "",
        "selected_model": profile.get("selected_model") or profile.get("selectedModel") or "DeepSeek V4 Flash",
        "selected_variant": profile.get("selected_variant") or profile.get("selectedVariant") or "Max",
        "build_mode": profile.get("build_mode") or profile.get("buildMode") or "Work",
        "theme_mode": profile.get("theme_mode") or "",
        "soul_context": soul_context,
        "mcp_connections": list(connections.keys()),
        "mcp_tools": TOOLS_SCHEMA + mcp_tools,
        "mcp_info": mcp_info,
        "favorites": favorites,
        "models": models
    }


@router.get("/user/favorites")
def get_favorites(user: str = Depends(get_current_user)):
    return {"favorite_models": get_user_favorites(user)}


@router.post("/user/favorites")
def save_favorites(
    req: SaveFavoritesRequest,
    user: str = Depends(get_current_user)
):
    saved_favs = save_user_favorites(user, req.favorites)
    return {"favorite_models": saved_favs}


@router.get("/user/settings-profile")
def get_settings_profile(user: str = Depends(get_current_user)):
    profile = get_user_settings_profile(user)
    if not isinstance(profile, dict):
        profile = {}
    profile["user_id"] = user
    return {"settings_profile": profile}


@router.post("/user/settings-profile")
def save_settings_profile(
    req: SaveSettingsProfileRequest,
    user: str = Depends(get_current_user)
):
    existing = get_user_settings_profile(user)
    if not isinstance(existing, dict):
        existing = {}

    profile = req.settings_profile
    if not isinstance(profile, dict):
        profile = {}

    merged = {**existing, **profile}
    merged["user_id"] = user
    saved_profile = save_user_settings_profile(user, merged)
    return {"settings_profile": saved_profile}
