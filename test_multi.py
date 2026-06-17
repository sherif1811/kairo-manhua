#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, ".")
from multi_search import search_mangatime, search_madara

r = search_mangatime("Noblesse")
for x in r:
    print(f"MangaTime: {x['title']} — {x['chapters']}ف — {x['avg_pages']}ص/فصل — {x['url']}")

r2 = search_madara("OlympusStaff", "https://olympustaff.com", "Noblesse")
for x in r2:
    print(f"Olympus: {x['title']} — {x['chapters']}ف — {x['url']}")
