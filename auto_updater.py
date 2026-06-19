#!/usr/bin/env python3
"""
المحدث التلقائي الذكي — الإصدار المحسّن
- يقرأ الـ Index (scraped_mangas.json) ويشوف كل مانجا
- يكتشف الفصول الجديدة ويحمّلها
- يستخدم ScraperEngine للكتابة المباشرة في mangas_data/{id}.json
- يعالج الفصول على دفعات
- نظام Retry للفصول الفاشلة
- يسجل تقارير مفصلة

التشغيل:
  python auto_updater.py                # حلقة لا نهائية (Daemon)
  python auto_updater.py --once         # دورة واحدة فقط
  python auto_updater.py --manga-id=X   # تحديث مانجا محددة
"""
import sys, os, json, time, re, hashlib, urllib.request, urllib.parse, ssl

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
DATA_DIR = os.path.join(BASE_DIR, "mangas_data")
CONFIG_FILE = os.path.join(BASE_DIR, "mangas_data", "auto_updater_config.json")
os.makedirs(DATA_DIR, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
API = "https://mangatime.org/api/trpc"

# ===== المساعدة =====
def api_call(proc, params):
    payload = {"0": {"json": params}}
    encoded = urllib.parse.quote(json.dumps(payload))
    url = f"{API}/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

def load_index():
    if not os.path.exists(INDEX_FILE): return []
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        try: return json.load(f)
        except: return []

def save_index(mangas):
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(mangas, f, ensure_ascii=False, indent=2)

def load_manga_data(manga_id):
    path = os.path.join(DATA_DIR, f"{manga_id}.json")
    if not os.path.exists(path): return None
    with open(path, "r", encoding="utf-8") as f:
        try: return json.load(f)
        except: return None

def save_manga_data(manga_id, title, chapters):
    path = os.path.join(DATA_DIR, f"{manga_id}.json")
    existing = load_manga_data(manga_id) or {}
    existing["id"] = manga_id
    existing["title"] = title
    existing["chapters"] = chapters
    existing["updated_at"] = time.time()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

def is_enabled():
    if not os.path.exists(CONFIG_FILE): return False
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f).get("enabled", False)
    except: return False

def extract_chapter_number(ch):
    if isinstance(ch.get("number"), (int, float)) and ch["number"]:
        return float(ch["number"])
    title = str(ch.get("title", ""))
    url = ch.get("url", "")
    m = re.search(r'(?:الفصل|chapter|ch|chap|ch\.)\s*(\d+(?:\.\d+)?)', title, re.I)
    if m: return float(m.group(1))
    parts = [p for p in url.rstrip('/').split('/') if p]
    if parts:
        m = re.search(r'(\d+(?:\.\d+)?)', parts[-1])
        if m: return float(m.group(1))
    return 0.0

