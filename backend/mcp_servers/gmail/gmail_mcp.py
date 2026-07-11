import httpx
import base64
from email.mime.text import MIMEText
import asyncio

# --- Gmail Tool Schemas (exposed to the agent loop) ---
GMAIL_TOOLS = [
    {
        "name": "create_draft",
        "description": "Create a draft email in the user's Gmail mailbox.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient email address."},
                "subject": {"type": "string", "description": "Email subject line."},
                "body": {"type": "string", "description": "Plain text body content."}
            },
            "required": ["to", "subject", "body"]
        }
    },
    {
        "name": "get_thread",
        "description": "Retrieve all messages in a specific email thread by its thread ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "thread_id": {"type": "string", "description": "The unique thread ID."}
            },
            "required": ["thread_id"]
        }
    },
    {
        "name": "list_drafts",
        "description": "List existing email drafts in the user's Gmail mailbox.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "max_results": {"type": "integer", "description": "Max drafts to list (default: 10).", "default": 10}
            }
        }
    },
    {
        "name": "list_labels",
        "description": "List all labels (folders) in the user's Gmail account.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "search_threads",
        "description": "Search email threads using Gmail query syntax (e.g. 'from:boss', 'is:unread').",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Gmail search query syntax (e.g. 'is:unread', 'has:attachment')."},
                "max_results": {"type": "integer", "description": "Max threads to fetch (default: 10).", "default": 10}
            },
            "required": ["query"]
        }
    }
]

def _get_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

def decode_body(payload) -> str:
    if not payload:
        return ""
    parts = payload.get("parts", [])
    if not parts:
        data = payload.get("body", {}).get("data", "")
        if data:
            try:
                return base64.urlsafe_b64decode(data).decode("utf-8")
            except Exception:
                pass
        return ""
    for part in parts:
        mime = part.get("mimeType")
        if mime == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                try:
                    return base64.urlsafe_b64decode(data).decode("utf-8")
                except Exception:
                    pass
        elif part.get("parts"):
            res = decode_body(part)
            if res:
                return res
    return ""

