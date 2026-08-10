import os
import re
import json
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from auth import get_current_user
from database import get_user_settings_profile, save_user_settings_profile
from models_schemas import WordDocCreateRequest, WordDocEditRequest, ConnectCustomMCPRequest

router = APIRouter(tags=["mcp"])


@router.get("/mcp/registry")
def get_mcp_registry(query: Optional[str] = None, user: str = Depends(get_current_user)):
    registry_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp_registry.json")
    if not os.path.exists(registry_path):
        return {"servers": [], "source": "curated", "total": 0}
    try:
        with open(registry_path, "r", encoding="utf-8") as f:
            servers = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read registry: {str(e)}")

    if query:
        q = query.lower()
        servers = [
            s for s in servers
            if q in s.get("name", "").lower() or q in s.get("description", "").lower() or q in s.get("category", "").lower()
        ]

    return {"servers": servers, "source": "curated", "total": len(servers)}


@router.post("/api/mcp/word/create")
async def mcp_word_create_endpoint(req: WordDocCreateRequest):
    from word_mcp import word_engine
    doc_state = word_engine.create_document(
        doc_id=req.doc_id,
        title=req.title,
        sections=req.sections,
        author=req.author,
        header_text=req.header_text,
        footer_text=req.footer_text,
        style=req.style
    )
    return {"status": "success", "data": doc_state}


@router.post("/api/mcp/word/edit")
async def mcp_word_edit_endpoint(req: WordDocEditRequest):
    from word_mcp import word_engine
    doc_state = word_engine.edit_document(
        doc_id=req.doc_id,
        target_heading_or_index=req.target_heading_or_index,
        action=req.action,
        new_content=req.new_content
    )
    return {"status": "success", "data": doc_state}


@router.get("/api/mcp/word/get/{doc_id}")
async def mcp_word_get_endpoint(doc_id: str):
    from word_mcp import word_engine
    history = word_engine.documents.get(doc_id, [])
    if not history:
        raise HTTPException(status_code=404, detail="Word document not found")
    return {"status": "success", "versions": history, "latest": history[-1]}


@router.post("/api/mcp/word/export-docx")
async def mcp_word_export_docx_endpoint(payload: Dict[str, Any]):
    from word_mcp import word_engine
    try:
        doc_state = payload.get("doc_state") or payload.get("activeDoc") or payload
        docx_bytes = word_engine.export_to_docx_bytes(doc_state)
        raw_title = doc_state.get("title") if isinstance(doc_state, dict) else "document"
        safe_filename = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(raw_title or "document")) + ".docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate docx file: {str(e)}")


@router.post("/api/mcp/connect-custom")
async def mcp_connect_custom_endpoint(req: ConnectCustomMCPRequest, user: str = Depends(get_current_user)):
    profile = get_user_settings_profile(user)
    mcp_conns = profile.get("mcp_connections", {})
    mcp_conns[req.provider] = {
        "connected": True,
        "name": req.name or req.provider.replace("_", " ").title(),
        "connected_at": datetime.utcnow().isoformat()
    }
    profile["mcp_connections"] = mcp_conns
    save_user_settings_profile(user, profile)
    return {"status": "connected", "provider": req.provider, "connections": mcp_conns}
