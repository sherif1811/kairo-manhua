#!/usr/bin/env python3
"""Find manga matching target genres from top manga on MangaTime."""
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

# Collect unique series from multiple broad searches
all_series = {}
searches = ["", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
            "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]

for q in searches:
    try:
        data = call("content.search", {"search": q, "page": 1, "limit": 50})
        for item in data.get("results", []):
            s = item["series"]
            if s["id"] not in all_series:
                all_series[s["id"]] = {
                    "title": s["title"],
                    "slug": s["slug"],
                    "id": s["id"],
                    "type": s.get("type", "manga"),
                    "chapter_count": s.get("chapterCount", 0),
                }
    except:
        pass
    print(f"'{q}': {len(all_series)} فريد", flush=True)

print(f"\nإجمالي: {len(all_series)} مانجا فريدة")

# Get genres for each
matching = []
for i, (sid, sdata) in enumerate(all_series.items()):
    try:
        series = call("content.getSeriesBySlug", {"slug": sdata["slug"]})
        genres_raw = series.get("genres", [])
        genre_names = [g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in genres_raw]
        sdata["genres"] = genre_names
        mc = len(set(genre_names) & TARGET)
        if mc >= 3 and sdata["chapter_count"] > 10:
            matching.append(sdata)
            print(f"  ✓ {sdata['title']} ({sdata['type']}) — {mc}/5 — {', '.join(genre_names)}", flush=True)
    except:
        pass
    if (i + 1) % 20 == 0:
        print(f"  {i+1}/{len(all_series)}", flush=True)

matching.sort(key=lambda x: (-len(set(x.get("genres", [])) & TARGET), -x["chapter_count"]))

with open(os.path.join(os.path.dirname(__file__), "matching_mangas.json"), "w", encoding="utf-8") as f:
    json.dump(matching, f, ensure_ascii=False, indent=2)

print(f"\n✅ {len(matching)} مطابقة")
for i, m in enumerate(matching[:15], 1):
    gs = set(m.get("genres", [])) & TARGET
    print(f"  {i}. {m['title']} ({m['type']}) — {', '.join(gs)} — {m['chapter_count']} فصل")
