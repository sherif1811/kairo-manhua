#!/usr/bin/env python3
"""
ابحث عن مانها في مواقع متعددة واختار الأفضل للسحب.
الاستخدام: python multi_search.py "اسم المانها"
"""
import sys, os, json, hashlib, time, re, urllib.request, urllib.parse, ssl
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE, "scraped_mangas.json")

# ========== MangaTime API ==========
def mangatime_api(proc, params):
    API = "https://mangatime.org/api/trpc"
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"{API}/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

def search_mangatime(query):
    results = []
    try:
        data = mangatime_api("content.search", {"search": query, "limit": 50})
        for item in data.get("results", []):
            s = item["series"]
            try:
                sd = mangatime_api("content.getSeriesBySlug", {"slug": s["slug"]})
                ch_count = sd.get("stats", {}).get("chapterCount", s.get("chapterCount", 0))
                ch_data = mangatime_api("content.getChapters", {"seriesId": s["id"], "limit": 5})
                total_pg = 0; pg_count = 0
                for ch in ch_data.get("chapters", []):
                    r = mangatime_api("content.getChapterPages", {"chapterId": ch["id"]})
                    n = len(r.get("pages", [])); total_pg += n; pg_count += 1
                avg_pages = total_pg / pg_count if pg_count else 0
            except:
                avg_pages = 0; ch_count = s.get("chapterCount", 0)
            results.append({
                "source": "MangaTime", "title": s["title"],
                "slug": s["slug"], "type": s.get("type", "manga"),
                "url": f"https://mangatime.org/{s.get('type','manga')}/{s['slug']}",
                "chapters": ch_count, "avg_pages": round(avg_pages, 1),
            })
    except Exception as e:
        print(f"  ⚠ MangaTime: {e}")
    return results

# ========== Madara sites ==========
MADARA_SITES = [
    {"name": "Olympus Staff", "url": "https://olympustaff.com"},
    {"name": "3asq",          "url": "https://3asq.org"},
    {"name": "LekManga",      "url": "https://lekmanga.site"},
]

def search_madara(site_name, site_url, query):
    results = []
    try:
        search_url = f"{site_url}/?s={urllib.parse.quote(query)}&post_type=wp-manga"
        req = urllib.request.Request(search_url, headers={"User-Agent": UA})
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        html = resp.read().decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "html.parser")
        items = soup.select(".tab-thumb .row, .c-tabs-item__content, .search-item, .c-search-result-item")
        if not items: items = soup.select("div.row.c-tabs-item__content")
        if not items: items = soup.select("div.c-tabs-item__content")
        for item in items:
            a = item.select_one("a")
            if not a or not a.get("href"): continue
            title = a.get("title") or a.text.strip()
            href = a["href"]
            ch_el = item.select_one(".chapter a, .total_chapter, .font-meta, .chapter-count")
            ch_num = 0
            if ch_el:
                m = re.search(r'(\d+)', ch_el.text.strip())
                if m: ch_num = int(m.group(1))
            results.append({"source": site_name, "title": title.strip(), "url": href, "chapters": ch_num, "avg_pages": -1})
    except Exception as e:
        print(f"  ⚠ {site_name}: {e}")
    return results

# ========== سحب من MangaTime ==========
def scrape_mangatime(slug, stype, title):
    sd = mangatime_api("content.getSeriesBySlug", {"slug": slug})
    sid = sd["id"]
    cover = sd.get("coverUrl", "")
    if cover and not cover.startswith("http"): cover = f"https://mangatime.org{cover}"
    desc = sd.get("description", "")
    genres = [g["name"] for g in sd.get("genres", []) if isinstance(g, dict) and "name" in g]
    author = sd.get("author", ""); status = sd.get("status", "ongoing")

    chapters_meta = []; cursor = None
    while True:
        params = {"seriesId": sid, "limit": 500}
        if cursor: params["cursor"] = cursor
        ch_data = mangatime_api("content.getChapters", params)
        for c in ch_data.get("chapters", []):
            chapters_meta.append({
                "id": c["id"], "number": c["number"],
                "title": c.get("title") or f"الفصل {c['number']}",
                "url": f"https://mangatime.org/{stype}/{slug}/chapter/{c['number']}",
            })
        if not ch_data.get("hasMore"): break
        cursor = ch_data.get("nextCursor")
        if not cursor: break
    chapters_meta.sort(key=lambda x: x["number"])

    chapters_out = []
    for ci, ch in enumerate(chapters_meta):
        print(f"  [{ci+1}/{len(chapters_meta)}] الفصل {ch['number']}... ", end="", flush=True)
        try:
            r = mangatime_api("content.getChapterPages", {"chapterId": ch["id"]})
            pages = r.get("pages", [])
            if not pages: print("⚠"); continue
        except Exception as e: print(f"❌ {e}"); continue
        chapters_out.append({"id": f"ch_{ch['number']}_{ci}", "title": ch["title"],
            "number": ch["number"], "url": ch["url"], "date": "", "images": pages})
        print(f"✓ {len(pages)}ص")

    return {
        "id": hashlib.md5((slug + title + str(time.time())).encode()).hexdigest()[:10],
        "title": title, "alternative": "", "author": author, "artist": "",
        "status": "مستمرة" if status == "ongoing" else "مكتملة",
        "cover": cover, "synopsis": desc, "genres": genres,
        "url": f"https://mangatime.org/{stype}/{slug}", "chapters": chapters_out
    }

