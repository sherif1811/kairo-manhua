#!/usr/bin/env python3
"""فحص عدد صفحات كل فصل لعدة سلاسل"""
import sys, json, urllib.request, urllib.parse, ssl
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

def api_call(proc, params):
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

slugs = ["for-your-murder", "solo-leveling", "solo-leveling-ragnarok", "noblesse"]

for slug in slugs:
    sd = api_call("content.getSeriesBySlug", {"slug": slug})
    sid = sd["id"]
    chs = api_call("content.getChapters", {"seriesId": sid, "limit": 10})
    total_pages = 0
    counts = []
    for ch in chs["chapters"]:
        r = api_call("content.getChapterPages", {"chapterId": ch["id"]})
        n = len(r.get("pages", []))
        counts.append(n)
        total_pages += n
    avg = total_pages / len(counts) if counts else 0
    print(f"{slug:30s} فصول: {len(counts)}, متوسط الصفحات: {avg:.1f}, أدنى: {min(counts)}, أعلى: {max(counts)}")
