#!/usr/bin/env python3
import sys, os, json, hashlib, time, urllib.request, urllib.parse, ssl
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

target_genres = {"أكشن", "مغامرة", "خيال", "قوى خارقة", "وحوش"}

# Get total count first
data = call("content.search", {"search": "", "page": 1, "limit": 1})
total = data.get("totalCount", 0)
print(f"إجمالي المانجا: {total}")

# Get top 300 most popular series (first 6 pages)
all_series = {}
for page in range(1, 7):
    print(f"\nصفحة {page}...", flush=True)
    try:
        data = call("content.search", {"search": "", "page": page, "limit": 50})
        for item in data.get("results", []):
            s = item["series"]
            all_series[s["id"]] = {
                "title": s["title"],
                "slug": s["slug"],
                "id": s["id"],
                "type": s.get("type", "manga"),
                "chapter_count": s.get("chapterCount", 0),
            }
    except Exception as e:
        print(f"  خطأ: {e}", flush=True)

print(f"\nإجمالي المجموعة: {len(all_series)}")

# Get genres for each
matching = []
for i, (sid, sdata) in enumerate(all_series.items()):
    try:
        series = call("content.getSeriesBySlug", {"slug": sdata["slug"]})
        genres_raw = series.get("genres", [])
        genre_names = [g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in genres_raw]
        sdata["genres"] = genre_names
        match_count = len(set(genre_names) & target_genres)
        if match_count >= 3 and sdata["chapter_count"] > 10:
            matching.append(sdata)
            print(f"  ✓ {sdata['title']} ({sdata['type']}) — {match_count}/5 — {', '.join(genre_names)}", flush=True)
    except Exception as e:
        pass
    if (i + 1) % 25 == 0:
        print(f"  ... {i+1}/{len(all_series)}", flush=True)

matching.sort(key=lambda x: (-len(set(x["genres"]) & target_genres), -x["chapter_count"]))

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "matching_mangas.json")
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(matching, f, ensure_ascii=False, indent=2)

print(f"\n✅ تم العثور على {len(matching)} مانجا مطابقة")
print(f"محفوظ في: matching_mangas.json")
print("\nأفضل 10:")
for i, m in enumerate(matching[:10], 1):
    gs = set(m["genres"]) & target_genres
    print(f"  {i}. {m['title']} ({m['type']}) — {', '.join(gs)} — {m['chapter_count']} فصل")
