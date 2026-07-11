"""
Diagnostic: Gmail MCP Connection Checker
Run from the backend/ directory: python test_gmail_mcp.py
Checks every link in the chain that agent_loop.py uses at chat time.
"""

import sys
import os
import json
import asyncio

# ── ensure backend/ is on the path ───────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

DIVIDER = "─" * 60

def ok(msg):  print(f"  ✅ {msg}")
def fail(msg): print(f"  ❌ {msg}")
def info(msg): print(f"  ℹ  {msg}")

# ─────────────────────────────────────────────────────────────────────────────
# 1. GMAIL_TOOLS schema
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 1: GMAIL_TOOLS schema (google_tools.py)")
print(DIVIDER)
try:
    from google_tools import GMAIL_TOOLS, execute_gmail_tool
    ok(f"GMAIL_TOOLS imported — {len(GMAIL_TOOLS)} tools")
    for t in GMAIL_TOOLS:
        info(f"  tool: {t['name']!r}  desc: {t['description'][:60]}")
except Exception as e:
    fail(f"Import error: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 2. Supabase connection
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 2: Supabase connection (database.py)")
print(DIVIDER)
try:
    from database import get_db, get_user_settings_profile
    db = get_db()
    ok("Supabase client created successfully")
except Exception as e:
    fail(f"Cannot connect to Supabase: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 3. Find a user with Gmail connected
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 3: Scanning user_settings for Gmail connection")
print(DIVIDER)
try:
    res = db.table("user_settings").select("user_id, settings_profile").execute()
    rows = res.data or []
    info(f"Total user_settings rows: {len(rows)}")

    gmail_users = []
    for row in rows:
        uid = row.get("user_id")
        profile = row.get("settings_profile") or {}
        mcp = profile.get("mcp_connections") or {}
        if "gmail" in mcp:
            gmail_users.append((uid, mcp["gmail"]))

    if not gmail_users:
        fail("No user has Gmail connected in Supabase yet.")
        fail("The user must complete the OAuth flow in the UI first.")
        print("\n  How to connect:")
        print("  1. Go to VoxKage Web → click the connect (+) button")
        print("  2. Click Gmail card → click Connect")
        print("  3. Sign in with Google OAuth")
        print("  4. Re-run this script after connecting")
        sys.exit(0)

    ok(f"Found {len(gmail_users)} user(s) with Gmail connected")
    for uid, conn in gmail_users:
        info(f"  user_id: {uid}")
        info(f"  connected_at: {conn.get('connected_at')}")
        info(f"  expires_at: {conn.get('expires_at')}")
        stored_tools = conn.get("tools") or []
        info(f"  stored tools in DB: {[t.get('name') for t in stored_tools]}")

except Exception as e:
    fail(f"Error scanning user_settings: {e}")
    sys.exit(1)

# Use first gmail user for further checks
user_id, gmail_conn = gmail_users[0]

# ─────────────────────────────────────────────────────────────────────────────
# 4. Token decryption
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print(f"STEP 4: Token decryption for user {user_id}")
print(DIVIDER)
try:
    from crypto import decrypt_token
    enc_access  = gmail_conn.get("access_token", "")
    enc_refresh = gmail_conn.get("refresh_token", "")

    if not enc_access:
        fail("No encrypted access_token stored in the connection.")
    else:
        access_token = decrypt_token(enc_access)
        ok(f"access_token decrypted — length {len(access_token)} chars")
        info(f"  preview: {access_token[:12]}...{access_token[-6:]}")

    if not enc_refresh:
        info("No refresh_token stored (will break on token expiry)")
    else:
        refresh_token = decrypt_token(enc_refresh)
        ok(f"refresh_token decrypted — length {len(refresh_token)} chars")

except Exception as e:
    fail(f"Token decryption failed: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 5. Live token validation (get_valid_token)
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 5: get_valid_token (refresh if needed)")
print(DIVIDER)

async def check_valid_token():
    try:
        from mcp_client import get_valid_token
        token = await get_valid_token(user_id, "gmail", gmail_conn)
        ok(f"get_valid_token returned a token — length {len(token)}")
        return token
    except Exception as e:
        fail(f"get_valid_token error: {e}")
        return None

live_token = asyncio.run(check_valid_token())

# ─────────────────────────────────────────────────────────────────────────────
# 6. Live Gmail API call: list_labels
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 6: Live Gmail API call — list_labels")
print(DIVIDER)

async def test_list_labels(token):
    if not token:
        fail("Skipped — no valid token")
        return
    try:
        result = await execute_gmail_tool("list_labels", {}, token)
        if result.startswith("Failed") or result.startswith("Error"):
            fail(f"API call failed: {result[:200]}")
        else:
            ok("list_labels succeeded!")
            lines = result.splitlines()
            for line in lines[:8]:
                info(f"  {line}")
            if len(lines) > 8:
                info(f"  ... ({len(lines) - 8} more lines)")
    except Exception as e:
        fail(f"execute_gmail_tool threw: {e}")

asyncio.run(test_list_labels(live_token))

# ─────────────────────────────────────────────────────────────────────────────
# 7. Simulate agent_loop tool injection (exactly as the LLM sees it)
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 7: Simulating agent_loop tool injection")
print(DIVIDER)
try:
    profile = get_user_settings_profile(user_id)
    connections = profile.get("mcp_connections") or {}
    mcp_tools = []
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

    if not mcp_tools:
        fail("No MCP tools injected — agent_loop would tell LLM it has no Gmail tools!")
        fail("This is why VoxKage says it cannot access Gmail.")
    else:
        ok(f"{len(mcp_tools)} tool(s) would be injected into the LLM payload:")
        for t in mcp_tools:
            info(f"  function name: {t['function']['name']!r}")
            info(f"  description:   {t['function']['description'][:70]}")

except Exception as e:
    fail(f"Simulation error: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# 8. System prompt Gmail awareness check
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{DIVIDER}")
print("STEP 8: System prompt — does it mention Gmail capabilities?")
print(DIVIDER)
try:
    from agent_loop import build_system_prompt
    prompt = build_system_prompt(user_id=user_id, client_time=None, has_gmail=len(mcp_tools) > 0)
    if "gmail" in prompt.lower():
        ok("System prompt mentions Gmail ✓")
    else:
        info("System prompt does NOT explicitly mention Gmail (tool schemas handle this)")
except Exception as e:
    info(f"build_system_prompt not importable or has different signature: {e}")

print(f"\n{DIVIDER}")
print("DIAGNOSTIC COMPLETE")
print(DIVIDER)
