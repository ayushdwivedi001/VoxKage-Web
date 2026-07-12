import httpx
import json
import asyncio
import re

CALENDAR_TOOL_MAPPING = {
    "create_event": "calendar.events.insert",
    "delete_event": "calendar.events.delete",
    "find_free_time": "calendar.freebusy.query",
    "get_event": "calendar.events.get",
    "list_calendars": "calendar.calendarList.list",
    "list_events": "calendar.events.list",
    "respond_to_event": "calendar.events.patch",
    "update_event": "calendar.events.patch"
}

DISCOVERY_CACHE = None

async def get_discovery_doc() -> dict:
    """Fetch and cache the Google Calendar v3 REST Discovery document."""
    global DISCOVERY_CACHE
    if DISCOVERY_CACHE is not None:
        return DISCOVERY_CACHE
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get("https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest")
        if res.status_code == 200:
            DISCOVERY_CACHE = res.json()
            return DISCOVERY_CACHE
    raise Exception("Failed to fetch Google Calendar Discovery document.")

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

async def discover_calendar_tools(access_token: str) -> list:
    """Query the Google Calendar Discovery API dynamically and construct MCP tool schemas."""
    try:
        doc = await get_discovery_doc()
    except Exception as e:
        print(f"[-] Calendar discovery failed: {e}")
        return []

    tools_list = []
    for mcp_name, method_id in CALENDAR_TOOL_MAPPING.items():
        method_info = find_method_info(doc, method_id)
        if not method_info:
            continue

        # Standard description from Discovery
        description = method_info.get("description", f"Execute Google Calendar {mcp_name} action.")

        properties = {}
        required_params = []

        # Custom schema override for respond_to_event
        if mcp_name == "respond_to_event":
            properties = {
                "calendarId": {
                    "type": "string",
                    "description": "Required. The calendar ID (usually 'primary')."
                },
                "eventId": {
                    "type": "string",
                    "description": "Required. The event ID to respond to."
                },
                "responseStatus": {
                    "type": "string",
                    "description": "Required. The participant's response status.",
                    "enum": ["accepted", "declined", "tentative"]
                },
                "sendUpdates": {
                    "type": "string",
                    "description": "Optional. Guests who should receive notifications about the change.",
                    "enum": ["all", "externalOnly", "none"]
                }
            }
            required_params = ["calendarId", "eventId", "responseStatus"]
        else:
            # Map query and path parameters from Discovery
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

