#!/usr/bin/env python3
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")
with open("all_mangas_genres.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("جميع المانها (manhwa):\n")
for d in data:
    if d.get("type") == "manhwa" and d.get("chapter_count", 0) > 10:
        gs = d.get("genres", [])
        print(f"{d['slug']:45s} {d['title'][:35]:35s} {d['chapter_count']:4d}ف  {', '.join(gs[:5])}")
