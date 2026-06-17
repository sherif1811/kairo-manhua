#!/usr/bin/env python3
import json, sys
sys.stdout.reconfigure(encoding="utf-8")

with open("scraped_mangas.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Remove duplicates by URL
seen = {}
for m in data:
    url = m.get("url", "")
    if url not in seen:
        seen[url] = m
    # Keep the one with more chapters if duplicate
    elif len(m.get("chapters", [])) > len(seen[url].get("chapters", [])):
        seen[url] = m

cleaned = list(seen.values())
print(f"قبل: {len(data)}, بعد: {len(cleaned)}")

with open("scraped_mangas.json", "w", encoding="utf-8") as f:
    json.dump(cleaned, f, ensure_ascii=False, indent=2)
print("تم تنظيف الملف!")