# ========== سحب من Madara ==========
def scrape_madara(source_url, source_name):
    from scrapers.factory import get_scraper
    scraper = get_scraper(source_url)
    meta = scraper.scrape_metadata(source_url)
    chs = meta.get("chapters", [])

    chapters_out = []
    for ci, ch in enumerate(chs):
        ch_title = ch.get("title", f"الفصل {ci+1}")
        print(f"  [{ci+1}/{len(chs)}] {ch_title}... ", end="", flush=True)
        try:
            pages = scraper.scrape_chapter_pages(ch["url"])
            if not pages: print("⚠"); continue
        except Exception as e: print(f"❌ {e}"); continue
        chapters_out.append({"id": f"ch_{ci}_{hashlib.md5(ch['url'].encode()).hexdigest()[:8]}",
            "title": ch_title, "number": ci + 1, "url": ch["url"],
            "date": ch.get("date", ""), "images": pages})
        print(f"✓ {len(pages)}ص")

    return {
        "id": hashlib.md5((source_url + str(time.time())).encode()).hexdigest()[:10],
        "title": meta.get("title", "?"), "alternative": "",
        "author": meta.get("author", ""), "artist": meta.get("artist", ""),
        "status": meta.get("status", "مستمرة"),
        "cover": meta.get("cover_url", meta.get("cover", "")),
        "synopsis": meta.get("description", ""),
        "genres": meta.get("genres", "") if isinstance(meta.get("genres"), str) else ", ".join(meta.get("genres", [])),
        "url": source_url, "chapters": chapters_out
    }

# ========== حفظ ==========
def save_entry(entry):
    existing = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            try: existing = json.load(f)
            except: existing = []
    existing = [m for m in existing if m.get("url") != entry["url"]]
    existing.append(entry)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

# ========== الرئيسي ==========
def main():
    print("="*70)
    print("  🔍  البحث المتعدد — مانها كاملة من أفضل مصدر")
    print("="*70)

    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else input("\nاسم المانها: ").strip()
    if not query:
        print("❌ لازم تكتب اسم!")
        sys.exit(1)

    print(f"\n❓ البحث عن: \"{query}\"\n")

    all_results = []
    print("1/4 MangaTime...", flush=True)
    all_results.extend(search_mangatime(query))
    for i, site in enumerate(MADARA_SITES, 2):
        print(f"{i}/4 {site['name']}...", flush=True)
        all_results.extend(search_madara(site["name"], site["url"], query))

    if not all_results:
        print("\n❌ مفيش نتائج من أي موقع!")
        sys.exit(1)

    print(f"\n{'='*70}")
    print(f"✅ لقيت {len(all_results)} نتيجة من 4 مواقع:\n")
    all_results.sort(key=lambda r: (-r["chapters"], -r["avg_pages"] if r["avg_pages"] > 0 else 0))

    for i, r in enumerate(all_results, 1):
        pages_info = f" ({r['avg_pages']}ص/فصل)" if r["avg_pages"] > 0 else ""
        flag = "✅" if r["avg_pages"] >= 10 or r["avg_pages"] == -1 else "⚠️" if r["avg_pages"] > 0 else ""
        print(f"  {i:2d}. [{r['source']:14s}] {r['title'][:40]:40s} {r['chapters']:4d}ف{pages_info}{flag}")

    while True:
        choice = input(f"\n🔢 اختار رقم (1-{len(all_results)}): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(all_results):
            break
        print("❌ رقم مش صحيح!")
    selected = all_results[int(choice)-1]

    print(f"\n→ {selected['title']}")
    print(f"  المصدر: {selected['source']}")
    print(f"  URL: {selected['url']}")

    print(f"\n{'='*70}")
    print(f"📥  بدأ سحب {selected['title']}...")
    print(f"{'='*70}")

    t0 = time.time()
    if selected["source"] == "MangaTime":
        entry = scrape_mangatime(selected["slug"], selected.get("type", "manga"), selected["title"])
    else:
        entry = scrape_madara(selected["url"], selected["source"])

    if not entry.get("chapters"):
        print("❌ فشل سحب أي فصل")
        sys.exit(1)

    save_entry(entry)
    elapsed = time.time() - t0
    print(f"\n{'='*70}")
    print(f"✅ {entry['title']} — {len(entry['chapters'])} فصل ({int(elapsed//60)}m {int(elapsed%60)}s)")
    print(f"📁 المحفوظ في: scraped_mangas.json")

if __name__ == "__main__":
    main()
