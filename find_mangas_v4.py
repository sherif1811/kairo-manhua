#!/usr/bin/env python3
import sys, os, json, urllib.request, urllib.parse, ssl
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

def call(proc, params):
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

TARGET = {"أكشن", "مغامرة", "خيال", "قوى خارقة", "وحوش"}
BASE = os.path.dirname(os.path.abspath(__file__))

# Collect series from multiple search terms (genre names in Arabic/English)
all_series = {}
search_terms = ["", "أكشن", "مغامرة", "خيال", "قوى", "وحوش", "action", "adventure", "fantasy", "ac", "ma", "kh", "wo"]
for q in search_terms:
    try:
        data = call("content.search", {"search": q, "page": 1, "limit": 50})
        for item in data.get("results", []):
            s = item["series"]
            if s["id"] not in all_series and s.get("chapterCount", 0) > 10:
                all_series[s["id"]] = {
                    "title": s["title"],
                    "slug": s["slug"],
                    "id": s["id"],
                    "type": s.get("type", "manga"),
                    "chapter_count": s["chapterCount"],
                }
        print(f"'{q}': {len(data.get('results', []))} نتائج — {len(all_series)} فريد", flush=True)
    except Exception as e:
        print(f"'{q}': {e}", flush=True)

print(f"\nإجمالي: {len(all_series)} مانجا")

# Get genres
matching = []
for sid, sdata in all_series.items():
    try:
        series = call("content.getSeriesBySlug", {"slug": sdata["slug"]})
        genre_names = [g["name"] for g in series.get("genres", []) if isinstance(g, dict) and "name" in g]
        sdata["genres"] = genre_names
        mc = len(set(genre_names) & TARGET)
        if mc >= 2 and sdata["chapter_count"] > 15:
            sdata["match_count"] = mc
            matching.append(sdata)
    except:
        pass

matching.sort(key=lambda x: (-x["match_count"], -x["chapter_count"]))

print(f"\nنتائج مطابقة ({len(matching)}):")
for i, m in enumerate(matching[:15], 1):
    gs = set(m.get("genres", [])) & TARGET
    print(f"  {i}. {m['title']} ({m['type']}) {m['chapter_count']}ف — {', '.join(gs)} — {', '.join(m.get('genres', []))}")

with open(os.path.join(BASE, "matching_mangas.json"), "w", encoding="utf-8") as f:
    json.dump(matching, f, ensure_ascii=False, indent=2)
print(f"\nمحفوظ في matching_mangas.json")