async def execute_google_calendar_tool(tool_name: str, args: dict, access_token: str) -> str:
    """Execute a Google Calendar REST call based on its dynamically-resolved discovery template."""
    action = tool_name.replace("google_calendar__", "").replace("google_calendar.", "")
    method_id = CALENDAR_TOOL_MAPPING.get(action)

    if not method_id:
        return f"Error: Unknown Google Calendar tool '{tool_name}'."

    try:
        doc = await get_discovery_doc()
    except Exception as e:
        return f"Error: Failed to load Google Calendar API discovery document: {e}"

    method_info = find_method_info(doc, method_id)
    if not method_info:
        return f"Error: Unknown Google Calendar method '{method_id}'."

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Custom RSVP responder handler
            if action == "respond_to_event":
                calendar_id = args.get("calendarId")
                event_id = args.get("eventId")
                status = args.get("responseStatus")
                send_updates = args.get("sendUpdates", "all")

                if not calendar_id or not event_id or not status:
                    return "Error: 'calendarId', 'eventId', and 'responseStatus' are required."

                # 1. Fetch current event
                get_res = await client.get(
                    f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events/{event_id}",
                    headers=headers
                )
                if get_res.status_code != 200:
                    return f"Failed to retrieve event: {get_res.text}"

                event_data = get_res.json()
                attendees = event_data.get("attendees", [])

                # Find attendee marked "self"
                self_attendee = None
                for att in attendees:
                    if att.get("self"):
                        self_attendee = att
                        break

                if self_attendee:
                    self_attendee["responseStatus"] = status
                else:
                    # Query user email as fallback
                    primary_res = await client.get(
                        "https://www.googleapis.com/calendar/v3/calendars/primary",
                        headers=headers
                    )
                    if primary_res.status_code == 200:
                        primary_email = primary_res.json().get("id")
                        found = False
                        for att in attendees:
                            if att.get("email") == primary_email:
                                att["responseStatus"] = status
                                found = True
                                break
                        if not found:
                            attendees.append({"email": primary_email, "responseStatus": status})
                    else:
                        return "Failed to identify user's identity for RSVP."

                # 2. Patch back
                patch_res = await client.patch(
                    f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events/{event_id}",
                    headers=headers,
                    params={"sendUpdates": send_updates},
                    json={"attendees": attendees}
                )
                if patch_res.status_code != 200:
                    return f"Failed to update RSVP: {patch_res.text}"
                return "RSVP updated successfully."

            # General REST request handler resolved from Discovery
            http_method = method_info.get("httpMethod", "GET")
            base_path = doc.get("basePath", "/calendar/v3/")
            path_template = method_info.get("flatPath", method_info.get("path", ""))

            # Resolve path parameters
            path_params = re.findall(r"\{([^}]+)\}", path_template)
            resolved_path = path_template
            remaining_args = args.copy()

            for param in path_params:
                if param in remaining_args:
                    val = remaining_args.pop(param)
                    resolved_path = resolved_path.replace(f"{{{param}}}", str(val))
                else:
                    return f"Error: Required path parameter '{param}' was not provided."

            url = "https://www.googleapis.com" + base_path + resolved_path.lstrip("/")

            query_params = {}
            method_params = method_info.get("parameters", {})
            for k, v in remaining_args.items():
                if k in method_params and method_params[k].get("location") == "query":
                    query_params[k] = v

            request_body = remaining_args.get("requestBody")

            json_body = request_body if http_method in ("POST", "PUT", "PATCH") else None
            res = await client.request(
                method=http_method,
                url=url,
                headers=headers,
                params=query_params,
                json=json_body
            )

            if res.status_code not in (200, 201, 204):
                return f"Google Calendar API returned error {res.status_code}: {res.text}"

            if res.status_code == 204:
                return "Action completed successfully (No Content returned)."

            # Custom output formatting for list_events
            if action == "list_events" and res.status_code == 200:
                try:
                    data = res.json()
                    items = data.get("items", [])
                    if not items:
                        return "No upcoming events found in your calendar."

                    lines = ["### Upcoming Calendar Events:\n"]
                    widget_events = []
                    for item in items:
                        summary = item.get("summary", "Untitled Event")
                        start = item.get("start", {})
                        start_time = start.get("dateTime", start.get("date", "Unknown start time"))
                        end = item.get("end", {})
                        end_time = end.get("dateTime", end.get("date", ""))
                        location = item.get("location", "")

                        time_str = start_time
                        if "T" in time_str:
                            time_str = start_time.replace("T", " ").split("+")[0].split("Z")[0][:-3]

                        lines.append(f"- **{summary}** at `{time_str}`" + (f" *(Location: {location})*" if location else ""))

                        # Sanitize pipes for widget parsing
                        clean_summary = summary.replace("|", "/").replace("\n", " ")
                        clean_time = time_str.replace("|", "/")
                        clean_loc = location.replace("|", "/").replace("\n", " ")
                        widget_events.append(f"{clean_summary}|{clean_time}|{clean_loc}")

                    text_response = "\n".join(lines)
                    if widget_events:
                        text_response += f"\n\n<CalendarTimeline events=\"{'||'.join(widget_events)}\" />"
                    return text_response
                except Exception as e:
                    print(f"[-] Failed to format list_events response: {e}")

            try:
                data = res.json()
                return json.dumps(data, indent=2)
            except Exception:
                return res.text

        except Exception as e:
            return f"Error executing Google Calendar REST tool: {str(e)}"
