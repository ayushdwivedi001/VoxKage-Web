import os
import json
import asyncio
import re
import uuid
from datetime import datetime
from typing import AsyncGenerator

from opencode_client import get_opencode_model, sanitize_history_roles, get_system_prompt
from opencode_proxy import query_opencode_proxy
from websearch_engine import web_search, web_fetch, web_search_deep, web_search_parallel, web_fetch_parallel
from rag_engine import query_rag_vector, query_scoped_rag_vector, list_rag_documents, delete_rag_document
from image_engine import fetch_verified_images
from memory_engine import (
    remember_user, recall_user, get_user_profile, forget_user,
    set_trusted_action, check_trusted, log_problem, log_solution, search_memory
)
from tool_schemas import TOOLS_SCHEMA

# Shared laptop responses channel: { request_id: asyncio.Future }
LAPTOP_CHANNELS = {}

import urllib.parse

def sanitize_snippet(snippet_text: str, fallback_title: str, url: str) -> str:
    if not snippet_text or not isinstance(snippet_text, str):
        domain = urllib.parse.urlparse(url).netloc or "web resource"
        return f"Document and web resource inspected from {domain}."
    
    js_warning_patterns = [
        "javascript is disabled",
        "please enable javascript",
        "required part of this site couldn't load",
        "checking your browser before accessing",
        "cloudflare ray id",
        "enable cookies and reload",
        "access denied",
        "403 forbidden",
        "404 not found",
        "security check"
    ]
    
    snip_lower = snippet_text.lower()
    if any(pat in snip_lower for pat in js_warning_patterns):
        domain = urllib.parse.urlparse(url).netloc or "web source"
        parts = [p for p in url.split('/') if p and not p.startswith('http')]
        clean_name = parts[-1].replace('-', ' ').replace('_', ' ').replace('.html', '').replace('.pdf', '') if parts else ''
        if len(clean_name) > 3:
            return f"Extracted document & role details for {clean_name.title()} from {domain}."
        return f"Inspected web document resource from {domain}."
    
    clean = snippet_text.strip()
    return clean[:800] if len(clean) > 800 else clean

def register_consulted_source(tool_context: dict, url: str, title: str = None, snippet: str = None):
    if not url or not isinstance(url, str) or not url.startswith("http"):
        return
    
    tool_context["web_search_called"] = True
    sources = tool_context.get("consulted_sources")
    if sources is None:
        sources = []
        tool_context["consulted_sources"] = sources
        
    domain = urllib.parse.urlparse(url).netloc
    display_title = title
    if not display_title or display_title == url or len(display_title.strip()) < 3:
        parts = [p for p in url.split('/') if p and not p.startswith('http')]
        if parts:
            clean_name = parts[-1].replace('-', ' ').replace('_', ' ').replace('.html', '').replace('.pdf', '')
            display_title = f"{clean_name.title()} ({domain})"
        else:
            display_title = f"Web Source ({domain})"
            
    clean_snip = sanitize_snippet(snippet, display_title, url)
    
    for s in sources:
        if s.get("url") == url:
            if clean_snip and clean_snip != "empty" and (not s.get("snippet") or s.get("snippet") == "empty" or "javascript" in str(s.get("snippet")).lower()):
                s["snippet"] = clean_snip
            if display_title and (not s.get("title") or s.get("title") == url):
                s["title"] = display_title
            return

    sources.append({
        "title": display_title,
        "url": url,
        "snippet": clean_snip
    })

def apply_diff_python(current_code: str, diff_block: str) -> str:
    pattern = re.compile(
        r'<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE',
        re.DOTALL
    )
    new_code = current_code
    matches = list(pattern.finditer(diff_block))
    if not matches:
        return current_code
        
    for m in matches:
        search_content = m.group(1)
        replace_content = m.group(2)
        
        search_norm = search_content.replace('\r\n', '\n')
        code_norm = new_code.replace('\r\n', '\n')
        replace_norm = replace_content.replace('\r\n', '\n')
        
        if search_norm in code_norm:
            new_code = code_norm.replace(search_norm, replace_norm)
        else:
            search_trim = search_norm.strip()
            if search_trim in code_norm:
                idx = code_norm.find(search_trim)
                if idx != -1:
                    new_code = code_norm[:idx] + replace_norm + code_norm[idx + len(search_trim):]
    return new_code

def validate_js_with_node(js_code: str, line_offset: int = 0) -> dict:
    import subprocess
    import tempfile
    try:
        with tempfile.NamedTemporaryFile(suffix=".js", mode="w", delete=False, encoding="utf-8") as tmp:
            tmp.write(js_code)
            tmp_path = tmp.name
        res = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True, timeout=5)
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        if res.returncode != 0:
            err_msg = (res.stderr or res.stdout or "JavaScript Syntax Error").strip()
            match = re.search(r':(\d+)(?::\d+)?\r?\n', err_msg)
            if match:
                err_line = int(match.group(1)) + line_offset
                first_line = err_msg.splitlines()[0] if err_msg.splitlines() else err_msg
                return {"valid": False, "error": f"JavaScript SyntaxError in <script> tag at line {err_line}: {first_line}"}
            first_line = err_msg.splitlines()[0] if err_msg.splitlines() else err_msg
            return {"valid": False, "error": f"JavaScript SyntaxError: {first_line}"}
    except Exception:
        pass
    return {"valid": True}

def extract_virtual_files_from_history(messages_history: list, tool_context: dict = None) -> dict[str, str]:
    files_map = {}
    for m in messages_history or []:
        if m.get("role") == "assistant":
            content = m.get("content") or ""
            # Match ```header\n...``` handling CRLF (\r\n) and LF (\n)
            code_blocks = re.finditer(r'```([^\n\r]*)\r?\n([\s\S]*?)(?:```|$)', content)
            files_list = []
            for match in code_blocks:
                header = (match.group(1) or "").strip()
                code = match.group(2)
                if not code.strip():
                    continue
                
                lang = "txt"
                fname = ""
                if header:
                    if ":" in header:
                        parts = header.split(":", 1)
                        lang = parts[0].strip() or "txt"
                        fname = parts[1].strip()
                    elif " " in header or "\t" in header:
                        parts = header.split(None, 1)
                        lang = parts[0].strip() or "txt"
                        fname = parts[1].strip()
                    elif "." in header:
                        fname = header
                        ext = header.split(".")[-1].lower()
                        lang = "python" if ext == "py" else "javascript" if ext in ("js", "jsx") else "typescript" if ext in ("ts", "tsx") else ext
                    else:
                        lang = header

                if fname and not re.search(r'\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip)$', fname, re.IGNORECASE):
                    fname = ""
                
                if not fname:
                    start_idx = max(0, match.start() - 150)
                    preceding = content[start_idx:match.start()]
                    file_match = re.search(r'`?(\/?[\w\-]+(?:/[\w\-]+)*\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip))`?', preceding, re.IGNORECASE)
                    fname = file_match.group(1) if file_match else ""
                
                if not fname:
                    lines = code.strip().split('\n')[:3]
                    for line in lines:
                        inline_match = re.search(r'(?:#|//|/\*)\s*(\/?[\w\-]+(?:/[\w\-]+)*\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip))', line, re.IGNORECASE)
                        if inline_match:
                            fname = inline_match.group(1)
                            break
                
                if not fname:
                    ext = "py" if lang == "python" else "js" if lang == "javascript" else "ts" if lang == "typescript" else "html" if lang == "html" else "css" if lang == "css" else "txt"
                    fname = f"app_{len(files_list) + 1}.{ext}"
                
                if fname.startswith("/"):
                    fname = fname[1:]
                
                is_diff = "<<<<<<< SEARCH" in code and "=======" in code and ">>>>>>> REPLACE" in code
                if is_diff:
                    if fname in files_map:
                        files_map[fname] = apply_diff_python(files_map[fname], code)
                else:
                    files_map[fname] = code.strip()
                    
    # Merge in-memory files created in current turn
    if tool_context and "created_files" in tool_context:
        for fname, content_code in tool_context["created_files"].items():
            if fname.startswith("/"):
                fname = fname[1:]
            is_diff = "<<<<<<< SEARCH" in content_code and "=======" in content_code and ">>>>>>> REPLACE" in content_code
            if is_diff:
                if fname in files_map:
                    files_map[fname] = apply_diff_python(files_map[fname], content_code)
                else:
                    files_map[fname] = content_code.strip()
            else:
                files_map[fname] = content_code.strip()

    return files_map

