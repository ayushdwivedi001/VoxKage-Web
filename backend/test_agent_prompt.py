"""
Test Prompt: Simulates run_agentic_loop and prints system prompt and tool definitions.
"""
import sys
import os
import json
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

async def test_prompt():
    from database import get_db
    db = get_db()
    res = db.table("user_settings").select("user_id").execute()
    users = [r['user_id'] for r in res.data or []]
    
    if not users:
        print("No users found in user_settings.")
        return
        
    target_user = "ayushdwivedi001@gmail.com" if "ayushdwivedi001@gmail.com" in users else users[0]
    print(f"Simulating prompt generation for user: {target_user}")
    
    from opencode_client import get_system_prompt
    from memory_engine import recall_user
    from datetime import datetime
    
    soul_context = recall_user(target_user, "")
    current_time_str = datetime.now().strftime("%A, %B %d, %Y, %I:%M:%S %p")
    
    # Replicate agent_loop system prompt construction
    system_prompt = get_system_prompt()
    mcp_info = ""
    try:
        from database import get_user_settings_profile
        profile = get_user_settings_profile(target_user)
        connections = profile.get("mcp_connections") or {}
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
        print(f"Failed to get connections: {e}")
        
    system_prompt += (
        f"\n\n--- DYNAMIC SESSION CONTEXT ---\n"
        f"The current local date and time is {current_time_str}. Use this exact timestamp when answering any queries. Never guess the time.\n"
        f"{mcp_info}"
        f"--- USER SOUL PROFILE MEMORIES ---\n{soul_context}\n\n"
    )
    
    print("\n" + "="*80)
    print("CONSTRUCTED SYSTEM PROMPT:")
    print("="*80)
    print(system_prompt)
    print("="*80)
    
    # Replicate tools collection
    from tool_schemas import TOOLS_SCHEMA
    from google_tools import GMAIL_TOOLS
    
    mcp_tools = []
    connections = profile.get("mcp_connections") or {}
    for provider, conn in connections.items():
        if provider == "gmail":
            tools_list = GMAIL_TOOLS
        else:
            tools_list = conn.get("tools") or []
        for t in tools_list:
            mcp_tools.append({
                "type": "function",
                "function": {
                    "name": f"{provider}__{t['name']}",
                    "description": f"[{provider.upper()} MCP] {t['description']}",
                    "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}
                }
            })
            
    all_tools = TOOLS_SCHEMA + mcp_tools
    print(f"\nTotal tools sent to LLM: {len(all_tools)}")
    gmail_tools_sent = [t['function']['name'] for t in all_tools if t['function']['name'].startswith("gmail__")]
    print(f"Gmail tools sent: {gmail_tools_sent}")

if __name__ == "__main__":
    asyncio.run(test_prompt())
