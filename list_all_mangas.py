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

# Get all series
data = call("content.search", {"search": "", "page": 1, "limit": 50})

all_series = []
for item in data.get("results", []):
    s = item["series"]
    all_series.append({
        "title": s["title"],
        "slug": s["slug"],
        "id": s["id"],
        "type": s.get("type", "manga"),
        "chapter_count": s.get("chapterCount", 0),
    })

print(f"إجمالي: {len(all_series)} مانجا\n")

# Get genres for each
for i, sdata in enumerate(all_series, 1):
    try:
        series = call("content.getSeriesBySlug", {"slug": sdata["slug"]})
        genre_names = [g["name"] for g in series.get("genres", []) if isinstance(g, dict) and "name" in g]
        sdata["genres"] = genre_names
        mc = len(set(genre_names) & TARGET)
        tag = "✓" if mc >= 2 else " "
        print(f"{tag} {i:2d}. {sdata['title'][:30]:30s} ({sdata['type']:8s}) {sdata['chapter_count']:4d}ف — {', '.join(genre_names[:8])}", flush=True)
    except Exception as e:
        print(f"  XX. {sdata['title']} — خطأ: {e}", flush=True)

with open(os.path.join(BASE, "all_mangas_genres.json"), "w", encoding="utf-8") as f:
    json.dump(all_series, f, ensure_ascii=False, indent=2)
print(f"\nمحفوظ في all_mangas_genres.json")
