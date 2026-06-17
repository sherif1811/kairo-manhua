#!/usr/bin/env python3
"""
استخدام: python search_scrape.py <اسم المانجا>

يبحث في MangaTime.org عن المانجا، يختار منها، ويسحبها كلها
"""
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

# 1. Search
query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else input("اسم المانجا: ").strip()
if not query:
    print("ما كتبتش اسم!")
    sys.exit(1)

print(f"\nجاري البحث عن \"{query}\"...")
results = api_call("content.search", {"search": query, "limit": 20})
items = results.get("results", [])

if not items:
    print("مفيش نتايج. جرب اسم تاني.")
    sys.exit(1)

print(f"\nلقيت {len(items)} نتيجة:\n")
for i, item in enumerate(items, 1):
    s = item["series"]
    print(f"  {i}. {s['title']} — {s.get('chapterCount', 0)} فصل ({s.get('type', '?')})")

choice = input(f"\nاختار رقم (1-{len(items)}) أو Enter للـ 1: ").strip()
if not choice and len(sys.argv) > 2:
    choice = sys.argv[2]
idx = int(choice) - 1 if choice.isdigit() and 1 <= int(choice) <= len(items) else 0
selected = items[idx]["series"]

title = selected["title"]
slug = selected["slug"]
series_type = selected.get("type", "manga")
series_id = selected["id"]
print(f"\n→ {title} (/{series_type}/{slug}) — جاري سحب الفصول...")

# 2. Get all chapters with pagination
all_chapters = []
cursor = None
while True:
    params = {"seriesId": series_id, "limit": 500}
    if cursor:
        params["cursor"] = cursor
    data = api_call("content.getChapters", params)
    chapters = data.get("chapters", [])
    for c in chapters:
        ch_url = f"https://mangatime.org/{series_type}/{slug}/chapter/{c['number']}"
        all_chapters.append({
            "url": ch_url,
            "title": c.get("title") or f"الفصل {c['number']}",
            "id": c["id"],
            "number": c["number"],
        })
    if not data.get("hasMore"):
        break
    cursor = data.get("nextCursor")
    if not cursor:
        break

print(f"إجمالي الفصول: {len(all_chapters)}")
if not all_chapters:
    print("مفيش فصول متاحة!")
    sys.exit(1)

# 3. Get series metadata (cover, etc.)
try:
    series_data = api_call("content.getSeriesBySlug", {"slug": slug})
except Exception:
    series_data = selected

cover_url = series_data.get("coverUrl", selected.get("coverUrl", ""))
if cover_url and not cover_url.startswith("http"):
    cover_url = f"https://mangatime.org{cover_url}"
description = series_data.get("description", "")
genres_raw = series_data.get("genres", [])
genre_names = [g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in genres_raw]

# 4. Scrape chapter pages
from scrapers.mangatime_scraper import MangatimeScraper
scraper = MangatimeScraper()

chapters_out = []
for idx, ch in enumerate(all_chapters):
    ch_id = f"ch_{ch['number']}_{idx}"
    print(f"  {idx+1}/{len(all_chapters)} — {ch['title']}...", end=" ", flush=True)
    try:
        pages = scraper.scrape_chapter_pages(ch["url"])
        if not pages:
            print("⚠ مفيش صور")
            continue
    except Exception as e:
        print(f"❌ {e}")
        continue
    chapters_out.append({
        "id": ch_id,
        "title": ch["title"],
        "number": ch["number"],
        "url": ch["url"],
        "date": "",
        "images": pages
    })
    print(f"✓ {len(pages)}")

if not chapters_out:
    print("\n❌ فشل سحب أي فصل")
    sys.exit(1)

# 5. Save to scraped_mangas.json
manga_id = hashlib.md5((slug + title + str(time.time())).encode()).hexdigest()[:10]
entry = {
    "id": manga_id,
    "title": title,
    "alternative": "",
    "author": series_data.get("author", ""),
    "artist": series_data.get("artist", ""),
    "status": "مستمرة",
    "cover": cover_url,
    "synopsis": description,
    "genres": genre_names,
    "url": f"https://mangatime.org/{series_type}/{slug}",
    "chapters": chapters_out
}

output_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraped_mangas.json")
existing = []
if os.path.exists(output_file):
    with open(output_file, "r", encoding="utf-8") as f:
        try:
            existing = json.load(f)
        except json.JSONDecodeError:
            existing = []

existing = [m for m in existing if m.get("url") != entry["url"]]
existing.append(entry)
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(existing, f, ensure_ascii=False, indent=2)

print(f"\n✅ تمت إضافة \"{title}\" بنجاح!")
print(f"   {len(chapters_out)} فصل")
print(f"   المحفوظ في: scraped_mangas.json")
