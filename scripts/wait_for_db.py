"""
Utility script to wait for PostgreSQL to be ready.

Usage:
    python scripts/wait_for_db.py

Exits with code 0 when connected, 1 after timeout.
"""

import os
import sys
import time

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 is not installed. Install it with: pip install psycopg2-binary")
    sys.exit(1)


def main():
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://kairo:kairo_secret@localhost:5432/kairo"
    )

    max_retries = 30
    retry_delay = 2

    print(f"Waiting for PostgreSQL at {database_url} ...")

    for attempt in range(1, max_retries + 1):
        try:
            conn = psycopg2.connect(database_url)
            conn.close()
            print("PostgreSQL is ready!")
            sys.exit(0)
        except psycopg2.OperationalError as e:
            print(f"  Attempt {attempt}/{max_retries} - not ready yet: {e}")
            time.sleep(retry_delay)

    print(f"ERROR: PostgreSQL did not become ready after {max_retries} attempts.")
    sys.exit(1)


if __name__ == "__main__":
    main()
