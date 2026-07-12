import httpx
import json
import base64
import asyncio
import re

CURATED_METHOD_IDS = [
    "drive.files.list",
    "drive.files.get",
    "drive.files.create",
    "drive.files.update",
    "drive.files.delete",
    "drive.files.copy",
    "drive.files.export",
    "drive.files.generateIds",
    "drive.comments.list",
    "drive.comments.create",
    "drive.permissions.list",
    "drive.permissions.create",
    "drive.permissions.delete",
    "drive.about.get"
]

DISCOVERY_CACHE = None

async def get_discovery_doc() -> dict:
    """Fetch and cache the Google Drive v3 REST Discovery document."""
    global DISCOVERY_CACHE
    if DISCOVERY_CACHE is not None:
        return DISCOVERY_CACHE
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get("https://www.googleapis.com/discovery/v1/apis/drive/v3/rest")
        if res.status_code == 200:
            DISCOVERY_CACHE = res.json()
            return DISCOVERY_CACHE
    raise Exception("Failed to fetch Google Drive Discovery document.")

def find_method_info(discovery_doc: dict, method_id: str) -> dict:
    """Locate the method information within the discovery resource tree."""
    parts = method_id.split(".")
    current = discovery_doc
    for part in parts[1:]:
        if "resources" in current and part in current["resources"]:
            current = current["resources"][part]
        elif "methods" in current and part in current["methods"]:
            return current["methods"][part]
    return None

async def discover_drive_tools(access_token: str) -> list:
    """Query the Google Drive Discovery API dynamically and construct MCP tool schemas."""
    try:
        doc = await get_discovery_doc()
    except Exception as e:
        print(f"[-] Drive discovery failed: {e}")
        return []

    tools_list = []
    for method_id in CURATED_METHOD_IDS:
        method_info = find_method_info(doc, method_id)
        if not method_info:
            continue

        # Strip the 'drive.' prefix and replace dots with underscores for valid LLM tool naming
        mcp_name = method_id.replace("drive.", "").replace(".", "_")
        description = method_info.get("description", f"Execute Google Drive {mcp_name} action.")

        properties = {}
        required_params = []

        # Map query and path parameters
        method_params = method_info.get("parameters", {})
        for param_name, param_info in method_params.items():
            location = param_info.get("location")
            if location in ("path", "query"):
                properties[param_name] = {
                    "type": param_info.get("type", "string"),
                    "description": param_info.get("description", "")
                }
                if param_info.get("required"):
                    required_params.append(param_name)

        # Add support for request body if the method expects one
        if "request" in method_info:
            ref_name = method_info["request"].get("$ref")
            properties["requestBody"] = {
                "type": "object",
                "description": f"Optional. The request body (JSON object) matching the '{ref_name}' resource schema."
            }

        # Custom enhancements for file uploads on create/update
        if mcp_name in ("files_create", "files_update"):
            properties["media_content"] = {
                "type": "string",
                "description": "Optional. The file content (plain text) to upload as the file payload."
            }

        tools_list.append({
            "name": mcp_name,
            "description": description,
            "inputSchema": {
                "type": "object",
                "properties": properties,
                "required": required_params
            }
        })

    return tools_list

