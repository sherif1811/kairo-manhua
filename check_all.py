#!/usr/bin/env python3
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("scraped_mangas.json", "r", encoding="utf-8") as f:
    data = json.load(f)
for m in data:
    print(f"Title: {m['title']}")
    print(f"  URL: {m.get('url','')}")
    print(f"  Cover: {m.get('cover','')[:80]}")
    print(f"  Chapters: {len(m.get('chapters',[]))}")
    print()
