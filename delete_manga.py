import sqlite3
import os

db_path = 'kairo.db'
if not os.path.exists(db_path):
    print("No DB found")
    exit(0)

conn = sqlite3.connect(db_path)
c = conn.cursor()
try:
    c.execute("DELETE FROM chapters WHERE manga_id IN (SELECT id FROM manga WHERE title LIKE '%suspicion%')")
    c.execute("DELETE FROM manga WHERE title LIKE '%suspicion%'")
    conn.commit()
    print("Deleted successfully")
except Exception as e:
    print("Error:", e)
finally:
    conn.close()
