#!/usr/bin/env python3
import sys, os, json, hashlib, time, urllib.request, urllib.parse, ssl
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

API = "https://mangatime.org/api/trpc"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

def api_call(procedure, params):
    payload = {"0": {"json": params}}
    encoded = urllib.parse.quote(json.dumps(payload))
    url = f"{API}/{procedure}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

target_genres = {"أكشن", "مغامرة", "خيال", "قوى خارقة", "وحوش"}

# Search all pages to find matching series
matching = []
for page in range(1, 50):
    print(f"جاري تصفح الصفحة {page}...", end=" ", flush=True)
    try:
        data = api_call("content.browse", {"page": page, "limit": 50, "sort": "POPULARITY"})
        results = data.get("results", [])
        if not results:
            print("خلاص")
            break
    except Exception as e:
        print(f"خطأ: {e}")
        break
    
    for item in results:
        s = item.get("series", item)
        title = s.get("title", "")
        slug = s.get("slug", "")
        sid = s.get("id", "")
        series_genres = s.get("genres", [])
        genre_names = {g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in series_genres}
        
        match_count = len(genre_names & target_genres)
        if match_count >= 3:
            matching.append({
                "title": title,
                "slug": slug,
                "id": sid,
                "genres": list(genre_names),
                "match_count": match_count,
                "type": s.get("type", "manga"),
                "chapter_count": s.get("chapterCount", 0)
            })
    
    print(f"{len(results)} نتيجة, {len(matching)} متطابقة")
    if len(matching) >= 30:
        break

# Sort by match count descending, then chapter count descending
matching.sort(key=lambda x: (-x["match_count"], -x["chapter_count"]))

print(f"\n\nأفضل المطابقات ({len(matching)}):")
for i, m in enumerate(matching[:20], 1):
    print(f"  {i}. {m['title']} — {m['match_count']}/5 تصنيف — {m['chapter_count']} فصل — {', '.join(m['genres'])}")

# Save for later scraping
output = os.path.join(os.path.dirname(os.path.abspath(__file__)), "matching_mangas.json")
with open(output, "w", encoding="utf-8") as f:
    json.dump(matching, f, ensure_ascii=False, indent=2)
print(f"\nمحفوظ في: matching_mangas.json")
