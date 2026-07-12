import httpx
import json
import asyncio

NOTION_TOOLS = [
    {
        "name": "search",
        "description": "Search Notion pages and databases by title.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Optional. The search query."
                },
                "filter": {
                    "type": "object",
                    "description": "Optional. Filter by object type. Example: {'value': 'page', 'property': 'object'}"
                },
                "pageSize": {
                    "type": "integer",
                    "description": "Optional. The number of results to return (max 100)."
                }
            }
        }
    },
    {
        "name": "fetch",
        "description": "Retrieve the block content (Markdown) and properties of a Notion page.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pageId": {
                    "type": "string",
                    "description": "Required. The Notion page ID."
                }
            },
            "required": ["pageId"]
        }
    },
    {
        "name": "create-pages",
        "description": "Create a new page in a Notion database or as a child of another page.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "parent": {
                    "type": "object",
                    "description": "Required. Parent page or database specifier. Example: {'page_id': '...'} or {'database_id': '...'}"
                },
                "properties": {
                    "type": "object",
                    "description": "Required. Properties schema matching the parent database or page."
                },
                "children": {
                    "type": "array",
                    "description": "Optional. Array of block contents to populate the page body."
                }
            },
            "required": ["parent", "properties"]
        }
    },
    {
        "name": "update-page",
        "description": "Update the properties or archived status of a Notion page.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pageId": {
                    "type": "string",
                    "description": "Required. The page ID to update."
                },
                "properties": {
                    "type": "object",
                    "description": "Optional. Properties to update."
                },
                "archived": {
                    "type": "boolean",
                    "description": "Optional. Set to true to archive (delete) the page."
                }
            },
            "required": ["pageId"]
        }
    },
    {
        "name": "create-comment",
        "description": "Add a comment to a Notion page or discussion thread.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pageId": {
                    "type": "string",
                    "description": "Required. The page ID to comment on."
                },
                "text": {
                    "type": "string",
                    "description": "Required. The comment content text."
                }
            },
            "required": ["pageId", "text"]
        }
    },
    {
        "name": "get-comments",
        "description": "Retrieve comments for a Notion page block.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "blockId": {
                    "type": "string",
                    "description": "Required. The page block ID."
                }
            },
            "required": ["blockId"]
        }
    },
    {
        "name": "get-users",
        "description": "Retrieve a list of users in the Notion workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get-self",
        "description": "Get detailed bot identity and workspace metadata.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get-user",
        "description": "Retrieve details of a specific workspace user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userId": {
                    "type": "string",
                    "description": "Required. The user ID."
                }
            },
            "required": ["userId"]
        }
    },
    {
        "name": "move-pages",
        "description": "Move a Notion page to a new parent page or database.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pageId": {
                    "type": "string",
                    "description": "Required. The page ID to move."
                },
                "parent": {
                    "type": "object",
                    "description": "Required. New parent specifier, e.g. {'page_id': '...'} or {'database_id': '...'}"
                }
            },
            "required": ["pageId", "parent"]
        }
    },
    {
        "name": "duplicate-page",
        "description": "Duplicate an existing Notion page (clones page properties and body).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pageId": {
                    "type": "string",
                    "description": "Required. The page ID to duplicate."
                }
            },
            "required": ["pageId"]
        }
    },
    {
        "name": "create-database",
        "description": "Create a new database under a parent page.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "parent": {
                    "type": "object",
                    "description": "Required. Parent page specifier, e.g. {'page_id': '...'}"
                },
                "title": {
                    "type": "array",
                    "description": "Required. Title of the database (rich text array)."
                },
                "properties": {
                    "type": "object",
                    "description": "Required. Properties schema (columns) of the database."
                }
            },
            "required": ["parent", "title", "properties"]
        }
    },
    {
        "name": "update-database",
        "description": "Update schema properties or title of an existing Notion database.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "databaseId": {
                    "type": "string",
                    "description": "Required. The database ID."
                },
                "properties": {
                    "type": "object",
                    "description": "Required. Properties (columns) to add or update."
                }
            },
            "required": ["databaseId", "properties"]
        }
    }
]

def blocks_to_markdown(blocks: list) -> str:
    """Helper to convert Notion block components to clean human-readable Markdown."""
    lines = []
    for b in blocks:
        b_type = b.get("type")
        if not b_type:
            continue
        content = b.get(b_type, {})
        rich_text = content.get("rich_text", [])
        text = "".join([t.get("plain_text", "") for t in rich_text])
        
        if b_type == "paragraph":
            lines.append(text)
        elif b_type.startswith("heading_"):
            try:
                level = int(b_type.split("_")[1])
                lines.append(f"{'#' * level} {text}")
            except Exception:
                lines.append(f"### {text}")
        elif b_type == "bulleted_list_item":
            lines.append(f"- {text}")
        elif b_type == "numbered_list_item":
            lines.append(f"1. {text}")
        elif b_type == "to_do":
            checked = "[x]" if content.get("checked") else "[ ]"
            lines.append(f"{checked} {text}")
        elif b_type == "code":
            lang = content.get("language", "text")
            code_text = "".join([t.get("plain_text", "") for t in content.get("rich_text", [])])
            lines.append(f"```{lang}\n{code_text}\n```")
        elif b_type == "quote":
            lines.append(f"> {text}")
        elif b_type == "callout":
            lines.append(f"> 💡 {text}")
    return "\n\n".join(lines)