async def execute_gmail_tool(tool_name: str, args: dict, access_token: str) -> str:
    """Execute a Gmail REST API call using the user's decrypted OAuth access token."""
    headers = _get_headers(access_token)
    # Strip the 'gmail__' prefix if present
    action = tool_name.replace("gmail__", "")

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            if action == "create_draft":
                to = args.get("to")
                subject = args.get("subject")
                body = args.get("body")
                if not to or not subject or not body:
                    return "Error: 'to', 'subject', and 'body' are all required."

                mime_msg = MIMEText(body)
                mime_msg["to"] = to
                mime_msg["subject"] = subject
                raw_b64 = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")

                res = await client.post(
                    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
                    headers=headers, json={"message": {"raw": raw_b64}}
                )
                if res.status_code not in (200, 201):
                    return f"Failed to create draft: {res.text}"
                return f"Draft created successfully. Draft ID: {res.json().get('id')}"

            elif action == "get_thread":
                thread_id = args.get("thread_id")
                if not thread_id:
                    return "Error: thread_id is required."

                res = await client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{thread_id}",
                    headers=headers
                )
                if res.status_code != 200:
                    return f"Failed to retrieve thread {thread_id}: {res.text}"

                data = res.json()
                messages = data.get("messages", [])
                if not messages:
                    return f"No messages found in thread {thread_id}."

                lines = [f"### Thread ID: {thread_id} ({len(messages)} messages)"]
                for msg in messages:
                    hdrs = msg.get("payload", {}).get("headers", [])
                    subj = next((h["value"] for h in hdrs if h["name"].lower() == "subject"), "(No Subject)")
                    sender = next((h["value"] for h in hdrs if h["name"].lower() == "from"), "(Unknown Sender)")
                    date = next((h["value"] for h in hdrs if h["name"].lower() == "date"), "(No Date)")
                    body = decode_body(msg.get("payload", {}))
                    if not body:
                        body = msg.get("snippet", "")
                    lines.append(f"**From:** {sender}\n**Date:** {date}\n**Subject:** {subj}\n\n{body}\n---")
                return "\n\n".join(lines)

            elif action == "list_drafts":
                max_results = int(args.get("max_results", 10))
                res = await client.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
                    headers=headers, params={"maxResults": max_results}
                )
                if res.status_code != 200:
                    return f"Failed to list drafts: {res.text}"

                drafts = res.json().get("drafts", [])
                if not drafts:
                    return "No drafts found."

                # Fetch details of top 5 drafts concurrently
                detail_tasks = [
                    client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/drafts/{d['id']}",
                        headers=headers
                    )
                    for d in drafts[:5]
                ]
                results = await asyncio.gather(*detail_tasks, return_exceptions=True)
                lines = [f"Found {len(drafts)} drafts (showing details for top 5):"]
                for r in results:
                    if isinstance(r, Exception) or r.status_code != 200:
                        continue
                    data = r.json()
                    msg = data.get("message", {})
                    hdrs = msg.get("payload", {}).get("headers", [])
                    subj = next((h["value"] for h in hdrs if h["name"].lower() == "subject"), "(No Subject)")
                    to = next((h["value"] for h in hdrs if h["name"].lower() == "to"), "(No Recipient)")
                    lines.append(f"- **Draft ID:** {data['id']}\n  **To:** {to}\n  **Subject:** {subj}\n  **Snippet:** {msg.get('snippet', '')}")
                
                if len(drafts) > 5:
                    for d in drafts[5:]:
                        lines.append(f"- **Draft ID:** {d['id']}")
                return "\n\n".join(lines)

            elif action == "list_labels":
                res = await client.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
                    headers=headers
                )
                if res.status_code != 200:
                    return f"Failed to list labels: {res.text}"

                labels = res.json().get("labels", [])
                lines = ["### Mailbox Labels:"]
                for label in labels:
                    lines.append(f"- **Name:** {label.get('name')} (ID: {label.get('id')}, Type: {label.get('type')})")
                return "\n".join(lines)

            elif action == "search_threads":
                query = args.get("query", "")
                max_results = int(args.get("max_results", 10))
                params = {"maxResults": max_results}
                if query:
                    params["q"] = query

                res = await client.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/threads",
                    headers=headers, params=params
                )
                if res.status_code != 200:
                    return f"Failed to search threads: {res.text}"

                threads = res.json().get("threads", [])
                if not threads:
                    return f"No threads found matching query: '{query}'"

                detail_tasks = [
                    client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{t['id']}",
                        headers=headers
                    )
                    for t in threads[:5]
                ]
                results = await asyncio.gather(*detail_tasks, return_exceptions=True)
                lines = [f"Found {len(threads)} threads matching '{query}' (showing top 5):"]
                for r in results:
                    if isinstance(r, Exception) or r.status_code != 200:
                        continue
                    data = r.json()
                    msgs = data.get("messages", [])
                    if not msgs:
                        continue
                    first_msg = msgs[0]
                    hdrs = first_msg.get("payload", {}).get("headers", [])
                    subj = next((h["value"] for h in hdrs if h["name"].lower() == "subject"), "(No Subject)")
                    sender = next((h["value"] for h in hdrs if h["name"].lower() == "from"), "(Unknown Sender)")
                    date = next((h["value"] for h in hdrs if h["name"].lower() == "date"), "(No Date)")
                    lines.append(f"- **Thread ID:** {data['id']} ({len(msgs)} messages)\n  **From:** {sender}\n  **Subject:** {subj}\n  **Date:** {date}\n  **Snippet:** {first_msg.get('snippet', '')}")
                
                if len(threads) > 5:
                    for t in threads[5:]:
                        lines.append(f"- **Thread ID:** {t['id']}")
                return "\n\n".join(lines)

            return f"Error: Unknown Gmail tool action '{action}'."

        except Exception as err:
            return f"Error executing Gmail tool: {str(err)}"

# Top-level dispatcher
async def execute_google_tool(provider: str, tool_name: str, args: dict, access_token: str) -> str:
    if provider == "gmail":
        return await execute_gmail_tool(tool_name, args, access_token)
    return f"Error: Provider '{provider}' is not supported."
