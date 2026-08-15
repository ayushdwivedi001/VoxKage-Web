import os
import time
import uuid
import shutil
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from auth import get_current_user
from database import (
    list_sessions, create_session, get_session, get_session_messages,
    delete_session, update_session_name, toggle_session_star, log_message,
    edit_message_and_truncate, log_message_feedback_db
)
from config import calculate_context_percent, manager
from models_schemas import (
    PreparePayloadRequest, ExecuteToolsRequest, LogAssistantResponseRequest,
    EditMessageRequest, FeedbackRequest
)

router = APIRouter(tags=["sessions"])


@router.get("/sessions")
def get_sessions(user: str = Depends(get_current_user)):
    return list_sessions(user)


@router.post("/sessions")
def post_session(name: str = "New Chat", user: str = Depends(get_current_user)):
    return create_session(user, name)


@router.get("/sessions/{session_id}")
def get_single_session(session_id: str, user: str = Depends(get_current_user)):
    session = get_session(session_id, user)
    messages = get_session_messages(session_id)
    percent = calculate_context_percent(messages)
    return {"session": session, "messages": messages, "context_percent": percent}


@router.post("/sessions/{session_id}/upload")
async def upload_session_file(
    session_id: str,
    file: UploadFile = File(...),
    user: str = Depends(get_current_user)
):
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 50MB.")

    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:6]
    safe_filename = f"{timestamp}-{unique_id}-{file.filename}"

    session_dir = os.path.join("uploads", str(session_id))
    os.makedirs(session_dir, exist_ok=True)
    file_path = os.path.join(session_dir, safe_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    num_pages = None
    _, ext = os.path.splitext(file.filename.lower())
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            num_pages = len(reader.pages)
        except Exception as e:
            print(f"Error reading PDF page count: {e}")

    url = f"/uploads/{session_id}/{safe_filename}"

    return {
        "filename": safe_filename,
        "original_name": file.filename,
        "url": url,
        "type": file.content_type or "application/octet-stream",
        "size": size,
        "num_pages": num_pages
    }


@router.delete("/sessions/{session_id}/files/{filename}")
def delete_session_file(session_id: str, filename: str, user: str = Depends(get_current_user)):
    file_path = os.path.join("uploads", str(session_id), filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return {"status": "success", "detail": f"File {filename} deleted."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
    raise HTTPException(status_code=404, detail="File not found.")


@router.post("/sessions/{session_id}/adopt-draft/{draft_id}")
def adopt_draft_files(session_id: str, draft_id: str, user: str = Depends(get_current_user)):
    draft_dir = os.path.join("uploads", str(draft_id))
    session_dir = os.path.join("uploads", str(session_id))
    if os.path.exists(draft_dir):
        os.makedirs(session_dir, exist_ok=True)
        for filename in os.listdir(draft_dir):
            src = os.path.join(draft_dir, filename)
            dst = os.path.join(session_dir, filename)
            if os.path.exists(dst):
                os.remove(dst)
            shutil.move(src, dst)
        try:
            shutil.rmtree(draft_dir)
        except Exception:
            pass
        return {"status": "success", "detail": "Draft files adopted successfully."}
    return {"status": "success", "detail": "No draft files to adopt."}


@router.delete("/sessions/{session_id}")
def delete_single_session(session_id: str, user: str = Depends(get_current_user)):
    res = delete_session(session_id, user)

    session_dir = os.path.join("uploads", str(session_id))
    if os.path.exists(session_dir):
        try:
            shutil.rmtree(session_dir)
            print(f"[+] Cleaned up uploads folder for deleted session: {session_id}")
        except Exception as e:
            print(f"[-] Failed to delete uploads folder: {e}")

    return res


@router.put("/sessions/{session_id}/rename")
def rename_session(session_id: str, name: str, user: str = Depends(get_current_user)):
    return update_session_name(session_id, user, name)


@router.put("/sessions/{session_id}/star")
def star_session_endpoint(session_id: str, starred: bool, user: str = Depends(get_current_user)):
    return toggle_session_star(session_id, user, starred)


@router.post("/sessions/{session_id}/prepare")
async def prepare_agent_payload(
    session_id: str,
    req: PreparePayloadRequest,
    user: str = Depends(get_current_user)
):
    from opencode_client import get_opencode_model, sanitize_history_roles, get_system_prompt
    from memory_engine import recall_user

    query = req.message.strip()
    enriched_query_parts = []

    for att in req.attachments:
        fn = att.get("filename")
        on = att.get("original_name")
        file_path = os.path.join("uploads", str(session_id), fn)
        if not os.path.exists(file_path):
            file_path = os.path.join("uploads", fn)
        if os.path.exists(file_path):
            try:
                from rag_parser import extract_text_async
                extracted_text = await extract_text_async(file_path, model=req.model)
                enriched_query_parts.append(
                    f"--- ATTACHED FILE: {on} ---\n"
                    f"{extracted_text}\n"
                    f"--------------------------------------"
                )
            except Exception as extract_err:
                print(f"Error extracting text from attachment {fn}: {extract_err}")

    if enriched_query_parts:
        context_header = "\n\n".join(enriched_query_parts)
        model_query = f"{context_header}\n\nUser Question:\n{query}"
    else:
        model_query = query

    db_content = query
    if req.attachments:
        attachments_xml_parts = ["<attachments>"]
        for att in req.attachments:
            fn_esc = att.get("filename", "").replace('"', '&quot;')
            on_esc = att.get("original_name", "").replace('"', '&quot;')
            url_esc = att.get("url", "").replace('"', '&quot;')
            tp_esc = att.get("type", "").replace('"', '&quot;')
            sz_esc = str(att.get("size", 0))
            pg_esc = str(att.get("num_pages", ""))
            attachments_xml_parts.append(
                f'  <attachment filename="{fn_esc}" original_name="{on_esc}" url="{url_esc}" type="{tp_esc}" size="{sz_esc}" num_pages="{pg_esc}" />'
            )
        attachments_xml_parts.append("</attachments>")
        db_content = f"{query}\n\n" + "\n".join(attachments_xml_parts)

    async def fetch_history():
        return await asyncio.to_thread(get_session_messages, session_id)

    async def fetch_soul():
        return await asyncio.to_thread(recall_user, user, "")

    async def fetch_profile():
        from database import get_user_settings_profile
        return await asyncio.to_thread(get_user_settings_profile, user)

    messages_history, soul_context, profile = await asyncio.gather(
        fetch_history(),
        fetch_soul(),
        fetch_profile()
    )

    asyncio.create_task(asyncio.to_thread(log_message, session_id, "user", db_content))

    current_time_str = req.client_time or datetime.now().strftime("%A, %B %d, %Y, %I:%M:%S %p")

    system_prompt = get_system_prompt()

    mcp_info = ""
    mcp_tools = []
    if profile:
        try:
            connections = profile.get("mcp_connections") or {}
            print(f"[*] /prepare user: {user}, active mcp connections: {list(connections.keys())}")
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
                            "  WORKFLOW: After calling create_word_document, ALWAYS call get_word_document with the same doc_id to verify all sections were properly stored, then report to the user exactly what was created.\n"
                            "  Always mention the exact filename (doc_id + '.docx') in your response so the artifact panel can detect and display it.\n"
                        )
                        from word_mcp import WORD_TOOLS
                        tools_list = WORD_TOOLS
                    else:
                        mcp_info += f"- {provider.title()} is connected.\n"
                        tools_list = conn.get("tools") if isinstance(conn.get("tools"), list) and conn["tools"] and isinstance(conn["tools"][0], dict) else []

                    if not req.skip_tools:
                        for t in tools_list:
                            mcp_tools.append({
                                "type": "function",
                                "function": {
                                    "name": f"{provider}__{t['name']}",
                                    "description": f"[{provider.upper()} MCP] {t['description']}",
                                    "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}
                                }
                            })
        except Exception as e:
            print(f"[-] Failed to get MCP info/tools for /prepare: {e}")

    system_prompt += (
        f"\n\n--- DYNAMIC SESSION CONTEXT ---\n"
        f"The current local date and time is {current_time_str}. Use this exact timestamp when answering any queries. Never guess the time.\n"
        f"{mcp_info}"
        f"--- USER SOUL PROFILE MEMORIES ---\n{soul_context}\n\n"
    )

    if req.plan_mode:
        system_prompt += (
            "\n\n--- PLAN MODE ACTIVE ---\n"
            "The user has selected PLAN MODE. Your response MUST be a clear, comprehensive implementation plan only.\n\n"
            "STRICT RULES FOR PLAN GENERATION:\n"
            "1. RESEARCH QUERIES: Do NOT execute web_search, web_fetch, or external search tools during plan generation. Outline what topics, search queries, and tools VoxKage will use during the execution phase instead.\n"
            "2. EXISTING CODE QUERIES: You MAY inspect/read existing files to analyze codebase structure, but do NOT edit, write, or modify any files during plan generation.\n"
            "3. FRESH PROJECT / FEATURE IDEAS: Outline the full architecture, file structure, component hierarchy, tech stack, and step-by-step build strategy.\n\n"
            "MANDATORY FORMAT:\n"
            "- Wrap your ENTIRE plan output inside <plan title=\"Display Title of the Plan\">...</plan> XML tags.\n"
            "- Inside <plan>, use clean Markdown: ## Headings, ### Subheadings, bullet lists, numbered steps, and formatted markdown tables.\n"
            "- Do NOT output <task_list> tags during Plan Mode. (Task lists are created when the user clicks Proceed in Work Mode).\n"
            "Never skip the <plan title=\"...\"> tags.\n"
        )
    else:
        system_prompt += (
            "\n\n--- WORK MODE ACTIVE ---\n"
            "You are in WORK MODE. Execute tasks directly using tool calls and clear answers.\n"
            "Do NOT output <plan> or implementation plan tags in Work Mode.\n"
            "If the user message begins with [PROCEED: ...] or asks to execute an approved plan:\n"
            "1. Output a concise <task_list> block at the beginning of your text response:\n"
            "   <task_list>\n"
            "   - [ ] Task 1: Concise summary\n"
            "   - [ ] Task 2: Concise summary\n"
            "   - [ ] Task 3: Concise summary\n"
            "   </task_list>\n"
            "2. Immediately proceed with executing the work and calling tools.\n"
        )

    messages = [{"role": "system", "content": system_prompt}]
    formatted_history = []
    for msg in messages_history:
        formatted_history.append({"role": msg["role"], "content": msg["content"]})

    for msg in sanitize_history_roles(formatted_history):
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": model_query})

    if req.model and ("/" in req.model or "kilo" in req.model.lower()):
        model_id = req.model.strip()
    else:
        model_id = get_opencode_model(req.model)
    from agent_loop import get_variant_overrides
    from tool_schemas import TOOLS_SCHEMA

    return {
        "model": model_id,
        "messages": messages,
        "tools": None if req.skip_tools else (TOOLS_SCHEMA + mcp_tools),
        "variant_overrides": get_variant_overrides(req.variant)
    }


@router.post("/sessions/{session_id}/execute-tools")
async def execute_agent_tools(
    session_id: str,
    req: ExecuteToolsRequest,
    user: str = Depends(get_current_user)
):
    from agent_loop import execute_tool_call_v2
    tool_context = {
        "web_search_called": False,
        "consulted_sources": [],
        "map_tag": None,
        "weather_tag": None,
        "chart_tag": None,
        "flow_tag": None,
        "chemistry_tag": None,
        "timeline_tag": None,
        "calculator_tag": None
    }

    tasks = [
        execute_tool_call_v2(
            tc=tc,
            user_id=user,
            session_id=session_id,
            client_websocket=None,
            manager_ref=manager,
            client_time=datetime.now().isoformat(),
            model_key="deepseek-flash",
            tool_context=tool_context
        ) for tc in req.tool_calls
    ]

    results = await asyncio.gather(*tasks)

    response_list = []
    for tc_id, out, success in results:
        response_list.append({
            "role": "tool",
            "tool_call_id": tc_id,
            "content": out
        })

    consulted_sources = tool_context.get("consulted_sources") or []
    web_search_called = tool_context.get("web_search_called") or False
    sources_tag = None
    if web_search_called or consulted_sources:
        if not consulted_sources:
            consulted_sources.append({"title": "Google Search", "url": "https://www.google.com"})
        seen_urls = set()
        unique_sources = []
        for s in consulted_sources:
            if s.get("url") and s["url"] not in seen_urls:
                seen_urls.add(s["url"])
                unique_sources.append(s)
        if unique_sources:
            sources_parts = []
            for s in unique_sources:
                t_clean = str(s.get("title", "")).replace("|", "-").replace("<", "").replace(">", "").replace('"', '&quot;')
                u_clean = str(s.get("url", "")).replace("|", "%7C").replace('"', '&quot;')
                snip_clean = str(s.get("snippet", "empty")).replace("|", "-").replace("<", "").replace(">", "").replace('"', '&quot;').replace("\n", " ")
                sources_parts.append(f"{t_clean}|{u_clean}|{snip_clean}")
            sources_str = "||".join(sources_parts)
            sources_tag = f'<Sources data="{sources_str}" />'

    tags = {
        "map_tag": tool_context.get("map_tag"),
        "weather_tag": tool_context.get("weather_tag"),
        "chart_tag": tool_context.get("chart_tag"),
        "flow_tag": tool_context.get("flow_tag"),
        "chemistry_tag": tool_context.get("chemistry_tag"),
        "timeline_tag": tool_context.get("timeline_tag"),
        "calculator_tag": tool_context.get("calculator_tag"),
        "sources_tag": sources_tag
    }

    created_files = tool_context.get("created_files", {})

    return {
        "results": response_list,
        "tags": tags,
        "created_files": created_files
    }


@router.post("/sessions/{session_id}/log")
async def log_agent_response(
    session_id: str,
    req: LogAssistantResponseRequest,
    user: str = Depends(get_current_user)
):
    final_content = req.content or ""
    if req.created_files and isinstance(req.created_files, dict):
        for fname, fcode in req.created_files.items():
            if not fname or not fcode:
                continue
            ext = fname.split(".")[-1].lower() if "." in fname else "txt"
            lang_tag = "html" if ext == "html" else "css" if ext == "css" else "python" if ext == "py" else "javascript" if ext in ["js", "jsx"] else "typescript" if ext in ["ts", "tsx"] else ext
            code_block_header = f"```{lang_tag} {fname}"
            if code_block_header not in final_content:
                final_content += f"\n\n{code_block_header}\n{fcode}\n```"

    asyncio.create_task(asyncio.to_thread(log_message, session_id, "assistant", final_content))
    return {"status": "success"}


@router.post("/sessions/{session_id}/compact")
async def compact_session_endpoint(
    session_id: str,
    body: dict = {},
    user: str = Depends(get_current_user)
):
    from compaction import compact_session_history
    model_key = body.get("model", "deepseek-flash")

    log_message(session_id, "user", "/compact")

    summary = await compact_session_history(
        session_id=session_id,
        user_id=user,
        model_key=model_key,
        manager_ref=manager,
        client_websocket=None
    )

    confirm_header = "\n[Chat history has been successfully compacted.]\n\n**Compaction Summary Brief:**\n"
    confirm_footer = "\n"
    full_compact_msg = f"{confirm_header}{summary}{confirm_footer}"

    log_message(session_id, "assistant", full_compact_msg)

    latest_msgs = get_session_messages(session_id)
    new_percent = calculate_context_percent(latest_msgs)

    return {
        "summary": summary,
        "full_message": full_compact_msg,
        "messages": latest_msgs,
        "context_percent": new_percent
    }


@router.put("/sessions/{session_id}/messages/{message_id}/edit")
def edit_session_message(
    session_id: str,
    message_id: str,
    req: EditMessageRequest,
    user: str = Depends(get_current_user)
):
    return edit_message_and_truncate(session_id, message_id, req.new_content)


@router.post("/sessions/{session_id}/messages/{message_id}/feedback")
def log_message_feedback(
    session_id: str,
    message_id: str,
    req: FeedbackRequest,
    user: str = Depends(get_current_user)
):
    return log_message_feedback_db(session_id, message_id, req.feedback_type, req.comments)
