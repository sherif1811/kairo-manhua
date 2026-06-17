#!/usr/bin/env python3
"""
فحص وتحديث كل المانجا المسحوبة من أي مصدر.
يشوف كل مانجا في scraped_mangas.json، ويقارنها بالمصادر، وينزل الجديد.
"""
import sys, os, json, re, time, urllib.request, urllib.parse, ssl, hashlib

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

# ===== استخراج رقم الفصل من أي مصدر =====
def extract_chapter_number(ch):
    """يجيب رقم الفصل من title أو url"""
    title = str(ch.get("title", ch.get("number", "")))
    if isinstance(ch.get("number"), (int, float)) and ch["number"]:
        return float(ch["number"])
    url = ch.get("url", "")
    # جرب من الـ title
    m = re.search(r'(?:الفصل|chapter|ch|chap|ch\.)\s*(\d+(?:\.\d+)?)', title, re.I)
    if m: return float(m.group(1))
    # جرب من الـ URL
    parts = [p for p in url.rstrip('/').split('/') if p]
    if parts:
        m = re.search(r'(\d+(?:\.\d+)?)', parts[-1])
        if m: return float(m.group(1))
    return 0.0

# ===== تحميل الملف =====
if not os.path.exists(OUTPUT_FILE):
    print("❌ مفيش scraped_mangas.json")
    sys.exit(1)

with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
    mangas = json.load(f)

print(f"📁 عدد المانجا: {len(mangas)}\n")
total_new = 0
updated_any = False

