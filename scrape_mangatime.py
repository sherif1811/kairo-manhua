#!/usr/bin/env python3
import sys, os, json, hashlib, time
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from scrapers.factory import get_scraper

URL = "https://mangatime.org/manga/one-piece"
print(f"جاري سحب: {URL}")
print()

scraper = get_scraper(URL)
meta = scraper.scrape_metadata(URL)

title = meta.get("title", "Jujutsu Kaisen")
cover = meta.get("cover", "")
desc = meta.get("description", "")
genres = meta.get("genres", [])
chapters = meta.get("chapters", [])

print(f"العنوان: {title}")
print(f"الغلاف: {cover}")
genre_names = [g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in (genres or [])]
print(f"التصنيفات: {', '.join(genre_names) if genre_names else 'لا يوجد'}")
print(f"إجمالي الفصول: {len(chapters)}")
print()

# Build entry for scraped_mangas.json
manga_id = hashlib.md5((URL + title + str(time.time())).encode()).hexdigest()[:10]

chapters_out = []
for idx, ch in enumerate(chapters):
    ch_num = ch.get("number", idx + 1)
    ch_id = f"ch_{ch_num}_{idx}"
    ch_title = ch.get("title", f"الفصل {ch_num}")
    ch_url = ch.get("url", "")

    print(f"  جاري سحب الفصل {ch_num} ({ch_title})...")
    try:
        pages = scraper.scrape_chapter_pages(ch_url)
        if not pages:
            print(f"    ⚠ لم يتم العثور على صور")
            continue
    except Exception as e:
        print(f"    ❌ فشل: {e}")
        continue

    chapters_out.append({
        "id": ch_id,
        "title": ch_title,
        "number": ch_num,
        "url": ch_url,
        "date": "",
        "images": pages
    })
    print(f"    ✓ {len(pages)} صورة")

if not chapters_out:
    print("❌ لم يتم سحب أي فصل")
    sys.exit(1)

entry = {
    "id": manga_id,
    "title": title,
    "alternative": "",
    "author": meta.get("author", ""),
    "artist": meta.get("artist", ""),
    "status": "مستمرة",
    "cover": cover,
    "synopsis": desc,
    "genres": genre_names,
    "url": URL,
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

existing = [m for m in existing if m.get("url") != URL]
existing.append(entry)

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(existing, f, ensure_ascii=False, indent=2)

print()
print(f"✅ تمت إضافة \"{title}\" بنجاح!")
print(f"   إجمالي الفصول المسحوبة: {len(chapters_out)}")
print(f"   المحفوظ في: scraped_mangas.json")