def get_tool_label(name: str, args: dict) -> str:
    if name == "show_map":
        return f"Show Map: '{args.get('label') or 'Coordinate Location'}'"
    elif name == "get_weather":
        loc = f"{args.get('latitude')}, {args.get('longitude')}" if args.get('latitude') is not None else "Current Geolocation"
        return f"Get Weather: '{loc}'"
    elif name == "get_images":
        return f"Search Images: '{args.get('query', '')}'"
    elif name == "web_search":
        return f"Search: '{args.get('query', '')}'"
    elif name == "web_fetch":
        return f"Fetch URL: {args.get('url', '')}"
    elif name == "web_search_parallel":
        return "Parallel Search"
    elif name == "web_fetch_parallel":
        return "Parallel Fetch"
    elif name == "web_search_deep":
        return f"Deep Search: '{args.get('query', '')}'"
    elif name == "browse_and_extract_tool":
        target = args.get("url") or args.get("query") or ""
        return f"Extract: '{target}'"
    elif name == "laptop_command":
        return f"Laptop Cmd: {args.get('command', '')}"
    elif name == "open_application":
        return f"Open App: {args.get('app_name', '')}"
    elif name == "close_application":
        return f"Close App: {args.get('app_name', '')}"
    elif name == "remember_user":
        return f"Remember Fact: {args.get('key', '')}"
    elif name == "recall_user":
        return "Recall Fact"
    elif name == "forget_user":
        return f"Forget Fact: {args.get('key', '')}"
    elif name == "query_rag":
        return f"RAG Query: '{args.get('query', '')}'"
    elif name == "list_indexed_documents":
        return "List RAG Docs"
    elif name == "delete_indexed_document":
        return "Delete RAG Doc"
    elif name == "index_document":
        return f"Indexing {args.get('original_name') or args.get('filename') or ''}..."
    elif name == "create_code_file":
        return f"Create File: '{args.get('filename', '')}'"
    elif name == "update_code_file":
        return f"Update File: '{args.get('filename', '')}'"
    elif name == "read_code_file":
        return f"Read File: '{args.get('filename', '')}'"
    elif name == "verify_code_file":
        return f"Verify File: '{args.get('filename', '')}'"
    elif name == "rename_session":
        return f"Rename Session: '{args.get('title', '')}'"
    elif "__" in name:
        provider, mcp_tool = name.split("__", 1)
        return f"[{provider.title()} MCP] {mcp_tool.replace('_', ' ').title()}"
    else:
        return name.replace("_", " ").title()

def parse_dsml_tool_calls(text: str) -> tuple[str, list[dict]]:
    if not text:
        return "", []
    tool_calls = []
    
    invoke_pattern = re.compile(
        r'<[｜|?]{2}DSML[｜|?]{2}invoke name="([^"]+)"\s*>(.*?)</[｜|?]{2}DSML[｜|?]{2}invoke>',
        re.DOTALL
    )
    
    def replace_invoke(match):
        tool_name = match.group(1)
        params_content = match.group(2)
        
        param_pattern = re.compile(
            r'<[｜|?]{2}DSML[｜|?]{2}parameter name="([^"]+)"[^>]*>(.*?)</[｜|?]{2}DSML[｜|?]{2}parameter>',
            re.DOTALL
        )
        args = {}
        for param_match in param_pattern.finditer(params_content):
            param_name = param_match.group(1)
            param_val = param_match.group(2).strip()
            
            try:
                parsed_val = json.loads(param_val)
            except ValueError:
                parsed_val = param_val
            args[param_name] = parsed_val
            
        tool_calls.append({
            "id": f"call_{uuid.uuid4().hex[:12]}",
            "type": "function",
            "function": {
                "name": tool_name,
                "arguments": json.dumps(args)
            }
        })
        return ""
        
    cleaned_text = invoke_pattern.sub(replace_invoke, text)
    cleaned_text = re.sub(r'</?[｜|?]{2}DSML[｜|?]{2}tool_calls\s*>', '', cleaned_text)
    
    return cleaned_text.strip(), tool_calls

def get_variant_overrides(variant: str) -> dict:
    v = (variant or "High").upper()
    if v == "LOW":
        return {
            "temperature": 0.1,
            "max_tokens": 2048,
            "top_p": 0.9,
            "presence_penalty": 0.0,
            "frequency_penalty": 0.0
        }
    elif v == "MEDIUM":
        return {
            "temperature": 0.4,
            "max_tokens": 4096,
            "top_p": 0.95,
            "presence_penalty": 0.0,
            "frequency_penalty": 0.0
        }
    elif v == "XHIGH":
        return {
            "temperature": 0.85,
            "max_tokens": 16384,
            "top_p": 1.0,
            "presence_penalty": 0.1,
            "frequency_penalty": 0.1
        }
    elif v == "MAX":
        return {
            "temperature": 1.0,
            "max_tokens": 32768,
            "top_p": 1.0,
            "presence_penalty": 0.2,
            "frequency_penalty": 0.2
        }
    else: # HIGH
        return {
            "temperature": 0.7,
            "max_tokens": 8192,
            "top_p": 0.95,
            "presence_penalty": 0.0,
            "frequency_penalty": 0.0
        }

async def poll_canva_export_job(
    session_id: str,
    user_id: str,
    client_websocket,
    manager_ref,
    job_id: str,
    access_token: str,
    server_url: str,
    transport: str
):
    async def send_to_client(payload_dict):
        if client_websocket:
            try:
                await client_websocket.send_text(json.dumps(payload_dict))
            except:
                pass
        elif manager_ref and user_id in manager_ref.active_chats:
            for ws in manager_ref.active_chats[user_id]:
                try:
                    await ws.send_text(json.dumps(payload_dict))
                except:
                    pass

    from mcp_pool import mcp_pool
    # Poll for max 60 seconds
    for attempt in range(40):
        await asyncio.sleep(1.5)
        try:
            session_mcp = await mcp_pool.get_or_create(
                user_id=user_id,
                provider="canva",
                server_url=server_url,
                access_token=access_token,
                transport=transport
            )
            res = await session_mcp.call_tool("get_export_status", arguments={"job_id": job_id})
            
            output_parts = []
            for block in res.content:
                if hasattr(block, "text") and block.text:
                    output_parts.append(block.text)
            status_text = "\n".join(output_parts)
            
            try:
                status_json = json.loads(status_text)
            except:
                status_json = {}
                
            state = status_json.get("state") or status_json.get("status")
            
            await send_to_client({
                "type": "hud_log",
                "content": f"[Canva MCP] Export status: {state or 'polling'}..."
            })
            
            if state in ("success", "completed", "done"):
                download_url = status_json.get("url") or status_json.get("download_url")
                await send_to_client({
                    "type": "hud_log",
                    "content": f"[Canva MCP] Export complete! Download link: {download_url}"
                })
                if download_url:
                    await send_to_client({
                        "type": "token",
                        "content": f"\n\n### Canva Export Complete\nYour design has been successfully exported: [Download design]({download_url})\n\n![Canva Export]({download_url})"
                    })
                break
            elif state in ("failed", "error"):
                await send_to_client({
                    "type": "hud_log",
                    "content": f"[Canva MCP] Export failed: {status_json.get('error') or 'unknown error'}"
                })
                break
        except Exception as e:
            print(f"[-] Error polling Canva job {job_id}: {e}")