for idx, manga in enumerate(mangas, 1):
    url = manga.get("url", "")
    title = manga.get("title", "?")
    existing_chs = manga.get("chapters", [])

    if not url:
        print(f"[{idx}/{len(mangas)}] ⏭️ {title} — مفيش URL")
        continue

    print(f"[{idx}/{len(mangas)}] {title}")
    print(f"  📍 {url}")
    print(f"  📚 عندك: {len(existing_chs)} فصل")

    # ===== تحديد المصدر والمقارنة =====
    new_chapters_data = []

    if "mangatime.org" in url:
        # ------ MangaTime: مقارنة بالأرقام ------
        parts = url.replace("https://mangatime.org/", "").split("/")
        if len(parts) < 2:
            print("  ❌ URL مش مفهوم\n")
            continue
        stype, slug = parts[0], parts[1]

        try:
            series_data = api_call("content.getSeriesBySlug", {"slug": slug})
            sid = series_data["id"]
        except Exception as e:
            print(f"  ❌ فشل: {e}\n")
            continue

        # رتب الفصول المحلية
        existing_chs.sort(key=lambda x: x.get("number", 0) if isinstance(x.get("number"), (int, float)) else extract_chapter_number(x))
        max_local = existing_chs[-1]["number"] if existing_chs and isinstance(existing_chs[-1].get("number"), (int, float)) else extract_chapter_number(existing_chs[-1]) if existing_chs else 0

        # جيب كل الفصول من MangaTime
        all_remote = []
        cursor = None
        while True:
            params = {"seriesId": sid, "limit": 500}
            if cursor: params["cursor"] = cursor
            try:
                ch_data = api_call("content.getChapters", params)
            except:
                break
            all_remote.extend(ch_data.get("chapters", []))
            if not ch_data.get("hasMore"): break
            cursor = ch_data.get("nextCursor")
            if not cursor: break

        all_remote.sort(key=lambda c: c["number"])
        new_remote = [c for c in all_remote if c["number"] > max_local]

        if not new_remote:
            print(f"  ✅ ولا فصل جديد (آخر فصل {int(max_local)})\n")
            continue

        print(f"  🆕 {len(new_remote)} فصل جديد (من {new_remote[0]['number']} إلى {new_remote[-1]['number']})")

        for ci, ch in enumerate(new_remote):
            ch_url = f"https://mangatime.org/{stype}/{slug}/chapter/{ch['number']}"
            print(f"  [{ci+1}/{len(new_remote)}] الفصل {ch['number']}... ", end="", flush=True)
            try:
                pages_data = api_call("content.getChapterPages", {"chapterId": ch["id"]})
                pages = pages_data.get("pages", [])
                if not pages:
                    print("⚠"); continue
            except Exception as e:
                print(f"❌ {e}"); continue
            new_chapters_data.append({
                "id": f"ch_{ch['number']}_{ci}",
                "title": ch.get("title") or f"الفصل {ch['number']}",
                "number": ch["number"],
                "url": ch_url,
                "date": "",
                "images": pages
            })
            print(f"✓ {len(pages)}ص")

    elif any(x in url for x in ["olympustaff.com", "olympusstaff.com", "lekmanga", "3asq.org", "hijala.com"]):
        # ------ مصادر تانية: مقارنة بالـ URL ------
        from scrapers.factory import get_scraper
        try:
            scraper = get_scraper(url)
            meta = scraper.scrape_metadata(url)
        except Exception as e:
            print(f"  ❌ فشل جلب الميتاداتا: {e}\n")
            continue

        remote_chs = meta.get("chapters", [])
        existing_urls = {c.get("url") for c in existing_chs if c.get("url")}

        # شوف مين جديد
        new_urls = []
        for rc in remote_chs:
            rurl = rc.get("url", "")
            if rurl not in existing_urls:
                new_urls.append(rc)

        if not new_urls:
            print(f"  ✅ ولا فصل جديد\n")
            continue

        # رتب الجديد (الأقدم أولاً عشان يضاف بالترتيب)
        new_urls.sort(key=extract_chapter_number)

        print(f"  🆕 {len(new_urls)} فصل جديد")

        for ci, rc in enumerate(new_urls):
            ch_title = rc.get("title", f"الفصل {ci+1}")
            print(f"  [{ci+1}/{len(new_urls)}] {ch_title}... ", end="", flush=True)
            try:
                pages = scraper.scrape_chapter_pages(rc["url"])
                if not pages:
                    print("⚠"); continue
            except Exception as e:
                print(f"❌ {e}"); continue
            new_chapters_data.append({
                "id": f"ch_new_{ci}_{hashlib.md5(rc['url'].encode()).hexdigest()[:8]}",
                "title": ch_title,
                "number": extract_chapter_number(rc),
                "url": rc["url"],
                "date": rc.get("date", ""),
                "images": pages
            })
            print(f"✓ {len(pages)}ص")

    else:
        print(f"  ⏭️ مصدر مش معروف (مفيش سكريبير)\n")
        continue

    # ===== ضم الجديد للقديم وترتيب =====
    if not new_chapters_data:
        print("  ❌ فشل سحب الفصول الجديدة\n")
        continue

    existing_chs.extend(new_chapters_data)
    existing_chs.sort(key=lambda x: x.get("number", 0) if isinstance(x.get("number"), (int, float)) else extract_chapter_number(x))
    manga["chapters"] = existing_chs
    updated_any = True
    total_new += len(new_chapters_data)
    print(f"  ✅ {len(new_chapters_data)} فصل جديد (المجموع: {len(existing_chs)})\n")

# ===== حفظ =====
if updated_any:
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(mangas, f, ensure_ascii=False, indent=2)
    print(f"{'='*60}")
    print(f"📝 اتحدث {sum(1 for m in mangas if len(m.get('chapters',[])) > 0)} مانجا")
    print(f"🆕 إجمالي الفصول الجديدة: {total_new}")
    print(f"📁 scraped_mangas.json")
else:
    print(f"{'='*60}")
    print("📝 كل حاجة محدثة ✅")

# ===== ملخص =====
print(f"\n📋 الحالة النهائية:")
with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
    final = json.load(f)
for m in final:
    chs = m.get("chapters", [])
    if chs:
        last = chs[-1]
        last_num = last.get("number", extract_chapter_number(last))
        print(f"  • {m['title']} — {len(chs)} فصل (آخر {int(last_num)})")
    else:
        print(f"  • {m['title']} — 0 فصل")
