import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voxkage_memory.db")

def get_sqlite_conn():
    """
    Creates and returns a connection to the local SQLite database.
    Enables Row factory for dictionary-like access to columns.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    """
    Initializes database tables for RAG documents and problem memory.
    Proactively checks for FTS5 full-text search availability and sets up
    high-performance search tables, falling back to standard SQL tables if unavailable.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()
    
    # Verify FTS5 availability
    use_fts = True
    try:
        cursor.execute("CREATE VIRTUAL TABLE IF NOT EXISTS test_fts USING fts5(content);")
        cursor.execute("DROP TABLE test_fts;")
    except sqlite3.OperationalError:
        use_fts = False
        print("⚠️ SQLite FTS5 not available in this environment. Falling back to standard SQL indexing.")
        
    if use_fts:
        # Create FTS5 virtual tables
        cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS rag_documents USING fts5(
            filename,
            content,
            user_id,
            document_id
        );
        """)
        
        cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS problem_memories USING fts5(
            id,
            problem,
            context,
            attempted,
            solution,
            what_worked,
            prevention,
            status,
            user_id,
            created_at,
            solved_at
        );
        """)
        print("[+] SQLite initialized using FTS5 virtual tables.")
    else:
        # Create standard relational tables
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS rag_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            content TEXT,
            user_id TEXT,
            document_id TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rag_user ON rag_documents(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rag_doc ON rag_documents(document_id);")
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS problem_memories (
            id TEXT PRIMARY KEY,
            problem TEXT,
            context TEXT,
            attempted TEXT,
            solution TEXT,
            what_worked TEXT,
            prevention TEXT,
            status TEXT,
            user_id TEXT,
            created_at TEXT,
            solved_at TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prob_user ON problem_memories(user_id);")
        print("[+] SQLite initialized using standard SQL tables and indexes.")
        
    conn.commit()
    conn.close()

# Run database setup on module import
try:
    init_sqlite_db()
except Exception as e:
    print(f"[-] SQLite Database Initialization failed: {e}")
