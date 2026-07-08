import os
import re
import uuid
from fastapi import HTTPException
from sqlite_db import get_sqlite_conn
from rag_parser import chunk_text, extract_text_async

async def index_file_in_rag(file_path: str, filename: str, user_id: str, document_id: str = None, model: str = None) -> dict:
    """
    Extracts text, chunks it, and saves it into the local SQLite database.
    This replaces pgvector and does not load any embedding model.
    """
    text = await extract_text_async(file_path, model=model)
    chunks = chunk_text(text)
    
    if not chunks:
        return {"status": "ignored", "reason": "No text content found in file."}
        
    doc_id = document_id or str(uuid.uuid4())
    
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        for chunk in chunks:
            cursor.execute("""
                INSERT INTO rag_documents (filename, content, user_id, document_id)
                VALUES (?, ?, ?, ?)
            """, (filename, chunk, user_id, doc_id))
        conn.commit()
        conn.close()
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to save document chunks into SQLite: {str(e)}")
        
    return {
        "status": "success",
        "chunks_indexed": len(chunks),
        "filename": filename,
        "document_id": doc_id
    }

def query_rag_vector(query: str, user_id: str, top_k: int = 3, threshold: float = 0.20) -> list:
    """
    Queries local SQLite database using FTS5 MATCH, falling back to LIKE if FTS5 is not available.
    Keeps the function signature identical to query_rag_vector for backward compatibility.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        # Build tokenized query for FTS5 (e.g. "search term" -> "search* term*")
        cleaned_query = ""
        for word in re.findall(r'\w+', query):
            cleaned_query += f" {word}*"
        cleaned_query = cleaned_query.strip()
        
        if not cleaned_query:
            return []
            
        cursor.execute("""
            SELECT filename, content, user_id, document_id, bm25(rag_documents) as rank
            FROM rag_documents
            WHERE user_id = ? AND rag_documents MATCH ?
            ORDER BY rank ASC
            LIMIT ?
        """, (user_id, cleaned_query, top_k))
        rows = cursor.fetchall()
        results = []
        for r in rows:
            results.append({
                "filename": r["filename"],
                "content": r["content"],
                "user_id": r["user_id"],
                "document_id": r["document_id"]
            })
        conn.close()
        return results
    except Exception as e:
        # Fallback to standard LIKE queries
        try:
            words = [w for w in re.findall(r'\w+', query) if w]
            if not words:
                return []
            
            conditions = []
            params = [user_id]
            for w in words:
                conditions.append("(content LIKE ? OR filename LIKE ?)")
                params.extend([f"%{w}%", f"%{w}%"])
                
            sql = f"""
                SELECT filename, content, user_id, document_id
                FROM rag_documents
                WHERE user_id = ? AND ({" AND ".join(conditions)})
                LIMIT ?
            """
            params.append(top_k)
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            results = []
            for r in rows:
                results.append({
                    "filename": r["filename"],
                    "content": r["content"],
                    "user_id": r["user_id"],
                    "document_id": r["document_id"]
                })
            conn.close()
            return results
        except Exception as ex:
            print(f"⚠️ SQLite RAG Query Error: {ex}")
            if conn:
                conn.close()
            return []

def query_scoped_rag_vector(query: str, user_id: str, document_id: str, top_k: int = 5, threshold: float = 0.10) -> list:
    """
    Queries local SQLite database filtered by document_id using FTS5 MATCH, falling back to LIKE.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cleaned_query = ""
        for word in re.findall(r'\w+', query):
            cleaned_query += f" {word}*"
        cleaned_query = cleaned_query.strip()
        
        if not cleaned_query:
            return []
            
        cursor.execute("""
            SELECT filename, content, user_id, document_id, bm25(rag_documents) as rank
            FROM rag_documents
            WHERE user_id = ? AND document_id = ? AND rag_documents MATCH ?
            ORDER BY rank ASC
            LIMIT ?
        """, (user_id, document_id, cleaned_query, top_k))
        rows = cursor.fetchall()
        results = []
        for r in rows:
            results.append({
                "filename": r["filename"],
                "content": r["content"],
                "user_id": r["user_id"],
                "document_id": r["document_id"]
            })
        conn.close()
        return results
    except Exception as e:
        try:
            words = [w for w in re.findall(r'\w+', query) if w]
            if not words:
                return []
            
            conditions = []
            params = [user_id, document_id]
            for w in words:
                conditions.append("(content LIKE ? OR filename LIKE ?)")
                params.extend([f"%{w}%", f"%{w}%"])
                
            sql = f"""
                SELECT filename, content, user_id, document_id
                FROM rag_documents
                WHERE user_id = ? AND document_id = ? AND ({" AND ".join(conditions)})
                LIMIT ?
            """
            params.append(top_k)
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            results = []
            for r in rows:
                results.append({
                    "filename": r["filename"],
                    "content": r["content"],
                    "user_id": r["user_id"],
                    "document_id": r["document_id"]
                })
            conn.close()
            return results
        except Exception as ex:
            print(f"⚠️ SQLite Scoped RAG Query Error: {ex}")
            if conn:
                conn.close()
            return []

def list_rag_documents(user_id: str) -> list:
    """
    Returns list of distinct indexed files and chunk counts from SQLite.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT filename, document_id, COUNT(*) as count 
            FROM rag_documents 
            WHERE user_id = ? 
            GROUP BY filename, document_id
        """, (user_id,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "document_id": r["document_id"],
                "filename": r["filename"],
                "chunks_indexed": r["count"]
            })
        conn.close()
        return result
    except Exception as e:
        print(f"⚠️ Error listing RAG documents: {e}")
        if conn:
            conn.close()
        return []

def delete_rag_document(user_id: str, document_id: str | None = None, filename: str | None = None) -> dict:
    """
    Deletes indexed chunks from SQLite by document_id or filename.
    """
    if not document_id and not filename:
        return {"status": "error", "message": "Either document_id or filename must be provided."}
        
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    try:
        if document_id and filename:
            cursor.execute("DELETE FROM rag_documents WHERE user_id = ? AND document_id = ? AND filename = ?", (user_id, document_id, filename))
        elif document_id:
            cursor.execute("DELETE FROM rag_documents WHERE user_id = ? AND document_id = ?", (user_id, document_id))
        else:
            cursor.execute("DELETE FROM rag_documents WHERE user_id = ? AND filename = ?", (user_id, filename))
            
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()
        return {
            "status": "success",
            "message": "Successfully deleted RAG document chunks from SQLite.",
            "chunks_removed": deleted_count,
            "document_id": document_id,
            "filename": filename
        }
    except Exception as e:
        print(f"⚠️ Error deleting RAG document from SQLite: {e}")
        if conn:
            conn.close()
        return {"status": "error", "message": f"Failed to delete document chunks: {str(e)}"}
