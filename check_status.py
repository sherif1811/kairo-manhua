#!/usr/bin/env python3
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("scraped_mangas.json", "r", encoding="utf-8") as f:
    data = json.load(f)
print(f"Total: {len(data)}")
for m in data:
    print(f"  {m['title']} — {len(m.get('chapters',[]))} فصل — URL: {m.get('url','')}")
