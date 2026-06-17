#!/usr/bin/env python3
"""فحص تفاصيل getChapterPages"""
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

sd = api_call("content.getSeriesBySlug", {"slug": "solo-leveling"})
sid = sd["id"]
chs = api_call("content.getChapters", {"seriesId": sid, "limit": 5})
ch = chs["chapters"][0]
cid = ch["id"]

r = api_call("content.getChapterPages", {"chapterId": cid})

print("=== keys ===")
for k, v in r.items():
    if isinstance(v, list):
        print(f"  {k}: list[{len(v)}]")
        if v and isinstance(v[0], dict):
            print(f"    first elem keys: {list(v[0].keys())}")
        elif v and isinstance(v[0], str):
            print(f"    first elem: {v[0][:100]}")
    elif isinstance(v, dict):
        print(f"  {k}: dict keys={list(v.keys())[:10]}")
    else:
        print(f"  {k}: {v}")

print(f"\n=== format: {r.get('format')} ===")

# جرب مع targetLang
print("\n=== مع targetLang ===")
r2 = api_call("content.getChapterPages", {"chapterId": cid, "targetLang": "ar"})
print(f"  pages: {len(r2.get('pages', []))}")
if r2.get("pages") and isinstance(r2["pages"][0], dict):
    print(f"  page keys: {list(r2['pages'][0].keys())}")
    if "bubbles" in r2["pages"][0]:
        print(f"  🎯 فيه bubbles!! {len(r2['pages'][0]['bubbles'])}")
        for b in r2["pages"][0]["bubbles"][:2]:
            print(f"    {json.dumps(b, ensure_ascii=False)[:200]}")
