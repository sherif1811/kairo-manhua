"""
Migration script to transfer data from SQLite (kairo.db) to PostgreSQL.

Usage:
    python scripts/migrate_to_postgresql.py          # Perform migration
    python scripts/migrate_to_postgresql.py --dry-run # Preview without writing

Environment:
    DATABASE_URL - PostgreSQL connection string (default: postgresql://kairo:kairo_secret@localhost:5432/kairo)
    SQLITE_PATH  - Path to SQLite file (default: kairo.db)
"""

import os
import sys
import sqlite3

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: psycopg2 is not installed. Install it with: pip install psycopg2-binary")
    sys.exit(1)


# ─── Table definitions (PostgreSQL-compatible) ───────────────────
# Each entry: (table_name, create_sql, select_sql_from_sqlite)
# The create SQL uses PostgreSQL types: SERIAL, TEXT, INTEGER, REAL, TIMESTAMP

TABLES = [
    {
        "name": "users",
        "create": """
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                password_hash TEXT,
                role TEXT DEFAULT 'user',
                points INTEGER DEFAULT 20,
                level INTEGER DEFAULT 1,
                username TEXT DEFAULT '',
                provider TEXT DEFAULT 'email'
            )
        """,
        "columns": ["email", "password_hash", "role", "points", "level", "username", "provider"],
    },
    {
        "name": "sessions",
        "create": """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                email TEXT,
                expires_at REAL
            )
        """,
        "columns": ["token", "email", "expires_at"],
    },
    {
        "name": "user_settings",
        "create": """
            CREATE TABLE IF NOT EXISTS user_settings (
                email TEXT PRIMARY KEY,
                settings_json TEXT
            )
        """,
        "columns": ["email", "settings_json"],
    },
    {
        "name": "reading_progress",
        "create": """
            CREATE TABLE IF NOT EXISTS reading_progress (
                email TEXT,
                manga_id TEXT,
                chapter_id TEXT,
                page INTEGER,
                updated_at REAL,
                PRIMARY KEY (email, manga_id)
            )
        """,
        "columns": ["email", "manga_id", "chapter_id", "page", "updated_at"],
    },
    {
        "name": "suggestions",
        "create": """
            CREATE TABLE IF NOT EXISTS suggestions (
                id SERIAL PRIMARY KEY,
                email TEXT,
                type TEXT,
                content TEXT,
                created_at REAL
            )
        """,
        "columns": ["id", "email", "type", "content", "created_at"],
    },
    {
        "name": "manga_reviews",
        "create": """
            CREATE TABLE IF NOT EXISTS manga_reviews (
                id SERIAL PRIMARY KEY,
                manga_id TEXT,
                email TEXT,
                rating INTEGER,
                review_text TEXT,
                created_at REAL,
                UNIQUE(manga_id, email)
            )
        """,
        "columns": ["id", "manga_id", "email", "rating", "review_text", "created_at"],
    },
    {
        "name": "chapter_comments",
        "create": """
            CREATE TABLE IF NOT EXISTS chapter_comments (
                id SERIAL PRIMARY KEY,
                manga_id TEXT,
                chapter_id TEXT,
                email TEXT,
                comment_text TEXT,
                created_at REAL
            )
        """,
        "columns": ["id", "manga_id", "chapter_id", "email", "comment_text", "created_at"],
    },
    {
        "name": "site_stats",
        "create": """
            CREATE TABLE IF NOT EXISTS site_stats (
                key TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0
            )
        """,
        "columns": ["key", "value"],
    },
    {
        "name": "system_settings",
        "create": """
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """,
        "columns": ["key", "value"],
    },
    {
        "name": "password_resets",
        "create": """
            CREATE TABLE IF NOT EXISTS password_resets (
                email TEXT,
                token TEXT PRIMARY KEY,
                expires_at REAL
            )
        """,
        "columns": ["email", "token", "expires_at"],
    },
    {
        "name": "reader_points_log",
        "create": """
            CREATE TABLE IF NOT EXISTS reader_points_log (
                email TEXT,
                manga_id TEXT,
                chapter_id TEXT,
                earned_at REAL,
                PRIMARY KEY (email, manga_id, chapter_id)
            )
        """,
        "columns": ["email", "manga_id", "chapter_id", "earned_at"],
    },
    {
        "name": "bookmarks",
        "create": """
            CREATE TABLE IF NOT EXISTS bookmarks (
                id SERIAL PRIMARY KEY,
                email TEXT,
                manga_id TEXT,
                chapter_id TEXT,
                page INTEGER DEFAULT 1,
                created_at REAL,
                UNIQUE(email, manga_id, chapter_id)
            )
        """,
        "columns": ["id", "email", "manga_id", "chapter_id", "page", "created_at"],
    },
    {
        "name": "history",
        "create": """
            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                email TEXT,
                manga_id TEXT,
                chapter_id TEXT,
                action TEXT,
                created_at REAL
            )
        """,
        "columns": ["id", "email", "manga_id", "chapter_id", "action", "created_at"],
    },
]