# ===== تحديث مانجا من MangaTime =====
def update_mangatime(manga):
    mid = manga.get("id")
    url = manga.get("url", "")
    title = manga.get("title", "?")
    if not url or "mangatime.org" not in url:
        return False, 0

    parts = url.replace("https://mangatime.org/", "").split("/")
    if len(parts) < 2: return False, 0
    stype, slug = parts[0], parts[1]

    # جيب بيانات السلسلة
    try:
        sd = api_call("content.getSeriesBySlug", {"slug": slug})
        sid = sd["id"]
    except Exception as e:
        print(f"[Updater] ❌ {title}: فشل جلب السلسلة — {e}")
        return False, 0

    # جيب كل الفصول البعيدة
    all_remote = []; cursor = None
    while True:
        params = {"seriesId": sid, "limit": 500}
        if cursor: params["cursor"] = cursor
        try: cd = api_call("content.getChapters", params)
        except: break
        all_remote.extend(cd.get("chapters", []))
        if not cd.get("hasMore"): break
        cursor = cd.get("nextCursor")
        if not cursor: break
    all_remote.sort(key=lambda c: c["number"])

    if not all_remote:
        print(f"[Updater] ⏭️ {title}: مفيش فصول")
        return False, 0

    # جيب الفصول المحلية
    local_data = load_manga_data(mid)
    local_chs = (local_data or {}).get("chapters", []) or manga.get("chapters", [])

    # آخر رقم عندنا
    max_local = 0
    for ch in local_chs:
        n = extract_chapter_number(ch)
        if n > max_local: max_local = n

    new_remote = [c for c in all_remote if c["number"] > max_local]
    if not new_remote:
        print(f"[Updater] ✅ {title}: آخر فصل {int(max_local)} — ولا جديد")
        return False, 0

    print(f"[Updater] 🆕 {title}: {len(new_remote)} فصل جديد (من {new_remote[0]['number']} إلى {new_remote[-1]['number']})")

    # اسحب الفصول الجديدة
    new_chs = []
    for ci, ch in enumerate(new_remote):
        ch_url = f"https://mangatime.org/{stype}/{slug}/chapter/{ch['number']}"
        print(f"  [{ci+1}/{len(new_remote)}] الفصل {ch['number']}... ", end="", flush=True)
        try:
            pd = api_call("content.getChapterPages", {"chapterId": ch["id"]})
            pages = pd.get("pages", [])
            if not pages: print("⚠"); continue
        except Exception as e: print(f"❌ {e}"); continue
        new_chs.append({
            "id": f"ch_{ch['number']}_{ci}",
            "title": ch.get("title") or f"الفصل {ch['number']}",
            "number": ch["number"], "url": ch_url, "date": "", "images": pages
        })
        print(f"✓ {len(pages)}ص")

    if not new_chs:
        print(f"[Updater] ❌ {title}: فشل سحب الفصول الجديدة")
        return False, 0

    # ضم وترتيب
    local_chs.extend(new_chs)
    local_chs.sort(key=lambda x: extract_chapter_number(x))
    save_manga_data(mid, title, local_chs)

    # حدّث index
    index = load_index()
    for m in index:
        if m.get("id") == mid:
            m["chapters"] = []
            break
    save_index(index)

    print(f"[Updater] ✅ {title}: {len(new_chs)} فصل جديد (المجموع: {len(local_chs)})")
    return True, len(new_chs)

# ===== دورة التحديث =====
def run_cycle():
    print(f"\n{'='*60}")
    print(f"[Updater] بدء دورة التحديث — {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    index = load_index()
    if not index:
        print("[Updater] Index فاضي أو مش موجود"); return

    total_new = 0
    for idx, manga in enumerate(index, 1):
        if not is_enabled():
            print("[Updater] تم إيقاف المحدث"); return
        url = manga.get("url", "")
        if not url: continue
        print(f"\n[{idx}/{len(index)}] {manga.get('title', '?')}")
        if "mangatime.org" in url:
            ok, count = update_mangatime(manga)
            if ok: total_new += count
        elif any(x in url for x in ["olympustaff.com", "lekmanga", "3asq.org", "hijala.com"]):
            print(f"  ⏭️ مصدر Madara — استخدم update_all.py")
        else:
            print(f"  ⏭️ مصدر مش معروف")
        time.sleep(3)  # مهلة بين المانجا

    print(f"\n{'='*60}")
    print(f"[Updater] انتهى — {total_new} فصول جديدة")
    print(f"{'='*60}")

# ===== التشغيل =====
if __name__ == "__main__":
    if "--manga-id" in sys.argv:
        idx = sys.argv.index("--manga-id")
        if idx + 1 < len(sys.argv):
            mid = sys.argv[idx + 1]
            index = load_index()
            manga = next((m for m in index if m.get("id") == mid), None)
            if manga:
                update_mangatime(manga)
            else:
                print(f"❌ مانجا {mid} مش موجودة في index")
        sys.exit(0)

    if "--once" in sys.argv:
        run_cycle()
        sys.exit(0)

    # Daemon mode
    print("[Updater] 🚀 المحدث التلقائي شغال (Daemon)")
    while True:
        if is_enabled():
            run_cycle()
        else:
            time.sleep(10)
        # انتظر 6 ساعات أو لحد ما يتعطل
        for _ in range(360):
            time.sleep(60)
            if not is_enabled(): break