async def execute_google_drive_tool(tool_name: str, args: dict, access_token: str) -> str:
    """Execute a Google Drive REST call based on its dynamically-resolved discovery template."""
    # Ensure correct method id (e.g. google_drive__files_list -> drive.files.list)
    action = tool_name.replace("google_drive__", "").replace("google_drive.", "").replace("_", ".")
    method_id = f"drive.{action}"

    try:
        doc = await get_discovery_doc()
    except Exception as e:
        return f"Error: Failed to load Google Drive API discovery document: {e}"

    method_info = find_method_info(doc, method_id)
    if not method_info:
        return f"Error: Unknown Google Drive tool '{tool_name}'."

    http_method = method_info.get("httpMethod", "GET")
    # Google's discovery uses basePath + path. basePath is "/drive/v3/"
    base_path = doc.get("basePath", "/drive/v3/")
    path_template = method_info.get("flatPath", method_info.get("path", ""))

    # Resolve path variables and separate query parameters
    path_params = re.findall(r"\{([^}]+)\}", path_template)
    resolved_path = path_template
    remaining_args = args.copy()

    for param in path_params:
        if param in remaining_args:
            val = remaining_args.pop(param)
            resolved_path = resolved_path.replace(f"{{{param}}}", str(val))
        else:
            return f"Error: Required path parameter '{param}' was not provided."

    # Construct the final API URL
    url = "https://www.googleapis.com" + base_path + resolved_path.lstrip("/")

    # Distinguish headers, query parameters, and payload body
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    }

    query_params = {}
    method_params = method_info.get("parameters", {})
    for k, v in remaining_args.items():
        if k in method_params and method_params[k].get("location") == "query":
            query_params[k] = v

    request_body = remaining_args.get("requestBody")
    media_content = remaining_args.get("media_content")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Custom handler for file uploads with actual file content
            if action in ("files.create", "files.update") and media_content is not None:
                metadata = request_body or {}
                name = metadata.get("name", "Untitled")
                mime_type = metadata.get("mimeType", "text/plain")

                # Multipart related upload
                boundary = "voxkage_drive_boundary"
                body_parts = [
                    f"--{boundary}\r\n",
                    f"Content-Type: application/json; charset=UTF-8\r\n\r\n",
                    f"{json.dumps(metadata)}\r\n",
                    f"--{boundary}\r\n",
                    f"Content-Type: {mime_type}\r\n\r\n",
                    f"{media_content}\r\n",
                    f"--{boundary}--"
                ]
                body_content = "".join(body_parts).encode("utf-8")

                upload_headers = headers.copy()
                upload_headers["Content-Type"] = f"multipart/related; boundary={boundary}"

                # Update uses PUT/PATCH, Create uses POST
                upload_url = "https://www.googleapis.com/upload/drive/v3/files"
                if action == "files.update":
                    # Extract fileId from the resolved url or args
                    file_id = args.get("fileId")
                    if not file_id:
                        return "Error: fileId is required for files.update."
                    upload_url = f"https://www.googleapis.com/upload/drive/v3/files/{file_id}"

                # Propagate any other query parameters (e.g. supportsAllDrives)
                query_params["uploadType"] = "multipart"

                res = await client.request(
                    method=http_method,
                    url=upload_url,
                    headers=upload_headers,
                    params=query_params,
                    content=body_content
                )

            # Custom handler for downloading binary / Workspace documents
            elif action == "files.get" and query_params.get("alt") == "media":
                file_id = args.get("fileId")
                if not file_id:
                    return "Error: fileId is required for files.get."

                # 1. Fetch file metadata first to check mimeType
                meta_res = await client.get(
                    f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=mimeType,name",
                    headers=headers
                )
                if meta_res.status_code != 200:
                    return f"Failed to retrieve file details: {meta_res.text}"

                meta = meta_res.json()
                mime_type = meta.get("mimeType", "")
                name = meta.get("name", "")

                # 2. If it is a Google Doc/Sheet/Slide, export it to human-readable format
                if mime_type == "application/vnd.google-apps.document":
                    res = await client.get(
                        f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/plain",
                        headers=headers
                    )
                elif mime_type == "application/vnd.google-apps.spreadsheet":
                    res = await client.get(
                        f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/csv",
                        headers=headers
                    )
                elif mime_type == "application/vnd.google-apps.presentation":
                    res = await client.get(
                        f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=text/plain",
                        headers=headers
                    )
                else:
                    # Regular files direct download
                    res = await client.get(url, headers=headers, params=query_params)

                if res.status_code != 200:
                    return f"Failed to read file content: {res.text}"

                try:
                    text_val = res.text
                    if len(text_val) > 15000:
                        text_val = text_val[:15000] + "\n\n...[truncated — file exceeds 15,000 characters]"
                    return f"### Content of '{name}' (ID: `{file_id}`):\n\n{text_val}"
                except Exception:
                    return f"File '{name}' (ID: `{file_id}`) is binary and cannot be displayed as plain text."

            # General REST request handler
            else:
                json_body = request_body if http_method in ("POST", "PUT", "PATCH") else None
                res = await client.request(
                    method=http_method,
                    url=url,
                    headers=headers,
                    params=query_params,
                    json=json_body
                )

            # Format outputs nicely
            if res.status_code not in (200, 201, 204):
                return f"Google Drive API returned error {res.status_code}: {res.text}"

            if res.status_code == 204:
                return "Action completed successfully (No Content returned)."

            # Pretty-print JSON responses for the agent
            try:
                data = res.json()
                return json.dumps(data, indent=2)
            except Exception:
                return res.text

        except Exception as e:
            return f"Error executing Google Drive REST tool: {str(e)}"
