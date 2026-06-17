#!/usr/bin/env python3
"""
Batch scrape multiple manga from MangaTime by slug.
Optimized: gets all chapter IDs first, then calls getChapterPages directly.
"""
import sys, os, json, hashlib, time, urllib.request, urllib.parse, ssl

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
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

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE, "scraped_mangas.json")

SLUGS = [
    ("noblesse", "Noblesse"),
    ("swordmaster-s-youngest-son", "Swordmaster's Youngest Son"),
    ("solo-leveling-ragnarok", "Solo Leveling Ragnarok"),
    ("genius-of-the-unique-lineage", "Genius of the Unique Lineage"),
    ("apocalyptic-super-farm", "Apocalyptic super farm"),
    ("star-embracing-swordmaster", "Star-Embracing Swordmaster"),
    ("magic-academy-s-genius-blinker", "Magic Academy's Genius Blinker"),
    ("swordsman-of-sichuan-tang-family", "Swordsman of Sichuan Tang Family"),
]

def scrape_one(slug, expected_title):
    print(f"\n{'='*60}")
    print(f"→ {expected_title} (/{slug})")
    print(f"{'='*60}")

    t0 = time.time()

    # Get series data
    try:
        series_data = api_call("content.getSeriesBySlug", {"slug": slug})
    except Exception as e:
        print(f"  ❌ فشل: {e}")
        return None

    sid = series_data["id"]
    title = series_data["title"]
    stype = series_data.get("type", "manga")
    cover = series_data.get("coverUrl", "")
    if cover and not cover.startswith("http"):
        cover = f"https://mangatime.org{cover}"
    description = series_data.get("description", "")
    genres_raw = series_data.get("genres", [])
    genre_names = [g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in genres_raw]

    # Get ALL chapters with their IDs
    chapters_meta = []
    cursor = None
    while True:
        params = {"seriesId": sid, "limit": 500}
        if cursor:
            params["cursor"] = cursor
        data = api_call("content.getChapters", params)
        chapters = data.get("chapters", [])
        for c in chapters:
            ch_url = f"https://mangatime.org/{stype}/{slug}/chapter/{c['number']}"
            chapters_meta.append({
                "id": c["id"],
                "number": c["number"],
                "title": c.get("title") or f"الفصل {c['number']}",
                "url": ch_url,
            })
        if not data.get("hasMore"):
            break
        cursor = data.get("nextCursor")
        if not cursor:
            break

    total = len(chapters_meta)
    print(f"  📚 {total} فصل")

    if not total:
        print("  ❌ مفيش فصول!")
        return None

    # Scrape pages using chapter ID directly (bypasses MangatimeScraper)
    chapters_out = []
    for idx, ch in enumerate(chapters_meta):
        print(f"  [{idx+1}/{total}] {ch['title']}... ", end="", flush=True)
        try:
            pages_data = api_call("content.getChapterPages", {"chapterId": ch["id"]})
            pages = pages_data.get("pages", [])
            if not pages:
                print("⚠")
                continue
        except Exception as e:
            print(f"❌ {e}")
            continue
        chapters_out.append({
            "id": f"ch_{ch['number']}_{idx}",
            "title": ch["title"],
            "number": ch["number"],
            "url": ch["url"],
            "date": "",
            "images": pages
        })
        print(f"✓ {len(pages)}ص")

    if not chapters_out:
        print("  ❌ فشل سحب أي فصل")
        return None

    manga_id = hashlib.md5((slug + title + str(time.time())).encode()).hexdigest()[:10]
    entry = {
        "id": manga_id,
        "title": title,
        "alternative": "",
        "author": series_data.get("author", ""),
        "artist": series_data.get("artist", ""),
        "status": "مستمرة",
        "cover": cover,
        "synopsis": description,
        "genres": genre_names,
        "url": f"https://mangatime.org/{stype}/{slug}",
        "chapters": chapters_out
    }
    elapsed = time.time() - t0
    mins = int(elapsed // 60)
    secs = int(elapsed % 60)
    print(f"  ✅ {len(chapters_out)}/{total} فصل — {mins}m {secs}s")
    return entry

# Load existing
existing = []
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        try:
            existing = json.load(f)
        except json.JSONDecodeError:
            existing = []

existing_urls = {m.get("url") for m in existing if m.get("url")}

total_start = time.time()
for slug, ename in SLUGS:
    url = f"https://mangatime.org/manhwa/{slug}"
    if url in existing_urls or f"https://mangatime.org/manga/{slug}" in existing_urls:
        print(f"\n⏭️  {ename} موجود بالفعل، تخطي")
        continue

    entry = scrape_one(slug, ename)
    if entry:
        existing = [m for m in existing if m.get("url") != entry["url"]]
        existing.append(entry)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

total_elapsed = time.time() - total_start
tm = int(total_elapsed // 60)
ts = int(total_elapsed % 60)
print(f"\n🏁 تم! الوقت: {tm}m {ts}s")
