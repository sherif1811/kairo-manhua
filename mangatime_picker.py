#!/usr/bin/env python3
"""
أداة تفاعلية: تصفح مانجا MangaTime، اختار 5، وسحبهم كاملين.
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

# تحميل الموجود
existing = []
existing_urls = set()
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        try:
            existing = json.load(f)
            existing_urls = {m.get("url") for m in existing if m.get("url")}
        except:
            existing = []

print(f"📁 الموجود حالياً في scraped_mangas.json: {len(existing)} مانجا")

# ========== 1. جلب كل السلاسل ==========
print("جاري تحميل قائمة المانجا من MangaTime...")
data = api_call("content.search", {"search": "", "page": 1, "limit": 50})
results = data.get("results", [])

all_series = []
for item in results:
    s = item["series"]
    mangatime_url = f"https://mangatime.org/{s.get('type', 'manga')}/{s['slug']}"
    exists = mangatime_url in existing_urls
    all_series.append({
        "id": s["id"],
        "title": s["title"],
        "slug": s["slug"],
        "type": s.get("type", "manga"),
        "chapters": s.get("chapterCount", 0),
        "rating": round(s.get("rating", 0) or 0, 1),
        "exists": exists,
    })

# جلب التصنيفات لكل سلسلة
print(f"جاري جلب التصنيفات لـ {len(all_series)} سلسلة...")
for i, series in enumerate(all_series):
    try:
        sd = api_call("content.getSeriesBySlug", {"slug": series["slug"]})
        genres = [g["name"] for g in sd.get("genres", []) if isinstance(g, dict) and "name" in g]
        series["genres"] = genres
        series["cover"] = sd.get("coverUrl", "")
        if series["cover"] and not series["cover"].startswith("http"):
            series["cover"] = f"https://mangatime.org{series['cover']}"
        series["description"] = sd.get("description", "")
        series["author"] = sd.get("author", "")
        series["status"] = sd.get("status", "ongoing")
    except:
        series["genres"] = []
        series["cover"] = ""
        series["description"] = ""
        series["author"] = ""
        series["status"] = "ongoing"
    mark = "✓" if series["exists"] else " "
    print(f"  [{mark}] {i+1}/{len(all_series)} {series['title']}", flush=True)

# حفظ كملف للرجوع
with open(os.path.join(BASE, "mangatime_catalog.json"), "w", encoding="utf-8") as f:
    json.dump(all_series, f, ensure_ascii=False, indent=2)

# ========== 2. عرض القائمة ==========
print("\n" + "="*80)
print("                            📚  كتالوج MangaTime")
print("="*80)

manhwa_list = [s for s in all_series if s.get("type") == "manhwa"]
manga_list = [s for s in all_series if s.get("type") == "manga"]
manhua_list = [s for s in all_series if s.get("type") == "manhua"]

print(f"الكل: {len(all_series)}  |  مانها: {len(manhwa_list)}  |  مانجا: {len(manga_list)}  |  مانها: {len(manhua_list)}")
print("(✓ = موجود بالفعل في scraped_mangas.json)\n")

for i, s in enumerate(all_series, 1):
    gs = ", ".join(s.get("genres", [])[:5]) if s.get("genres") else "—"
    tp = {"manhwa": "🇰🇷", "manga": "🇯🇵", "manhua": "🇨🇳"}.get(s.get("type", "manga"), "📖")
    mark = "✓" if s["exists"] else " "
    print(f"  [{mark}] {i:2d}. {tp} {s['title'][:45]:45s}  {s['chapters']:4d}ف  ⭐{s['rating']}")
    print(f"         التصنيفات: {gs}")

print(f"\n{'='*80}")

# ========== 3. اختيار ==========
while True:
    choices = input("\n🔢 اختر أرقام المانجا (مثال: 1,5,8,12,20 أو 1-5): ").strip()
    if not choices:
        print("❌ لازم تختار على الأقل واحدة!")
        continue

    selected_nums = set()
    for part in choices.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            selected_nums.update(range(int(a.strip()), int(b.strip()) + 1))
        else:
            selected_nums.add(int(part))

    selected_raw = [all_series[i-1] for i in sorted(selected_nums) if 1 <= i <= len(all_series)]

    # فصل الموجود والجديد
    new_ones = [s for s in selected_raw if not s["exists"]]
    existing_ones = [s for s in selected_raw if s["exists"]]

    if existing_ones:
        print(f"\n⏭️  موجودة مسبقاً (هتتخطى):")
        for s in existing_ones:
            print(f"     • {s['title']}")

    if not new_ones:
        print("❌ كل اللي اخترتهم موجودين قبل كده!")
        continue

    print(f"\n✅ اللي هيتم سحبه ({len(new_ones)}):")
    for s in new_ones:
        gs = ", ".join(s.get("genres", [])[:5]) if s.get("genres") else "—"
        print(f"  • {s['title']} ({s['type']}) — {s['chapters']}ف — {gs}")

    ok = input(f"\nتمام؟ (Enter للمتابعة, n لإعادة الاختيار): ").strip().lower()
    if ok != "n":
        selected = new_ones
        break

# ========== 4. السحب ==========
total_start = time.time()

for idx, series in enumerate(selected, 1):
    slug = series["slug"]
    title = series["title"]
    stype = series.get("type", "manga")
    ch_count = series["chapters"]

    print(f"\n{'='*60}")
    print(f"[{idx}/{len(selected)}]  {title} ({stype}) — {ch_count} فصل")
    print(f"{'='*60}")

    t0 = time.time()

    # جلب كل الفصول وترتيبهم تصاعدياً
    chapters_meta = []
    cursor = None
    while True:
        params = {"seriesId": series["id"], "limit": 500}
        if cursor:
            params["cursor"] = cursor
        try:
            ch_data = api_call("content.getChapters", params)
        except Exception as e:
            print(f"  ❌ فشل جلب الفصول: {e}")
            break
        for c in ch_data.get("chapters", []):
            ch_url = f"https://mangatime.org/{stype}/{slug}/chapter/{c['number']}"
            chapters_meta.append({
                "id": c["id"],
                "number": c["number"],
                "title": c.get("title") or f"الفصل {c['number']}",
                "url": ch_url,
            })
        if not ch_data.get("hasMore"):
            break
        cursor = ch_data.get("nextCursor")
        if not cursor:
            break

    # ترتيب الفصول تصاعدياً حسب رقم الفصل
    chapters_meta.sort(key=lambda x: x["number"])

    total_ch = len(chapters_meta)
    print(f"  📚 {total_ch} فصل (مرتبة 1 → {total_ch})")

    if not total_ch:
        print("  ❌ مفيش فصول، تخطي")
        continue

    # سحب الصفحات بالترتيب
    chapters_out = []
    for ci, ch in enumerate(chapters_meta):
        print(f"  [{ci+1}/{total_ch}] الفصل {ch['number']}... ", end="", flush=True)
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
            "id": f"ch_{ch['number']}_{ci}",
            "title": ch["title"],
            "number": ch["number"],
            "url": ch["url"],
            "date": "",
            "images": pages
        })
        print(f"✓ {len(pages)}ص")

    if not chapters_out:
        print("  ❌ فشل سحب أي فصل")
        continue

    # حفظ
    manga_id = hashlib.md5((slug + title + str(time.time())).encode()).hexdigest()[:10]
    entry = {
        "id": manga_id,
        "title": title,
        "alternative": "",
        "author": series.get("author", ""),
        "artist": "",
        "status": "مستمرة" if series.get("status") == "ongoing" else "مكتملة",
        "cover": series.get("cover", ""),
        "synopsis": series.get("description", ""),
        "genres": series.get("genres", []),
        "url": f"https://mangatime.org/{stype}/{slug}",
        "chapters": chapters_out
    }

    existing = [m for m in existing if m.get("url") != entry["url"]]
    existing.append(entry)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t0
    print(f"\n  ✅ {title} — {len(chapters_out)}/{total_ch} فصل ({int(elapsed//60)}m {int(elapsed%60)}s)")

# ========== 5. النتيجة ==========
total_time = time.time() - total_start
print(f"\n{'='*60}")
print(f"🏁  تم الانتهاء!")
print(f"⏱️  الوقت الكلي: {int(total_time//60)}m {int(total_time%60)}s")
print(f"📁  المحفوظ في: scraped_mangas.json")

print(f"\n📋  الملخص النهائي:")
with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
    final_data = json.load(f)
for m in final_data:
    chs = m.get("chapters", [])
    print(f"  • {m['title']} — {len(chs)} فصل (من {chs[0]['number']} إلى {chs[-1]['number']})" if chs else f"  • {m['title']} — 0 فصل")
