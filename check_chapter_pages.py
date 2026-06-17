#!/usr/bin/env python3
"""تحقق من صفحة فصل كامل لرؤية العدد الحقيقي"""
import sys, json, urllib.request, urllib.parse, ssl
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

def api_call(proc, params):
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

# جيب فصول noblesse من اول فصل
sd = api_call("content.getSeriesBySlug", {"slug": "noblesse"})
sid = sd["id"]

# جيب آخر 10 فصول عشان نشوف عدد الصفحات
chs = api_call("content.getChapters", {"seriesId": sid, "limit": 10})
for ch in chs["chapters"]:
    r = api_call("content.getChapterPages", {"chapterId": ch["id"]})
    pages = r.get("pages", [])
    print(f"  الفصل {ch['number']:>6}: {len(pages):3d} صفحة ('{r.get('format')}')")