async def execute_notion_tool(tool_name: str, args: dict, access_token: str) -> str:
    """Execute a Notion API REST call locally using your OAuth credentials."""
    action = tool_name.replace("notion__", "").replace("notion.", "")
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if action == "get-self":
                r = await client.get("https://api.notion.com/v1/users/me", headers=headers)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "get-users":
                r = await client.get("https://api.notion.com/v1/users", headers=headers)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "get-user":
                user_id = args.get("userId")
                if not user_id:
                    return "Error: userId parameter is required."
                r = await client.get(f"https://api.notion.com/v1/users/{user_id}", headers=headers)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "search":
                payload = {}
                if "query" in args:
                    payload["query"] = args["query"]
                if "filter" in args:
                    payload["filter"] = args["filter"]
                if "pageSize" in args:
                    payload["page_size"] = args["pageSize"]
                    
                r = await client.post("https://api.notion.com/v1/search", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "fetch":
                page_id = args.get("pageId")
                if not page_id:
                    return "Error: pageId parameter is required."
                
                # Clean potential dash anomalies from page ID if present
                clean_id = page_id.replace("-", "")
                # Format to standard Notion UUID layout if it has 32 chars
                if len(clean_id) == 32:
                    clean_id = f"{clean_id[:8]}-{clean_id[8:12]}-{clean_id[12:16]}-{clean_id[16:20]}-{clean_id[20:]}"
                
                # 1. Fetch page details (title)
                page_res = await client.get(f"https://api.notion.com/v1/pages/{clean_id}", headers=headers)
                if page_res.status_code != 200:
                    return f"Failed to retrieve page meta: {page_res.text}"
                page_data = page_res.json()
                
                # Locate page title
                properties = page_data.get("properties", {})
                title_prop = properties.get("title", properties.get("Name", {}))
                title_parts = title_prop.get("title", []) if isinstance(title_prop, dict) else []
                title = "".join([t.get("plain_text", "") for t in title_parts]) or "Untitled Page"

                # 2. Fetch page block children
                blocks_res = await client.get(f"https://api.notion.com/v1/blocks/{clean_id}/children", headers=headers)
                if blocks_res.status_code != 200:
                    return f"Failed to retrieve page body content: {blocks_res.text}"
                
                blocks = blocks_res.json().get("results", [])
                markdown = blocks_to_markdown(blocks)
                
                output = f"# {title}\n\n"
                output += markdown if markdown else "*[Empty Page]*"
                return output
                
            elif action == "create-pages":
                payload = {
                    "parent": args["parent"],
                    "properties": args["properties"]
                }
                if "children" in args:
                    payload["children"] = args["children"]
                r = await client.post("https://api.notion.com/v1/pages", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "update-page":
                page_id = args.get("pageId")
                if not page_id:
                    return "Error: pageId is required."
                payload = {}
                if "properties" in args:
                    payload["properties"] = args["properties"]
                if "archived" in args:
                    payload["archived"] = args["archived"]
                r = await client.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "create-comment":
                page_id = args.get("pageId")
                text = args.get("text")
                if not page_id or not text:
                    return "Error: pageId and text are required."
                payload = {
                    "parent": {"page_id": page_id},
                    "rich_text": [{"text": {"content": text}}]
                }
                r = await client.post("https://api.notion.com/v1/comments", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"
                
            elif action == "get-comments":
                block_id = args.get("blockId")
                if not block_id:
                    return "Error: blockId is required."
                r = await client.get(f"https://api.notion.com/v1/comments?block_id={block_id}", headers=headers)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"

            elif action == "move-pages":
                page_id = args.get("pageId")
                parent = args.get("parent")
                if not page_id or not parent:
                    return "Error: pageId and parent are required."
                payload = {"parent": parent}
                r = await client.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"

            elif action == "duplicate-page":
                page_id = args.get("pageId")
                if not page_id:
                    return "Error: pageId is required."
                # 1. Fetch metadata
                meta_res = await client.get(f"https://api.notion.com/v1/pages/{page_id}", headers=headers)
                if meta_res.status_code != 200:
                    return f"Failed to read source page details: {meta_res.text}"
                meta = meta_res.json()

                # 2. Fetch body
                blocks_res = await client.get(f"https://api.notion.com/v1/blocks/{page_id}/children", headers=headers)
                blocks = blocks_res.json().get("results", []) if blocks_res.status_code == 200 else []

                # Remove read-only properties from copy block list
                clean_blocks = []
                for b in blocks:
                    b_type = b.get("type")
                    if b_type:
                        clean_blocks.append({
                            "object": "block",
                            "type": b_type,
                            b_type: b[b_type]
                        })

                # 3. Create duplicate page in same parent
                payload = {
                    "parent": meta["parent"],
                    "properties": meta["properties"],
                    "children": clean_blocks
                }
                # Ensure read-only properties like ID/formula/created_time are omitted
                payload["properties"].pop("id", None)
                r = await client.post("https://api.notion.com/v1/pages", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"

            elif action == "create-database":
                payload = {
                    "parent": args["parent"],
                    "title": args["title"],
                    "properties": args["properties"]
                }
                r = await client.post("https://api.notion.com/v1/databases", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"

            elif action == "update-database":
                database_id = args.get("databaseId")
                if not database_id:
                    return "Error: databaseId is required."
                payload = {"properties": args["properties"]}
                r = await client.patch(f"https://api.notion.com/v1/databases/{database_id}", headers=headers, json=payload)
                return json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.text}"

            else:
                return f"Error: Notion tool action '{action}' is not supported locally."

        except Exception as err:
            return f"Error executing Notion REST tool call: {str(err)}"
