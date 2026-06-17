#!/usr/bin/env python3
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

with open("scraped_mangas.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"إجمالي في scraped_mangas.json: {len(data)}")
for m in data:
    url = m.get("url", "")
    ch_count = len(m.get("chapters", []))
    print(f"  {m['title']} — {ch_count} فصل — {url}")