async def execute_tool_call_v2(

    tc: dict,
    user_id: str,
    session_id: str,
    client_websocket,
    manager_ref,
    client_time: str,
    model_key: str,
    tool_context: dict
) -> tuple:
    try:
        name = tc["function"]["name"]
        args_str = tc["function"]["arguments"]
        try:
            args = json.loads(args_str or "{}")
        except:
            args = {}

        async def send_to_client(payload_dict):
            if client_websocket:
                try:
                    await client_websocket.send_text(json.dumps(payload_dict))
                except:
                    pass
            elif manager_ref and user_id in manager_ref.active_chats:
                for ws in manager_ref.active_chats[user_id]:
                    try:
                        await ws.send_text(json.dumps(payload_dict))
                    except:
                        pass

        # Update consulted web sources context
        if name in {"web_search", "web_fetch", "web_search_parallel", "web_fetch_parallel", "web_search_deep", "browse_and_extract_tool"}:
            tool_context["web_search_called"] = True

        tc_id = tc["id"]
        tool_output = ""

        # --- Route Search and Fetch Tools ---
        if name in {"web_search", "web_fetch", "web_search_parallel", "web_fetch_parallel", "web_search_deep", "get_images", "show_map", "get_weather", "render_chart", "render_timeline"}:
            announcement = ""
            if name == "get_images":
                announcement = f"Searching free image assets for: '{args.get('query', '')}'..."
            elif name == "show_map":
                announcement = f"Rendering interactive dark map view..."
            elif name == "get_weather":
                announcement = f"Retrieving local weather forecast reports..."
            elif name == "render_chart":
                announcement = f"Generating interactive dark analytics chart: '{args.get('title', '')}'..."
            elif name == "render_timeline":
                announcement = f"Generating collapsible history timeline: '{args.get('title', '')}'..."
            elif name == "web_search":
                announcement = f"Searching the web for: '{args.get('query', '')}'..."
            elif name == "web_fetch":
                announcement = f"Fetching content from URL: {args.get('url', '')}..."
            elif name == "web_search_parallel":
                announcement = f"Performing parallel web searches..."
            elif name == "web_fetch_parallel":
                announcement = f"Fetching multiple web pages in parallel..."
            elif name == "web_search_deep":
                announcement = f"Performing deep search and fetching web contents for: '{args.get('query', '')}'..."

            if announcement:
                await send_to_client({"type": "hud_log", "content": announcement})

            if name == "get_images":
                q = args.get("query", "")
                lim = args.get("limit", 5)
                urls = await fetch_verified_images(q, limit=lim)
                tool_output = json.dumps(urls)
            elif name == "show_map":
                lat = args.get("latitude")
                lng = args.get("longitude")
                lbl = args.get("label", "")
                places_list = args.get("places", [])
                
                # Format places to: Name|Lat|Lng|Rating|Reviews|Desc|Category|ImageURL||Name|...
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
                tool_context["map_tag"] = f'<Map lat="{lat}" lng="{lng}" label="{lbl}" places="{places_str}" />'
                tool_output = json.dumps({"status": "success", "latitude": lat, "longitude": lng, "label": lbl, "places_count": len(places_list)})
            elif name == "get_weather":
                lat = args.get("latitude")
                lng = args.get("longitude")
                # Format to: <Weather lat="..." lng="..." /> or <Weather /> if omitted
                if lat is not None and lng is not None:
                    tool_context["weather_tag"] = f'<Weather lat="{lat}" lng="{lng}" />'
                else:
                    tool_context["weather_tag"] = '<Weather />'
                tool_output = json.dumps({"status": "success", "latitude": lat, "longitude": lng})
            elif name == "render_chart":
                chart_type = args.get("type", "line")
                title = args.get("title", "")
                x_lbl = args.get("x_axis_label", "")
                y_lbl = args.get("y_axis_label", "")
                data_list = args.get("data", [])
                
                formatted_pts = []
                for pt in data_list:
                    lbl = str(pt.get("label", "")).replace("|", "").replace(";", "")
                    val = str(pt.get("value", "0"))
                    sec_val = str(pt.get("secondary_value", "empty"))
                    formatted_pts.append(f"{lbl}|{val}|{sec_val}")
                
                data_str = "||".join(formatted_pts)
                tool_context["chart_tag"] = f'<Chart type="{chart_type}" title="{title}" xLabel="{x_lbl}" yLabel="{y_lbl}" data="{data_str}" />'
                tool_output = json.dumps({"status": "success", "type": chart_type, "title": title, "points_count": len(data_list)})
            elif name == "render_timeline":
                await send_to_client({"type": "hud_log", "content": "Rendering Timeline..."})
                title = args.get("title", "")
                events_list = args.get("events", [])
                
                formatted_evs = []
                for ev in events_list:
                    ev_date = str(ev.get("date", "")).replace("|", "").replace(";", "")
                    ev_title = str(ev.get("title", "")).replace("|", "").replace(";", "")
                    ev_desc = str(ev.get("description", "") or "empty").replace("|", "").replace(";", "")
                    ev_cat = str(ev.get("category", "") or "empty").replace("|", "").replace(";", "")
                    formatted_evs.append(f"{ev_date}|{ev_title}|{ev_desc}|{ev_cat}")
                
                events_str = "||".join(formatted_evs)
                tool_context["timeline_tag"] = f'<Timeline title="{title}" events="{events_str}" />'
                tool_output = json.dumps({"status": "success", "title": title, "events_count": len(events_list)})
            elif name == "web_search":
                tool_context["web_search_called"] = True
                q = args.get("query", "")
                search_res = await web_search(q)
                tool_output = json.dumps(search_res)
                if isinstance(search_res, list):
                    for r in search_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            snip = r.get("snippet") or r.get("text") or r.get("content") or r.get("summary")
                            register_consulted_source(tool_context, r["url"], r.get("title"), snip)
                elif isinstance(search_res, dict) and isinstance(search_res.get("results"), list):
                    for r in search_res["results"]:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            snip = r.get("snippet") or r.get("text") or r.get("content") or r.get("summary")
                            register_consulted_source(tool_context, r["url"], r.get("title"), snip)
            elif name == "web_fetch":
                tool_context["web_search_called"] = True
                u = args.get("url", "")
                fetch_res = await web_fetch(u)
                tool_output = json.dumps(fetch_res)
                snip = ""
                title = None
                if isinstance(fetch_res, dict):
                    snip = fetch_res.get("content") or fetch_res.get("text") or fetch_res.get("summary") or ""
                    title = fetch_res.get("title")
                elif isinstance(fetch_res, str):
                    snip = fetch_res
                register_consulted_source(tool_context, u, title, snip)
            elif name == "web_search_parallel":
                tool_context["web_search_called"] = True
                queries = args.get("queries", [])
                search_res = await web_search_parallel(queries)
                tool_output = json.dumps(search_res)
                if isinstance(search_res, list):
                    for sub_list in search_res:
                        if isinstance(sub_list, list):
                            for r in sub_list:
                                if isinstance(r, dict) and r.get("url") and "error" not in r:
                                    snip = r.get("snippet") or r.get("text") or r.get("content") or r.get("summary")
                                    register_consulted_source(tool_context, r["url"], r.get("title"), snip)
            elif name == "web_fetch_parallel":
                tool_context["web_search_called"] = True
                urls = args.get("urls", [])
                fetch_res = await web_fetch_parallel(urls)
                tool_output = json.dumps(fetch_res)
                if isinstance(fetch_res, list):
                    for idx, r in enumerate(fetch_res):
                        target_u = urls[idx] if idx < len(urls) else (r.get("url") if isinstance(r, dict) else "")
                        snip = r.get("content") or r.get("text") or r.get("summary") if isinstance(r, dict) else str(r)
                        title = r.get("title") if isinstance(r, dict) else None
                        register_consulted_source(tool_context, target_u, title, snip)
            elif name == "web_search_deep":
                tool_context["web_search_called"] = True
                q = args.get("query", "")
                deep_res = await web_search_deep(q)
                tool_output = json.dumps(deep_res)
                if isinstance(deep_res, list):
                    for r in deep_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            snip = r.get("snippet") or r.get("text") or r.get("content") or r.get("summary")
                            register_consulted_source(tool_context, r["url"], r.get("title"), snip)

        # --- Route Laptop Daemon Tools ---
        elif name in {"laptop_command", "open_application", "close_application"}:
            announcement = ""
            if name == "laptop_command":
                announcement = f"Executing laptop shell command: `{args.get('command', '')}`..."
            elif name == "open_application":
                announcement = f"Opening application on laptop: {args.get('app_name', '')}..."
            elif name == "close_application":
                announcement = f"Closing application on laptop: {args.get('app_name', '')}..."

            if announcement:
                await send_to_client({"type": "hud_log", "content": announcement})

            laptop_ws = None
            if manager_ref:
                laptops_dict = manager_ref.active_laptops
                laptop_ws = laptops_dict.get(user_id)
                if not laptop_ws and laptops_dict:
                    laptop_ws = list(laptops_dict.values())[0]
            if laptop_ws:
                try:
                    req_id = f"tool_{uuid.uuid4()}"
                    loop = asyncio.get_running_loop()
                    future = loop.create_future()
                    LAPTOP_CHANNELS[req_id] = future
                    
                    await laptop_ws.send_text(json.dumps({
                        "action": "execute_tool",
                        "tool_name": name,
                        "args": args,
                        "request_id": req_id
                    }))
                    
                    result_payload = await asyncio.wait_for(future, timeout=90.0)
                    if "error" in result_payload:
                        raise Exception(result_payload["error"])
                    tool_output = result_payload.get("output", "")
                except Exception as le:
                    tool_output = f"Error: Laptop execution failed: {str(le)}"
            else:
                tool_output = "Error: Laptop bridge is offline. Cannot execute laptop commands."

        # --- Route RAG Tools ---
        elif name == "query_rag":
            await send_to_client({"type": "hud_log", "content": "Searching indexed documents in RAG..."})
            q = args.get("query", "")
            docs = query_rag_vector(q, user_id, threshold=0.15)
            tool_output = json.dumps(docs)
        elif name == "list_indexed_documents":
            await send_to_client({"type": "hud_log", "content": "Listing all indexed documents..."})
            docs = list_rag_documents(user_id)
            tool_output = json.dumps(docs)
        elif name == "delete_indexed_document":
            doc_id_to_del = args.get("document_id")
            filename_to_del = args.get("filename")
            await send_to_client({"type": "hud_log", "content": f"Deleting document: {filename_to_del or doc_id_to_del}..."})
            res = delete_rag_document(user_id, document_id=doc_id_to_del, filename=filename_to_del)
            tool_output = json.dumps(res)
        elif name == "index_document":
            filename = args.get("filename")
            original_name = args.get("original_name")
            await send_to_client({"type": "hud_log", "content": f"Indexing {original_name or filename}..."})
            file_path = os.path.join("uploads", str(session_id), filename)
            if not os.path.exists(file_path):
                file_path = os.path.join("uploads", filename)
            if os.path.exists(file_path):
                from rag_engine import index_file_in_rag
                res = await index_file_in_rag(
                    file_path=file_path,
                    filename=original_name or filename,
                    user_id=user_id,
                    model=model_key
                )
            else:
                tool_output = f"Error: Uploaded file '{filename}' not found on server disk. Cannot index."

        elif name in ("create_code_file", "update_code_file"):
            filename = args.get("filename", "").strip()
            content_code = args.get("content", "").strip()
            if filename.startswith("/"):
                filename = filename[1:]
            
            created_files = tool_context.setdefault("created_files", {})
            
            if name == "update_code_file" and ("<<<<<<< SEARCH" in content_code and "=======" in content_code and ">>>>>>> REPLACE" in content_code):
                try:
                    from database import get_session_messages
                    messages_history = get_session_messages(session_id)
                except Exception:
                    messages_history = []
                files_map = extract_virtual_files_from_history(messages_history, tool_context)
                existing_code = files_map.get(filename) or created_files.get(filename, "")
                if existing_code:
                    content_code = apply_diff_python(existing_code, content_code)
            
            created_files[filename] = content_code

            await send_to_client({"type": "hud_log", "content": f"{'Creating' if name=='create_code_file' else 'Updating'} workspace file: {filename}..."})
            tool_output = json.dumps({"status": "success", "file": filename, "lines": len(content_code.splitlines()), "message": f"File '{filename}' successfully saved in workspace."})

        elif name == "read_code_file":
            filename = args.get("filename", "").strip()
            await send_to_client({"type": "hud_log", "content": f"Reading virtual session file: {filename}..."})
            
            try:
                from database import get_session_messages
                messages_history = get_session_messages(session_id)
            except Exception:
                messages_history = []
            files_map = extract_virtual_files_from_history(messages_history, tool_context)
            
            if filename.startswith("/"):
                filename = filename[1:]
            
            match_code = files_map.get(filename)
            if not match_code:
                for fn, c in files_map.items():
                    if fn.lower() == filename.lower():
                        match_code = c
                        filename = fn
                        break
            
            if match_code is not None:
                start_line = args.get("start_line")
                end_line = args.get("end_line")
                if start_line is not None or end_line is not None:
                    lines = match_code.splitlines()
                    s_idx = max(0, (start_line or 1) - 1)
                    e_idx = end_line if end_line else len(lines)
                    match_code = "\n".join(lines[s_idx:e_idx])
                tool_output = match_code
            else:
                available = ", ".join(list(files_map.keys())) or "none"
                tool_output = f"Workspace File Notice: File '{filename}' was not found in active workspace. Available files: {available}. Call create_code_file if you need to create it."

        elif name == "verify_code_file":
            filename = args.get("filename", "").strip()
            await send_to_client({"type": "hud_log", "content": f"Performing syntax validation for: {filename}..."})
            
            try:
                from database import get_session_messages
                messages_history = get_session_messages(session_id)
            except Exception:
                messages_history = []
            files_map = extract_virtual_files_from_history(messages_history, tool_context)
            
            if filename.startswith("/"):
                filename = filename[1:]
            
            match_code = files_map.get(filename)
            if not match_code:
                for fn, c in files_map.items():
                    if fn.lower() == filename.lower():
                        match_code = c
                        filename = fn
                        break
            
            if match_code is None:
                available = ", ".join(list(files_map.keys())) or "none"
                tool_output = json.dumps({"valid": False, "error": f"Error: File '{filename}' not found. Available session files: {available}"})
            else:
                try:
                    ext = filename.split(".")[-1].lower() if "." in filename else ""
                    validation_res = {"valid": True}
                    
                    # 1. Bracket Matching Check (for code files)
                    if ext in ("py", "js", "jsx", "ts", "tsx", "json", "css", "html"):
                        brackets = {')': '(', '}': '{', ']': '['}
                        stack = []
                        lines_list = match_code.splitlines()
                        for idx, line in enumerate(lines_list):
                            in_single_quote = False
                            in_double_quote = False
                            in_template_literal = False
                            escaped = False
                            
                            if ext == "py" and line.strip().startswith("#"):
                                continue
                                
                            for char_idx, char in enumerate(line):
                                if escaped:
                                    escaped = False
                                    continue
                                if char == '\\':
                                    escaped = True
                                    continue
                                if char == "'" and not in_double_quote and not in_template_literal:
                                    in_single_quote = not in_single_quote
                                    continue
                                if char == '"' and not in_single_quote and not in_template_literal:
                                    in_double_quote = not in_double_quote
                                    continue
                                if char == '`' and not in_single_quote and not in_double_quote:
                                    in_template_literal = not in_template_literal
                                    continue
                                if in_single_quote or in_double_quote or in_template_literal:
                                    continue
                                    
                                if char in brackets.values():
                                    stack.append((char, idx + 1, char_idx + 1))
                                elif char in brackets.keys():
                                    if not stack:
                                        validation_res = {"valid": False, "error": f"SyntaxError: Unmatched closing bracket '{char}' at line {idx+1}:{char_idx+1}"}
                                        break
                                    top, l_num, c_num = stack.pop()
                                    if brackets[char] != top:
                                        validation_res = {"valid": False, "error": f"SyntaxError: Mismatching bracket '{char}' at line {idx+1}:{char_idx+1} (expected closing for '{top}' from line {l_num}:{c_num})"}
                                        break
                            if not validation_res["valid"]:
                                break
                                
                        if validation_res["valid"] and stack:
                            top, l_num, c_num = stack.pop()
                            validation_res = {"valid": False, "error": f"SyntaxError: Unclosed bracket '{top}' opened at line {l_num}:{c_num}"}

                    # 2. Specific Language Compiler & JS Script checks
                    if validation_res["valid"]:
                        if ext == "py":
                            try:
                                compile(match_code, filename, 'exec')
                            except SyntaxError as e:
                                validation_res = {"valid": False, "error": f"SyntaxError: {e.msg} at line {e.lineno}:{e.offset}"}
                        elif ext in ("js", "jsx", "ts", "tsx"):
                            js_val = validate_js_with_node(match_code)
                            if not js_val["valid"]:
                                validation_res = js_val
                        elif ext == "json":
                            try:
                                json.loads(match_code)
                            except ValueError as e:
                                validation_res = {"valid": False, "error": f"JSONError: {str(e)}"}
                        elif ext == "html":
                            from html.parser import HTMLParser
                            class HTMLValidator(HTMLParser):
                                def __init__(self):
                                    super().__init__()
                                    self.tags = []
                                    self.errors = []
                                def handle_starttag(self, tag, attrs):
                                    if tag not in ('img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr'):
                                        self.tags.append((tag, self.getpos()))
                                def handle_endtag(self, tag):
                                    if tag in ('img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr'):
                                        return
                                    if not self.tags:
                                        self.errors.append(f"Unmatched closing tag </{tag}> at line {self.getpos()[0]}")
                                        return
                                    expected, pos = self.tags.pop()
                                    if expected != tag:
                                        self.errors.append(f"Tag mismatch: </{tag}> closed at line {self.getpos()[0]} (expected closing for <{expected}> opened at line {pos[0]})")
                            
                            val = HTMLValidator()
                            try:
                                val.feed(match_code)
                                if val.errors:
                                    validation_res = {"valid": False, "error": val.errors[0]}
                                elif val.tags:
                                    tag, pos = val.tags.pop()
                                    validation_res = {"valid": False, "error": f"Unclosed tag <{tag}> opened at line {pos[0]}"}
                            except Exception as e:
                                validation_res = {"valid": False, "error": f"HTML Parsing Error: {str(e)}"}

                            # Run deep JS syntax validation on all <script> blocks inside HTML
                            if validation_res["valid"]:
                                script_matches = list(re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>', match_code, re.IGNORECASE))
                                for sm in script_matches:
                                    script_content = sm.group(1)
                                    if not script_content.strip():
                                        continue
                                    start_pos = sm.start(1)
                                    line_offset = match_code[:start_pos].count('\n')
                                    js_val = validate_js_with_node(script_content, line_offset=line_offset)
                                    if not js_val["valid"]:
                                        validation_res = js_val
                                        break

                    tool_output = json.dumps(validation_res)
                except Exception as e:
                    tool_output = json.dumps({"valid": False, "error": f"Internal Verification Error: {str(e)}"})

        elif name == "rename_session":
            title = args.get("title", "").strip()
            if title:
                from database import update_session_name
                await asyncio.to_thread(update_session_name, session_id, user_id, title)
                if manager_ref:
                    chat_sockets = manager_ref._active_chats.get(user_id, [])
                    for s in chat_sockets:
                        try:
                            await s.send_text(json.dumps({"type": "rename", "name": title}))
                        except:
                            pass
                if client_websocket:
                    try:
                        await client_websocket.send_text(json.dumps({"type": "rename", "name": title}))
                    except:
                        pass
                tool_output = json.dumps({"status": "success", "message": f"Session renamed to: {title}"})
            else:
                tool_output = json.dumps({"status": "error", "message": "Missing title argument."})
            return (tc_id, tool_output, True)

        # --- Route Memories & Problems ---
        elif name == "remember_user":
            await send_to_client({"type": "hud_log", "content": "Saving user memory..."})
            c = args.get("category", "notes")
            k = args.get("key", "")
            v = args.get("value", "")
            tool_output = remember_user(user_id, c, k, v)
        elif name == "recall_user":
            await send_to_client({"type": "hud_log", "content": "Recalling user memory..."})
            q = args.get("query", "")
            tool_output = recall_user(user_id, q)
        elif name == "forget_user":
            await send_to_client({"type": "hud_log", "content": "Forgetting user memory..."})
            c = args.get("category", "")
            k = args.get("key", "")
            tool_output = forget_user(user_id, c, k)
        elif name == "log_problem":
            await send_to_client({"type": "hud_log", "content": "Logging unsolved bug..."})
            prob = args.get("problem", "")
            ctx = args.get("context", "")
            att = args.get("attempted", "")
            tool_output = f"Logged unsolved problem ID: {log_problem(user_id, prob, ctx, att)}"
        elif name == "log_solution":
            await send_to_client({"type": "hud_log", "content": "Logging solution..."})
            pid = args.get("problem_id", "")
            sol = args.get("solution", "")
            ww = args.get("what_worked", "")
            prev = args.get("prevention", "")
            tool_output = log_solution(user_id, pid, sol, ww, prev)
        elif name == "search_memory":
            await send_to_client({"type": "hud_log", "content": "Searching memory..."})
            q = args.get("query", "")
            tool_output = search_memory(user_id, q)

        elif name == "browse_and_extract_tool":
            await send_to_client({"type": "hud_log", "content": "Extracting text content..."})
            u = args.get("url", "")
            q = args.get("query", "")
            if u:
                fetch_res = await web_fetch(u)
                tool_output = fetch_res.get("content", fetch_res.get("error", "No text content."))
                snip = fetch_res.get("content") if isinstance(fetch_res, dict) else str(fetch_res)
                title = fetch_res.get("title") if isinstance(fetch_res, dict) else None
                register_consulted_source(tool_context, u, title, snip)
            else:
                search_res = await web_search(q)
                tool_output = json.dumps(search_res)
                if isinstance(search_res, list):
                    for r in search_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            snip = r.get("snippet") or r.get("text") or r.get("content") or r.get("summary")
                            register_consulted_source(tool_context, r["url"], r.get("title"), snip)

        elif name == "get_current_datetime":
            if client_time:
                tool_output = json.dumps({
                    "local_time_details": client_time,
                    "timezone": "Client Local Time"
                })
            else:
                tool_output = json.dumps({
                    "current_time": datetime.now().strftime("%I:%M:%S %p"),
                    "current_date": datetime.now().strftime("%A, %B %d, %Y"),
                    "timezone": "Server UTC Time",
                    "timestamp": datetime.now().isoformat()
                })
        elif "__" in name:
            provider, mcp_tool_name = name.split("__", 1)
            if provider == "gmail":
                gmail_logs = {
                    "create_draft": "Preparing a Gmail draft...",
                    "get_thread": "Fetching conversation thread...",
                    "list_drafts": "Retrieving draft list...",
                    "list_labels": "Listing mail folders...",
                    "search_threads": "Searching Gmail mailbox...",
                }
                announcement = gmail_logs.get(mcp_tool_name, f"Consulting Gmail ({mcp_tool_name})...")
            elif provider == "google_drive":
                drive_logs = {
                    "files.list": "Searching and listing Google Drive files...",
                    "files.get": "Retrieving file details...",
                    "files.create": "Creating a new file in Google Drive...",
                    "files.update": "Updating file content/metadata in Drive...",
                    "files.delete": "Deleting file from Google Drive...",
                    "files.copy": "Copying file in Google Drive...",
                    "files.export": "Exporting Google workspace document...",
                    "permissions.list": "Listing file permissions...",
                    "permissions.create": "Sharing Google Drive file...",
                    "permissions.delete": "Removing sharing permissions...",
                }
                announcement = drive_logs.get(mcp_tool_name, f"Consulting Google Drive ({mcp_tool_name})...")
            elif provider == "google_calendar":
                calendar_logs = {
                    "create_event": "Creating a new calendar event...",
                    "delete_event": "Deleting calendar event...",
                    "find_free_time": "Checking calendar availability...",
                    "get_event": "Retrieving event details...",
                    "list_calendars": "Listing your calendars...",
                    "list_events": "Listing calendar events...",
                    "respond_to_event": "Updating calendar invitation RSVP...",
                    "update_event": "Updating calendar event details...",
                }
                announcement = calendar_logs.get(mcp_tool_name, f"Consulting Google Calendar ({mcp_tool_name})...")
            elif provider == "notion":
                notion_logs = {
                    "search": "Searching Notion workspace...",
                    "fetch": "Fetching Notion page content...",
                    "create-pages": "Creating a new page in Notion...",
                    "update-page": "Updating Notion page content...",
                    "move-pages": "Moving page in Notion...",
                    "duplicate-page": "Duplicating Notion page...",
                    "create-database": "Creating Notion database...",
                    "update-database": "Updating Notion database schema...",
                    "create-comment": "Adding comment to Notion page...",
                    "get-comments": "Retrieving page comments...",
                    "get-users": "Listing Notion workspace users...",
                    "get-self": "Retrieving bot identity info...",
                    "get-user": "Retrieving workspace user details..."
                }
                announcement = notion_logs.get(mcp_tool_name, f"Consulting Notion ({mcp_tool_name})...")
            elif provider in ("microsoft_word", "word"):
                word_logs = {
                    "create_word_document": "Creating Microsoft Word document (.docx)...",
                    "edit_word_document": "Editing Word document section...",
                    "get_word_document": "Fetching Word document state...",
                    "export_word_document": "Exporting binary .docx file..."
                }
                announcement = word_logs.get(mcp_tool_name, f"Consulting Microsoft Word ({mcp_tool_name})...")
            else:
                announcement = f"[{provider.title()} MCP] Executing {mcp_tool_name}..."
            await send_to_client({"type": "hud_log", "content": announcement})
            
            try:
                if provider in ("microsoft_word", "word"):
                    from word_mcp import execute_word_tool
                    tool_output = await execute_word_tool(mcp_tool_name, args)
                    try:
                        parsed_res = json.loads(tool_output)
                        if isinstance(parsed_res, dict) and "artifact" in parsed_res:
                            art = parsed_res["artifact"]
                            await send_to_client({
                                "type": "artifact",
                                "name": art.get("name", "document.docx"),
                                "content": art.get("content", ""),
                                "language": "word"
                            })
                    except Exception as art_err:
                        print(f"[-] Non-fatal notice sending Word artifact event: {art_err}")
                else:
                    from database import get_user_settings_profile
                    profile = get_user_settings_profile(user_id)
                    connections = profile.get("mcp_connections") or {}
                    conn = connections.get(provider)
                    if not conn:
                        raise Exception(f"Connection credentials for provider '{provider}' not found.")
                    
                    from mcp_client import get_valid_token
                    access_token = await get_valid_token(user_id, provider, conn)
     
                    async def _run_provider_tool(tok: str) -> str:
                        if provider == "gmail":
                            from mcp_servers.gmail.gmail_mcp import execute_google_tool
                            return await execute_google_tool(provider, mcp_tool_name, args, tok)
                        elif provider == "google_drive":
                            from mcp_servers.google_drive.google_drive_mcp import execute_google_drive_tool
                            return await execute_google_drive_tool(mcp_tool_name, args, tok)
                        elif provider == "google_calendar":
                            from mcp_servers.google_calendar.google_calendar_mcp import execute_google_calendar_tool
                            return await execute_google_calendar_tool(mcp_tool_name, args, tok)
                        elif provider == "notion":
                            from mcp_servers.notion.notion_mcp import execute_notion_tool
                            return await execute_notion_tool(mcp_tool_name, args, tok)
                        return ""

                    if provider in ("gmail", "google_drive", "google_calendar", "notion"):
                        tool_output = await _run_provider_tool(access_token)
                        # Check if returned response indicates HTTP 401 / expired token
                        lower_out = str(tool_output).lower()
                        if "401" in lower_out or "unauthorized" in lower_out or "invalid credentials" in lower_out or "token expired" in lower_out or "invalid_grant" in lower_out:
                            print(f"[!] {provider} returned 401/Auth error. Performing automatic token refresh and retrying...")
                            fresh_token = await get_valid_token(user_id, provider, conn, force_refresh=True)
                            tool_output = await _run_provider_tool(fresh_token)
                    else:
                        server_url = conn.get("server_url")
                        if not server_url:
                            raise Exception(f"Server URL for provider '{provider}' is not configured.")
                        
                        from mcp_client import detect_transport
                        transport = conn.get("transport") or detect_transport(server_url)
                        
                        # Execute with a fresh inline connection per tool call.
                        async def _execute_remote_tool(token, url, tp, tool, tool_args):
                            import httpx
                            from mcp import ClientSession
                            headers = {"Authorization": f"Bearer {token}"}
                            if tp == "sse":
                                from mcp.client.sse import sse_client
                                async with sse_client(url, headers=headers) as (read, write):
                                    async with ClientSession(read, write) as sess:
                                        await sess.initialize()
                                        result = await sess.call_tool(tool, tool_args)
                                        return "\n".join([c.text for c in result.content if hasattr(c, "text")])
                            else:
                                from mcp.client.streamable_http import streamable_http_client
                                aclient = httpx.AsyncClient(headers=headers, timeout=httpx.Timeout(timeout=None, connect=15.0))
                                async with streamable_http_client(url, http_client=aclient) as (read, write, _):
                                    async with ClientSession(read, write) as sess:
                                        await sess.initialize()
                                        result = await sess.call_tool(tool, tool_args)
                                        return "\n".join([c.text for c in result.content if hasattr(c, "text")])
                        
                        try:
                            tool_output = await _execute_remote_tool(access_token, server_url, transport, mcp_tool_name, args)
                        except BaseException as first_error:
                            print(f"[-] MCP execution failed for {provider}: {first_error}. Retrying with fresh token.")
                            access_token = await get_valid_token(user_id, provider, conn, force_refresh=True)
                            try:
                                tool_output = await _execute_remote_tool(access_token, server_url, transport, mcp_tool_name, args)
                            except BaseException as retry_error:
                                tool_output = f"Error: Remote MCP tool execution failed after retry: {retry_error}"

                if not tool_output:
                    tool_output = "Success"
                            
            except Exception as e:
                tool_output = f"Error executing MCP tool: {str(e)}"
        else:
            tool_output = f"Error: Tool '{name}' is not supported on Web backend."


        await send_to_client({"type": "tool_success", "node_id": tc_id})
        short_res = str(tool_output)[:120] + '...' if len(str(tool_output)) > 120 else str(tool_output)
        await send_to_client({"type": "agent_thought", "content": f"Completed {name} successfully. Result: {short_res}"})
        return (tc_id, tool_output, True)

    except Exception as e:
        tc_id = tc.get("id", "unknown")
        name = tc.get("function", {}).get("name", "unknown")
        await send_to_client({"type": "tool_failed", "node_id": tc_id})
        await send_to_client({"type": "agent_thought", "content": f"Error in {name}: {str(e)}"})
        return (tc_id, f'Error executing tool {name}: {str(e)}', False)


async def run_agentic_loop(
    prompt: str,
    user_id: str,
    session_id: str,
    model_key: str = "deepseek-flash",
    history: list = None,
    manager_ref = None,
    client_time: str = None,
    client_websocket = None,
    variant: str = "High"
) -> AsyncGenerator[str, None]:
    api_key = os.getenv("OPENCODE_API_KEY")
    async def send_to_client(payload_dict):
        if client_websocket:
            try:
                await client_websocket.send_text(json.dumps(payload_dict))
            except:
                pass
        elif manager_ref and user_id in manager_ref.active_chats:
            for ws in manager_ref.active_chats[user_id]:
                try:
                    await ws.send_text(json.dumps(payload_dict))
                except:
                    pass

    consulted_sources = []
    web_search_called = False
    tool_context = {
        "web_search_called": False,
        "consulted_sources": consulted_sources,
        "map_tag": None,
        "weather_tag": None,
        "chart_tag": None,
        "flow_tag": None,
        "chemistry_tag": None,
        "timeline_tag": None,
        "calculator_tag": None
    }
    
    if not api_key:
        yield json.dumps({"type": "error", "content": "OPENCODE_API_KEY not configured on backend."})
        return

    model_id = get_opencode_model(model_key)
    
    # Load SOUL Memories
    soul_context = recall_user(user_id, "")
    current_time_str = client_time or datetime.now().strftime("%A, %B %d, %Y, %I:%M:%S %p")

    system_prompt = get_system_prompt()
    mcp_info = ""
    try:
        from database import get_user_settings_profile
        profile = get_user_settings_profile(user_id)
        connections = profile.get("mcp_connections") or {}
        print(f"[*] run_agentic_loop user_id: {user_id}, active mcp connections: {list(connections.keys())}")
        if connections:
            mcp_info = "\n--- ACTIVE MCP CONNECTIONS ---\n"
            for provider in connections.keys():
                if provider == "gmail":
                    mcp_info += (
                        "- Gmail is connected and fully authenticated via OAuth.\n"
                        "  You MUST use the 'gmail__search_threads', 'gmail__get_thread', 'gmail__create_draft', 'gmail__list_drafts', and 'gmail__list_labels' tools to access and manage the user's mailbox.\n"
                        "  Do not claim you cannot access emails, do not ask the user for passwords/credentials, and do not suggest opening a browser/laptop client; execute the tools directly.\n"
                    )
                else:
                    mcp_info += f"- {provider.title()} is connected.\n"
    except Exception as e:
        print(f"[-] Failed to get MCP info for system prompt: {e}")

    # Retrieve current session name
    session_name = "New Chat"
    try:
        from database import get_session
        session = get_session(session_id, user_id)
        if session:
            session_name = session.get("name", "New Chat")
    except Exception as e:
        print(f"[-] Failed to get session name for prompt: {e}")

    system_prompt += (
        f"\n\n--- DYNAMIC SESSION CONTEXT ---\n"
        f"The current session name is '{session_name}'.\n"
        f"The current local date and time is {current_time_str}. Use this exact timestamp when answering any queries. Never guess the time.\n"
        f"{mcp_info}"
        f"--- USER SOUL PROFILE MEMORIES ---\n{soul_context}\n\n"
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    if history:
        for msg in sanitize_history_roles(history):
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": prompt})

    if isinstance(variant, int):
        max_iterations = variant
    else:
        v_upper = (variant or "High").upper()
        if v_upper == "MAX":
            max_iterations = 20
        elif v_upper == "XHIGH":
            max_iterations = 15
        elif v_upper == "HIGH":
            max_iterations = 12
        else:
            max_iterations = 1

    # Ensure a hard cap of 20 iterations max under all conditions
    max_iterations = min(max_iterations, 20)

    # is_agentic is always True for run_agentic_loop — this flag gates MCP tool injection
    is_agentic = True

    for iteration in range(max_iterations):
        payload = {
            "model": model_id,
            "messages": messages,
            "stream": True
        }
        if is_agentic:
            mcp_tools = []
            try:
                from database import get_user_settings_profile
                profile = get_user_settings_profile(user_id)
                connections = profile.get("mcp_connections") or {}
                
                raw_mcp_tools = []
                for provider, conn in connections.items():
                    if provider == "gmail":
                        from mcp_servers.gmail.gmail_mcp import GMAIL_TOOLS
                        tools_list = GMAIL_TOOLS
                    else:
                        tools_list = conn.get("tools") or []
                    for t in tools_list:
                        raw_mcp_tools.append((provider, t))

                # Check if we need to filter tools (total > 8) to optimize context/distraction
                if len(raw_mcp_tools) > 8:
                    await send_to_client({"type": "hud_log", "content": "Searching tools..."})
                    
                    scored_tools = []
                    prompt_lower = prompt.lower()
                    
                    for provider, t in raw_mcp_tools:
                        name_lower = t["name"].lower()
                        desc_lower = t["description"].lower()
                        score = 0
                        
                        # Provider specific boosts based on user query
                        if provider == "gmail" and any(k in prompt_lower for k in ["mail", "email", "gmail", "inbox", "draft", "thread", "message", "reply", "send"]):
                            score += 8
                        if provider == "google_drive" and any(k in prompt_lower for k in ["drive", "google drive", "file", "doc", "sheet", "pdf", "folder", "upload", "search file", "read file", "slides"]):
                            score += 8
                            
                        # Word-by-word matching
                        for word in prompt_lower.split():
                            if len(word) > 2:
                                if word in name_lower:
                                    score += 3
                                if word in desc_lower:
                                    score += 1
                                    
                        scored_tools.append((score, provider, t))
                    
                    # Sort descending by score
                    scored_tools.sort(key=lambda x: x[0], reverse=True)
                    # Keep top 6 tools
                    selected = scored_tools[:6]
                    
                    for score, provider, t in selected:
                        mcp_tools.append({
                            "type": "function",
                            "function": {
                                "name": f"{provider}__{t['name']}",
                                "description": f"[{provider.upper()} MCP] {t['description']}",
                                "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}
                            }
                        })
                    
                    # Complete the searching tools step immediately in UI
                    await send_to_client({"type": "tool_success"})
                else:
                    for provider, t in raw_mcp_tools:
                        mcp_tools.append({
                            "type": "function",
                            "function": {
                                "name": f"{provider}__{t['name']}",
                                "description": f"[{provider.upper()} MCP] {t['description']}",
                                "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}
                            }
                        })
            except Exception as e:
                print(f"[-] Failed to fetch or inject MCP tools: {e}")
                
            payload["tools"] = TOOLS_SCHEMA + mcp_tools
            payload["tool_choice"] = "auto"


        payload.update(get_variant_overrides(variant))

        try:
            current_tool_calls = []
            assistant_text = ""
            raw_assistant_text = ""

            # Run stream
            async for delta in query_opencode_proxy(
                payload=payload,
                manager_ref=manager_ref,
                user_id=user_id,
                client_websocket=client_websocket
            ):
                if isinstance(delta, dict) and isinstance(delta.get("content"), str) and delta.get("content").startswith("Error:"):
                    yield json.dumps({"type": "error", "content": delta.get("content")})
                    return

                if "tool_calls" in delta:
                    tcalls = delta["tool_calls"]
                    for tc in tcalls:
                        idx = tc.get("index", 0)
                        while len(current_tool_calls) <= idx:
                            current_tool_calls.append({"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                        
                        if tc.get("id"):
                            current_tool_calls[idx]["id"] = tc["id"]
                        if tc["function"].get("name"):
                            current_tool_calls[idx]["function"]["name"] = tc["function"]["name"]
                        if tc["function"].get("arguments"):
                            current_tool_calls[idx]["function"]["arguments"] += tc["function"]["arguments"]
                
                if delta.get("content"):
                    content_delta = delta["content"]
                    raw_assistant_text += content_delta
                    yield json.dumps({"type": "token", "content": content_delta})
                    assistant_text += content_delta

            # Parse XML/DSML
            _, dsml_calls = parse_dsml_tool_calls(raw_assistant_text)
            if dsml_calls:
                current_tool_calls.extend(dsml_calls)

            if assistant_text:
                messages.append({"role": "assistant", "content": assistant_text})

            if current_tool_calls:
                # Clear the intermediate streamed tokens from the response bubble
                yield json.dumps({"type": "clear_tokens", "content": assistant_text})
                # Add to client's thinking steps as well
                if assistant_text.strip():
                    yield json.dumps({"type": "hud_log", "content": assistant_text.strip()})
            else:
                break

            # Execute tool calls
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["function"]["name"],
                            "arguments": tc["function"]["arguments"]
                        }
                    } for tc in current_tool_calls
                ]
            })

            nodes_plan = []
            for tc in current_tool_calls:
                tc_name = tc["function"]["name"]
                if tc_name == "rename_session":
                    continue
                try:
                    tc_args = json.loads(tc["function"]["arguments"] or "{}")
                except:
                    tc_args = {}
                nodes_plan.append({
                    "id": tc["id"],
                    "label": get_tool_label(tc_name, tc_args),
                    "status": "pending"
                })

            if client_websocket and nodes_plan:
                await client_websocket.send_text(json.dumps({
                    "type": "tool_plan",
                    "nodes": nodes_plan
                }))

            completed_ids = set()
            failed_ids = set()
            tool_outputs = {}

            # Execute tools in parallel (since we stripped dependencies for simplicity, execute all at once)
            tool_context["web_search_called"] = web_search_called
            tool_context["consulted_sources"] = consulted_sources
            tasks = [
                execute_tool_call_v2(
                    tc=tc,
                    user_id=user_id,
                    session_id=session_id,
                    client_websocket=client_websocket,
                    manager_ref=manager_ref,
                    client_time=client_time,
                    model_key=model_key,
                    tool_context=tool_context
                ) for tc in current_tool_calls
            ]
            results = await asyncio.gather(*tasks)
            web_search_called = tool_context['web_search_called']

            for tc_id, out, success in results:
                tool_outputs[tc_id] = out
                if success:
                    completed_ids.add(tc_id)
                else:
                    failed_ids.add(tc_id)

            for tc in current_tool_calls:
                tc_id = tc["id"]
                tool_output = tool_outputs.get(tc_id, "Error: Node execution failed.")
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc_id,
                    "content": tool_output
                })
        except Exception as e:
            yield json.dumps({"type": "error", "content": f"Agent loop failed: {str(e)}"})
            return

    # Force final synthesis if the loop exited after executing tool calls
    if messages and messages[-1]["role"] == "tool":
        try:
            payload = {
                "model": model_id,
                "messages": messages,
                "stream": True
            }
            payload.update(get_variant_overrides(variant))
            
            assistant_text = ""
            async for delta in query_opencode_proxy(
                payload=payload,
                manager_ref=manager_ref,
                user_id=user_id,
                client_websocket=client_websocket
            ):
                if isinstance(delta, dict) and isinstance(delta.get("content"), str) and delta.get("content").startswith("Error:"):
                    yield json.dumps({"type": "error", "content": delta.get("content")})
                    return
                if delta.get("content"):
                    yield json.dumps({"type": "token", "content": delta["content"]})
                    assistant_text += delta["content"]
            
            if assistant_text:
                messages.append({"role": "assistant", "content": assistant_text})
        except Exception as e:
            yield json.dumps({"type": "error", "content": f"Final synthesis failed: {str(e)}"})
            return

    if web_search_called or consulted_sources:
        if not consulted_sources:
            consulted_sources.append({"title": "Google Search", "url": "https://www.google.com"})
        seen_urls = set()
        unique_sources = []
        for s in consulted_sources:
            if s["url"] not in seen_urls:
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
            sources_tag = f'\n\n<Sources data="{sources_str}" />'
            if messages and messages[-1]["role"] == "assistant":
                if messages[-1]["content"]:
                    messages[-1]["content"] += sources_tag
                else:
                    messages[-1]["content"] = sources_tag
            else:
                messages.append({"role": "assistant", "content": sources_tag})
            yield json.dumps({"type": "token", "content": sources_tag})

    created_files_dict = tool_context.get("created_files", {})
    if created_files_dict:
        files_tag = ""
        for fname, fcode in created_files_dict.items():
            ext = fname.split(".")[-1].lower() if "." in fname else "txt"
            lang_tag = "html" if ext == "html" else "css" if ext == "css" else "python" if ext == "py" else "javascript" if ext in ("js", "jsx") else "typescript" if ext in ("ts", "tsx") else ext
            
            last_content = messages[-1].get("content", "") if messages and isinstance(messages[-1].get("content"), str) else ""
            if f"```{lang_tag} {fname}" not in last_content and fname not in last_content:
                files_tag += f"\n\n```{lang_tag} {fname}\n{fcode}\n```"
        
        if files_tag:
            if messages and messages[-1]["role"] == "assistant":
                if messages[-1]["content"]:
                    messages[-1]["content"] += files_tag
                else:
                    messages[-1]["content"] = files_tag
            else:
                messages.append({"role": "assistant", "content": files_tag})
            # Note: files_tag is saved to message content for Supabase DB persistence & workspace parsing,
            # but NOT yielded as text tokens so the chat stream remains clean and un-cluttered.

    if tool_context.get("map_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['map_tag']}"})

    if tool_context.get("weather_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['weather_tag']}"})

    if tool_context.get("chart_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['chart_tag']}"})

    if tool_context.get("flow_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['flow_tag']}"})

    if tool_context.get("timeline_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['timeline_tag']}"})

    if tool_context.get("calculator_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['calculator_tag']}"})

    # Log final accumulated assistant message (including created code files and tags) to Supabase DB
    if messages and messages[-1]["role"] == "assistant" and session_id:
        try:
            from database import log_message
            final_content_to_log = messages[-1].get("content") or ""
            if final_content_to_log.strip():
                log_message(session_id, "assistant", final_content_to_log)
        except Exception as db_err:
            print(f"[-] Failed to auto-persist WebSocket assistant response to Supabase DB: {db_err}")