# Tables that might not exist in SQLite yet; we create in PG but skip migration
OPTIONAL_TABLES = {
    "manga",
    "chapters",
    "social_accounts",
    "downloads",
    "app_settings",
    "bookmarks",
    "history",
}


def get_sqlite_tables(sqlite_conn):
    """Return a set of table names that exist in the SQLite database."""
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return {row[0] for row in cursor.fetchall()}


def table_exists(pg_conn, table_name):
    """Check if a table exists in PostgreSQL."""
    cursor = pg_conn.cursor()
    cursor.execute(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)",
        (table_name,)
    )
    return cursor.fetchone()[0]


def row_count(pg_conn, table_name):
    """Return the number of rows in a PostgreSQL table."""
    cursor = pg_conn.cursor()
    cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
    return cursor.fetchone()[0]


def get_column_names(sqlite_conn, table_name):
    """Return a list of column names from a SQLite table."""
    cursor = sqlite_conn.cursor()
    cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 0')
    return [desc[0] for desc in cursor.description]


def migrate_table(sqlite_conn, pg_conn, table_def, dry_run=False):
    """
    Migrate a single table from SQLite to PostgreSQL.
    Returns the number of rows migrated.
    """
    table_name = table_def["name"]
    columns = table_def["columns"]

    # Check if the source table exists in SQLite
    sqlite_tables = get_sqlite_tables(sqlite_conn)
    if table_name not in sqlite_tables:
        # If it's in our defined tables, still create the PG table as empty
        if not dry_run:
            with pg_conn.cursor() as cur:
                cur.execute(table_def["create"])
            pg_conn.commit()
        print(f"  [{table_name}] Table does not exist in SQLite, created empty in PostgreSQL")
        return 0

    # Create the table in PostgreSQL (IF NOT EXISTS)
    if not dry_run:
        with pg_conn.cursor() as cur:
            cur.execute(table_def["create"])
        pg_conn.commit()

    # Check if PostgreSQL table already has data
    if not dry_run and table_exists(pg_conn, table_name):
        existing = row_count(pg_conn, table_name)
        if existing > 0:
            print(f"  [{table_name}] Already has {existing} row(s), skipping migration")
            return existing

    # Fetch all rows from SQLite
    sqlite_cols = get_column_names(sqlite_conn, table_name)
    # Only select columns that exist in both source and target
    common_cols = [c for c in columns if c in sqlite_cols]
    if not common_cols:
        print(f"  [{table_name}] No common columns found, skipping")
        return 0

    select_clause = ", ".join(f'"{c}"' for c in common_cols)
    cursor = sqlite_conn.cursor()
    cursor.execute(f'SELECT {select_clause} FROM "{table_name}"')
    rows = cursor.fetchall()

    if not rows:
        print(f"  [{table_name}] No data to migrate")
        return 0

    # Insert into PostgreSQL
    if not dry_run:
        placeholders = ", ".join(["%s"] * len(common_cols))
        columns_str = ", ".join(f'"{c}"' for c in common_cols)
        insert_sql = f'INSERT INTO "{table_name}" ({columns_str}) VALUES ({placeholders})'

        with pg_conn.cursor() as cur:
            for row in rows:
                try:
                    cur.execute(insert_sql, row)
                except Exception as e:
                    # Log duplicate key errors but continue
                    print(f"    Skipping row in {table_name}: {e}")

        pg_conn.commit()

    print(f"  [{table_name}] Migrated {len(rows)} row(s)")
    return len(rows)


