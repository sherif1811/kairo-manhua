#!/usr/bin/env python3
"""تحقق من format لأكثر من سلسلة"""
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

slugs = ["solo-leveling", "noblesse", "for-your-murder", "solo-leveling-ragnarok", "jujutsu-kaisen", "blue-lock", "one-punch-man"]

for slug in slugs:
    try:
        sd = api_call("content.getSeriesBySlug", {"slug": slug})
        sid = sd["id"]
        chs = api_call("content.getChapters", {"seriesId": sid, "limit": 3})
        if chs.get("chapters"):
            cid = chs["chapters"][0]["id"]
            r = api_call("content.getChapterPages", {"chapterId": cid})
            fmt = r.get("format", "?")
            pg = r.get("pages", [])
            pages_type = "strings" if pg and isinstance(pg[0], str) else "objects" if pg and isinstance(pg[0], dict) else "empty"
            print(f"  {slug:30s} format={fmt:15s} pages={len(pg)} ({pages_type})")
        else:
            print(f"  {slug:30s} مفيش فصول")
    except Exception as e:
        print(f"  {slug:30s} ❌ {str(e)[:60]}")
