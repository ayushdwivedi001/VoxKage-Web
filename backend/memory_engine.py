import os
import json
import re
import uuid
from datetime import datetime
from fastapi import HTTPException
from database import get_db
from sqlite_db import get_sqlite_conn

# --- Track 1: User Soul (Personalization) ---

def remember_user(user_id: str, category: str, key: str, value: str) -> str:
    db = get_db()
    cat = category.lower().strip()
    
    data = {
        "user_id": user_id,
        "category": cat,
        "key": key,
        "value": value,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    res = db.table("user_memories").upsert(
        data, 
        on_conflict="user_id,category,key"
    ).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save user memory.")
    return f"[SOUL] Remembered: {category}.{key} = \"{value}\""

def recall_user(user_id: str, query: str = "") -> str:
    db = get_db()
    
    query_builder = db.table("user_memories").select("*").eq("user_id", user_id)
    res = query_builder.execute()
    memories = res.data or []
    
    if not memories:
        return "[SOUL] No user profile data saved yet."

    filtered = []
    query_words = query.lower().split()
    for m in memories:
        if not query_words:
            filtered.append(m)
            continue
        text = f"{m['category']} {m['key']} {m['value']}".lower()
        if any(word in text for word in query_words):
            filtered.append(m)
            
    if not filtered:
        return f"[SOUL] No user facts found matching '{query}'."

    lines = ["[SOUL] Relevant User Profile Details:"]
    for m in filtered[:12]: # Limit to 12 items for token efficiency
        lines.append(f"  • {m['category']}.{m['key']}: {m['value']}")
        
    return "\n".join(lines)

def get_user_profile(user_id: str) -> str:
    db = get_db()
    res = db.table("user_memories").select("*").eq("user_id", user_id).execute()
    memories = res.data or []
    
    if not memories:
        return "[SOUL] No user profile data saved yet."
        
    categories = {}
    for m in memories:
        cat = m["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(f"{m['key']}: {m['value']}")
        
    lines = ["[SOUL] Complete User Profile:\n"]
    for cat, items in categories.items():
        lines.append(f"=== {cat.capitalize()} ===")
        for item in items:
            lines.append(f"  {item}")
        lines.append("")
        
    return "\n".join(lines)

def forget_user(user_id: str, category: str, key: str) -> str:
    db = get_db()
    res = db.table("user_memories").delete().eq("user_id", user_id).eq("category", category.lower()).eq("key", key).execute()
    if not res.data:
        return f"[SOUL] No entry found for {category}.{key}."
    return f"[SOUL] Removed {category}.{key} from user profile."

def set_trusted_action(user_id: str, action_key: str, trusted: bool, reason: str = "") -> str:
    val = {
        "trusted": trusted,
        "reason": reason or ("user pre-approved" if trusted else "requires verification"),
        "set_at": datetime.utcnow().isoformat()
    }
    return remember_user(user_id, "trusted_actions", action_key, json.dumps(val))

def check_trusted(user_id: str, action_key: str) -> str:
    db = get_db()
    res = db.table("user_memories").select("*").eq("user_id", user_id).eq("category", "trusted_actions").eq("key", action_key).execute()
    if not res.data:
        return f"not_trusted\nAction '{action_key}' requires normal confirmation."
        
    try:
        val = json.loads(res.data[0]["value"])
        if val.get("trusted"):
            return (
                f"trusted\n"
                f"Action '{action_key}' is pre-approved.\n"
                f"Reason: {val.get('reason')}\n"
                f"Proceed without asking for confirmation."
            )
    except:
        pass
    return f"not_trusted\nAction '{action_key}' requires normal confirmation."


# --- Track 2: Problem/Solution Self-Learning ---

def log_problem(user_id: str, problem: str, context: str, attempted: str = "") -> str:
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    problem_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    try:
        cursor.execute("""
            INSERT INTO problem_memories (id, problem, context, attempted, solution, what_worked, prevention, status, user_id, created_at, solved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (problem_id, problem, context, attempted, "", "", "", "unsolved", user_id, created_at, ""))
        conn.commit()
        conn.close()
        return problem_id
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to log problem to SQLite: {str(e)}")

def log_solution(user_id: str, problem_id: str, solution: str, what_worked: str, prevention: str = "") -> str:
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    solved_at = datetime.utcnow().isoformat()
    try:
        cursor.execute("""
            UPDATE problem_memories
            SET solution = ?, what_worked = ?, prevention = ?, status = 'solved', solved_at = ?
            WHERE id = ? AND user_id = ?
        """, (solution, what_worked, prevention, solved_at, problem_id, user_id))
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Problem memory entry not found or user unauthorized.")
        conn.commit()
        conn.close()
        return f"[MEMORY] Solution recorded for '{problem_id}'."
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to record solution in SQLite: {str(e)}")

def search_memory(user_id: str, query: str, top_k: int = 3, threshold: float = 0.45) -> str:
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cleaned_query = ""
        for word in re.findall(r'\w+', query):
            cleaned_query += f" {word}*"
        cleaned_query = cleaned_query.strip()
        
        if not cleaned_query:
            return "[MEMORY] No query provided."
            
        cursor.execute("""
            SELECT id, problem, solution, prevention, status, bm25(problem_memories) as rank
            FROM problem_memories
            WHERE user_id = ? AND problem_memories MATCH ?
            ORDER BY rank ASC
            LIMIT ?
        """, (user_id, cleaned_query, top_k))
        rows = cursor.fetchall()
        memories = [dict(r) for r in rows]
        conn.close()
    except Exception as e:
        try:
            words = [w for w in re.findall(r'\w+', query) if w]
            if not words:
                return "[MEMORY] No query words found."
            
            conditions = []
            params = [user_id]
            for w in words:
                conditions.append("(problem LIKE ? OR context LIKE ? OR solution LIKE ? OR what_worked LIKE ?)")
                params.extend([f"%{w}%", f"%{w}%", f"%{w}%", f"%{w}%"])
                
            sql = f"""
                SELECT id, problem, solution, prevention, status
                FROM problem_memories
                WHERE user_id = ? AND ({" AND ".join(conditions)})
                LIMIT ?
            """
            params.append(top_k)
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            memories = [dict(r) for r in rows]
            conn.close()
        except Exception as ex:
            print(f"⚠️ SQLite Problem Search Error: {ex}")
            if conn:
                conn.close()
            return "[MEMORY] Search query failed."

    if not memories:
        return "[MEMORY] No relevant past learnings found. Proceed normally."
        
    lines = [f"[MEMORY] Found {len(memories)} past experiences/solutions:"]
    for i, m in enumerate(memories, 1):
        lines.append(f"--- Experience #{i} [{m['status'].upper()}] ---")
        problem = m.get("problem", "")
        lines.append(f"Problem: {problem}")
        if m.get("solution"):
            lines.append(f"Solution: {m['solution']}")
        if m.get("prevention"):
            lines.append(f"Prevention: {m['prevention']}")
        lines.append("")
        
    return "\n".join(lines)