def create_optional_tables(pg_conn, dry_run=False):
    """
    Create tables that may not exist in SQLite source but are needed
    for the PostgreSQL schema (manga, chapters, etc.).
    """
    optional_defs = [
        {
            "name": "manga",
            "create": """
                CREATE TABLE IF NOT EXISTS manga (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    alt_title TEXT,
                    author TEXT,
                    artist TEXT,
                    description TEXT,
                    cover_url TEXT,
                    banner_url TEXT,
                    status TEXT,
                    genres TEXT,
                    source TEXT,
                    source_url TEXT,
                    created_at REAL,
                    updated_at REAL
                )
            """,
        },
        {
            "name": "chapters",
            "create": """
                CREATE TABLE IF NOT EXISTS chapters (
                    id TEXT,
                    manga_id TEXT,
                    title TEXT,
                    number REAL,
                    source_url TEXT,
                    pages INTEGER,
                    translated BOOLEAN DEFAULT FALSE,
                    created_at REAL,
                    PRIMARY KEY (id, manga_id)
                )
            """,
        },
        {
            "name": "social_accounts",
            "create": """
                CREATE TABLE IF NOT EXISTS social_accounts (
                    id SERIAL PRIMARY KEY,
                    email TEXT,
                    provider TEXT,
                    provider_id TEXT,
                    access_token TEXT,
                    created_at REAL,
                    UNIQUE(email, provider)
                )
            """,
        },
        {
            "name": "downloads",
            "create": """
                CREATE TABLE IF NOT EXISTS downloads (
                    id SERIAL PRIMARY KEY,
                    email TEXT,
                    manga_id TEXT,
                    chapter_id TEXT,
                    status TEXT DEFAULT 'pending',
                    file_path TEXT,
                    created_at REAL,
                    completed_at REAL
                )
            """,
        },
        {
            "name": "app_settings",
            "create": """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at REAL
                )
            """,
        },
    ]

    for tdef in optional_defs:
        name = tdef["name"]
        if not dry_run:
            with pg_conn.cursor() as cur:
                cur.execute(tdef["create"])
            pg_conn.commit()
        print(f"  [{name}] Created empty table in PostgreSQL")


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN MODE: No changes will be written ===\n")

    # Connection strings
    pg_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://kairo:kairo_secret@localhost:5432/kairo"
    )
    sqlite_path = os.environ.get("SQLITE_PATH", "kairo.db")

    # Connect to SQLite
    if not os.path.exists(sqlite_path):
        print(f"WARNING: SQLite database not found at: {sqlite_path} — skipping migration (fresh deployment)")
        return

    print(f"Connecting to SQLite: {sqlite_path}")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.text_factory = str

    # Connect to PostgreSQL
    print(f"Connecting to PostgreSQL: {pg_url}")
    try:
        pg_conn = psycopg2.connect(pg_url)
        pg_conn.autocommit = False
    except psycopg2.OperationalError as e:
        print(f"ERROR: Could not connect to PostgreSQL: {e}")
        print("Make sure PostgreSQL is running and accessible.")
        sqlite_conn.close()
        sys.exit(1)

    total_migrated = 0

    try:
        # Migrate all defined tables
        print("\n--- Migrating known tables ---")
        for table_def in TABLES:
            try:
                count = migrate_table(sqlite_conn, pg_conn, table_def, dry_run=dry_run)
                total_migrated += count
            except Exception as e:
                print(f"  ERROR migrating {table_def['name']}: {e}")

        # Create optional tables that might not have SQLite sources
        print("\n--- Creating optional / new tables ---")
        create_optional_tables(pg_conn, dry_run=dry_run)

        print(f"\n=== Migration complete: {total_migrated} total rows processed ===")
        if dry_run:
            print("=== DRY RUN: No data was written ===")

    except Exception as e:
        print(f"FATAL ERROR: {e}")
        pg_conn.rollback()
        sys.exit(1)
    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
