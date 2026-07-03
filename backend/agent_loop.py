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
            import urllib.parse
            if name in ("web_search", "web_search_deep"):
                q = args.get("query", "")
                if q:
                    tool_context["consulted_sources"].append({
                        "title": f"DuckDuckGo Search: {q}",
                        "url": f"https://duckduckgo.com/?q={urllib.parse.quote(q)}"
                    })
            elif name == "web_fetch":
                u = args.get("url", "")
                if u:
                    tool_context["consulted_sources"].append({"title": u, "url": u})
            elif name == "web_search_parallel":
                for q in args.get("queries", []):
                    if q:
                        tool_context["consulted_sources"].append({
                            "title": f"DuckDuckGo Search: {q}",
                            "url": f"https://duckduckgo.com/?q={urllib.parse.quote(q)}"
                        })
            elif name == "web_fetch_parallel":
                for u in args.get("urls", []):
                    if u:
                        tool_context["consulted_sources"].append({"title": u, "url": u})
            elif name == "browse_and_extract_tool":
                u = args.get("url", "")
                q = args.get("query", "")
                if u:
                    tool_context["consulted_sources"].append({"title": u, "url": u})
                elif q:
                    tool_context["consulted_sources"].append({
                        "title": f"DuckDuckGo Search: {q}",
                        "url": f"https://duckduckgo.com/?q={urllib.parse.quote(q)}"
                    })

        tc_id = tc["id"]
        tool_output = ""

        # --- Route Search and Fetch Tools ---
        if name in {"web_search", "web_fetch", "web_search_parallel", "web_fetch_parallel", "web_search_deep", "get_images", "show_map", "get_weather", "render_chart", "render_flow", "get_chemical_structure", "render_timeline", "render_calculator"}:
            announcement = ""
            if name == "get_images":
                announcement = f"Searching free image assets for: '{args.get('query', '')}'..."
            elif name == "show_map":
                announcement = f"Rendering interactive dark map view..."
            elif name == "get_weather":
                announcement = f"Retrieving local weather forecast reports..."
            elif name == "render_chart":
                announcement = f"Generating interactive dark analytics chart: '{args.get('title', '')}'..."
            elif name == "render_flow":
                announcement = f"Generating responsive process pipeline: '{args.get('title', '')}'..."
            elif name == "get_chemical_structure":
                announcement = f"Retrieving structural chemistry data for: '{args.get('compound_name', '')}'..."
            elif name == "render_timeline":
                announcement = f"Generating collapsible history timeline: '{args.get('title', '')}'..."
            elif name == "render_calculator":
                announcement = f"Configuring interactive finance calculator: '{args.get('title', '')}'..."
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
            elif name == "render_flow":
                title = args.get("title", "")
                nodes_list = args.get("nodes", [])
                edges_list = args.get("edges", [])
                
                formatted_nodes = []
                for n in nodes_list:
                    n_id = str(n.get("id", "")).replace("|", "").replace(";", "")
                    n_lbl = str(n.get("label", "")).replace("|", "").replace(";", "")
                    n_desc = str(n.get("description", "") or "empty").replace("|", "").replace(";", "")
                    n_cat = str(n.get("category", "") or "empty").replace("|", "").replace(";", "")
                    formatted_nodes.append(f"{n_id}|{n_lbl}|{n_desc}|{n_cat}")
                nodes_str = "||".join(formatted_nodes)
                
                formatted_edges = []
                for e in edges_list:
                    e_from = str(e.get("from_id", "")).replace("|", "").replace(";", "")
                    e_to = str(e.get("to_id", "")).replace("|", "").replace(";", "")
                    e_lbl = str(e.get("label", "") or "empty").replace("|", "").replace(";", "")
                    formatted_edges.append(f"{e_from}|{e_to}|{e_lbl}")
                edges_str = "||".join(formatted_edges)
                
                tool_context["flow_tag"] = f'<Flow title="{title}" nodes="{nodes_str}" edges="{edges_str}" />'
                tool_output = json.dumps({"status": "success", "title": title, "nodes_count": len(nodes_list), "edges_count": len(edges_list)})
            elif name == "get_chemical_structure":
                comp = args.get("compound_name", "")
                smiles = args.get("smiles_notation", "")
                
                formula = "Unknown"
                weight = "Unknown"
                canonical_smiles = smiles or "Unknown"
                
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{comp}/property/MolecularFormula,MolecularWeight,CanonicalSMILES/JSON"
                        r = await client.get(url)
                        if r.status_code == 200:
                            props = r.json().get("PropertyTable", {}).get("Properties", [{}])[0]
                            formula = props.get("MolecularFormula", "Unknown")
                            weight = str(props.get("MolecularWeight", "Unknown"))
                            canonical_smiles = smiles or props.get("CanonicalSMILES", "Unknown")
                except:
                    pass
                    
                tool_context["chemistry_tag"] = f'<Chemistry compound="{comp}" formula="{formula}" weight="{weight}" smiles="{canonical_smiles}" />'
                tool_output = json.dumps({"status": "success", "compound": comp, "formula": formula, "weight": weight, "smiles": canonical_smiles})
            elif name == "render_timeline":
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
            elif name == "render_calculator":
                c_type = args.get("type", "loan")
                title = args.get("title", "")
                tool_context["calculator_tag"] = f'<Calculator type="{c_type}" title="{title}" />'
                tool_output = json.dumps({"status": "success", "type": c_type, "title": title})
            elif name == "web_search":
                tool_context["web_search_called"] = True
                q = args.get("query", "")
                search_res = await web_search(q)
                tool_output = json.dumps(search_res)
                if isinstance(search_res, list):
                    for r in search_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            tool_context["consulted_sources"].append({"title": r.get("title") or r.get("url"), "url": r.get("url")})
            elif name == "web_fetch":
                tool_context["web_search_called"] = True
                u = args.get("url", "")
                fetch_res = await web_fetch(u)
                tool_output = json.dumps(fetch_res)
                if isinstance(fetch_res, dict) and fetch_res.get("url") and "error" not in fetch_res:
                    tool_context["consulted_sources"].append({"title": fetch_res.get("url"), "url": fetch_res.get("url")})
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
                                    tool_context["consulted_sources"].append({"title": r.get("title") or r.get("url"), "url": r.get("url")})
            elif name == "web_fetch_parallel":
                tool_context["web_search_called"] = True
                urls = args.get("urls", [])
                fetch_res = await web_fetch_parallel(urls)
                tool_output = json.dumps(fetch_res)
                if isinstance(fetch_res, list):
                    for r in fetch_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            tool_context["consulted_sources"].append({"title": r.get("url"), "url": r.get("url")})
            elif name == "web_search_deep":
                tool_context["web_search_called"] = True
                q = args.get("query", "")
                deep_res = await web_search_deep(q)
                tool_output = json.dumps(deep_res)
                if isinstance(deep_res, list):
                    for r in deep_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            tool_context["consulted_sources"].append({"title": r.get("title") or r.get("url"), "url": r.get("url")})

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
                tool_output = json.dumps(res)
            else:
                tool_output = f"Error: Uploaded file '{filename}' not found on server disk. Cannot index."

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
                if isinstance(fetch_res, dict) and fetch_res.get("url") and "error" not in fetch_res:
                    tool_context["consulted_sources"].append({"title": fetch_res.get("url"), "url": fetch_res.get("url")})
            else:
                search_res = await web_search(q)
                tool_output = json.dumps(search_res)
                if isinstance(search_res, list):
                    for r in search_res:
                        if isinstance(r, dict) and r.get("url") and "error" not in r:
                            tool_context["consulted_sources"].append({"title": r.get("title") or r.get("url"), "url": r.get("url")})

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
    system_prompt += (
        f"\n\n--- DYNAMIC SESSION CONTEXT ---\n"
        f"The current local date and time is {current_time_str}. Use this exact timestamp when answering any queries. Never guess the time.\n"
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

    v_upper = (variant or "High").upper()
    is_agentic = v_upper in ("HIGH", "XHIGH", "MAX")
    max_iterations = 12 if is_agentic else 1

    for iteration in range(max_iterations):
        payload = {
            "model": model_id,
            "messages": messages,
            "stream": True
        }
        if is_agentic:
            payload["tools"] = TOOLS_SCHEMA
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
                try:
                    tc_args = json.loads(tc["function"]["arguments"] or "{}")
                except:
                    tc_args = {}
                nodes_plan.append({
                    "id": tc["id"],
                    "label": get_tool_label(tc_name, tc_args),
                    "status": "pending"
                })

            if client_websocket:
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
            sources_str = "||".join([f"{s['title'].replace('|', '-').replace('<', '').replace('>', '')}|{s['url']}" for s in unique_sources])
            sources_tag = f'\n\n<Sources data="{sources_str}" />'
            yield json.dumps({"type": "token", "content": sources_tag})

    if tool_context.get("map_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['map_tag']}"})

    if tool_context.get("weather_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['weather_tag']}"})

    if tool_context.get("chart_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['chart_tag']}"})

    if tool_context.get("flow_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['flow_tag']}"})

    if tool_context.get("chemistry_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['chemistry_tag']}"})

    if tool_context.get("timeline_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['timeline_tag']}"})

    if tool_context.get("calculator_tag"):
        yield json.dumps({"type": "token", "content": f"\n\n{tool_context['calculator_tag']}"})
