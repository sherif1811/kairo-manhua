#!/usr/bin/env python3
"""
فحص وتحديث الفصول الجديدة للمانجا المسحوبة من MangaTime.
يشوف كل مانجا في scraped_mangas.json، ويقارنها بـ MangaTime، وينزل الجديد.
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

# تحميل الملف
if not os.path.exists(OUTPUT_FILE):
    print("❌ مفيش scraped_mangas.json")
    sys.exit(1)

with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
    mangas = json.load(f)

print(f"📁 عدد المانجا: {len(mangas)}\n")

total_new = 0
updated_mangas = []

for idx, manga in enumerate(mangas, 1):
    url = manga.get("url", "")
    # نتخطى اللي مش من MangaTime
    if "mangatime.org" not in url:
        print(f"[{idx}/{len(mangas)}] ⏭️ {manga['title']} — مش من MangaTime")
        continue

    # استخراج النوع والـ slug من الـ URL
    # https://mangatime.org/{type}/{slug}
    parts = url.replace("https://mangatime.org/", "").split("/")
    if len(parts) < 2:
        print(f"[{idx}/{len(mangas)}] ❌ {manga['title']} — URL مش مفهوم")
        continue
    stype, slug = parts[0], parts[1]

    existing_chs = manga.get("chapters", [])
    # نجيب أعلى رقم فصل موجود (بعد ترتيب)
    existing_chs.sort(key=lambda x: x.get("number", 0))
    max_local = existing_chs[-1]["number"] if existing_chs else 0
    local_count = len(existing_chs)

    print(f"[{idx}/{len(mangas)}] {manga['title']}", flush=True)

    # نجيب الفصول من MangaTime
    try:
        series_data = api_call("content.getSeriesBySlug", {"slug": slug})
        sid = series_data["id"]
        remote_count = series_data.get("stats", {}).get("chapterCount", 0)
    except Exception as e:
        print(f"  ❌ فشل جلب بيانات السلسلة: {e}")
        continue

    print(f"  عندك: {local_count} فصل (آخر فصل {int(max_local)})", flush=True)

    # نجيب كل الفصول من API عشان نشوف الجديد
    all_remote = []
    cursor = None
    while True:
        params = {"seriesId": sid, "limit": 500}
        if cursor:
            params["cursor"] = cursor
        try:
            ch_data = api_call("content.getChapters", params)
        except Exception as e:
            print(f"  ❌ فشل جلب الفصول: {e}")
            break
        all_remote.extend(ch_data.get("chapters", []))
        if not ch_data.get("hasMore"):
            break
        cursor = ch_data.get("nextCursor")
        if not cursor:
            break

    # نرتب الفصول ونشوف مين الجديد
    all_remote.sort(key=lambda c: c["number"])
    new_chs = [c for c in all_remote if c["number"] > max_local]

    if not new_chs:
        print(f"  ✅ ولا فصل جديد (آخر فصل عندك = {int(max_local)})")
        total_new += 0
        continue

    print(f"  🆕 في {len(new_chs)} فصل جديد (من {new_chs[0]['number']} إلى {new_chs[-1]['number']})")

    # نسحب الفصول الجديدة
    new_chapters = []
    for ci, ch in enumerate(new_chs):
        ch_url = f"https://mangatime.org/{stype}/{slug}/chapter/{ch['number']}"
        print(f"  [{ci+1}/{len(new_chs)}] الفصل {ch['number']}... ", end="", flush=True)
        try:
            pages_data = api_call("content.getChapterPages", {"chapterId": ch["id"]})
            pages = pages_data.get("pages", [])
            if not pages:
                print("⚠")
                continue
        except Exception as e:
            print(f"❌ {e}")
            continue
        new_chapters.append({
            "id": f"ch_{ch['number']}_{ci}",
            "title": ch.get("title") or f"الفصل {ch['number']}",
            "number": ch["number"],
            "url": ch_url,
            "date": "",
            "images": pages
        })
        print(f"✓ {len(pages)}ص")

    if not new_chapters:
        print("  ❌ فشل سحب الفصول الجديدة")
        continue

    # ضم الفصول الجديدة مع القديمة وترتيب
    existing_chs.extend(new_chapters)
    existing_chs.sort(key=lambda x: x.get("number", 0))
    manga["chapters"] = existing_chs
    updated_mangas.append(manga)

    total_new += len(new_chapters)
    print(f"  ✅ {len(new_chapters)} فصل جديد تمت إضافتهم (المجموع: {len(existing_chs)} فصل)")

# حفظ التعديلات
if updated_mangas:
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(mangas, f, ensure_ascii=False, indent=2)
    print(f"\n{'='*60}")
    print(f"📝 تم تحديث {len(updated_mangas)} مانجا")
    print(f"🆕 إجمالي الفصول الجديدة: {total_new}")
    print(f"📁 المحفوظ في: scraped_mangas.json")
else:
    print(f"\n{'='*60}")
    print("📝 ولا مانجا اتحتاج تحديث، كل حاجة fresh ✅")

print(f"\n📋  آخر حالة:")
with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
    final = json.load(f)
for m in final:
    chs = m.get("chapters", [])
    print(f"  • {m['title']} — {len(chs)} فصل (آخر فصل {int(chs[-1]['number']) if chs else 0})")
