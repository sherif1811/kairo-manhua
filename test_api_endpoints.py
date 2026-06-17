#!/usr/bin/env python3
"""اختبار API endpoints مختلفة لمعرفة إزاي بنجيب النصوص"""
import sys, json, urllib.request, urllib.parse, ssl
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# جيب chapter ID لأي فصل
def api_call(proc, params):
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        r = json.loads(resp.read().decode("utf-8"))
        return r[0]["result"]["data"]["json"]
    except Exception as e:
        return {"error": str(e)}

# جيب series first
sd = api_call("content.getSeriesBySlug", {"slug": "solo-leveling"})
sid = sd["id"]
print(f"Series ID: {sid}")

chs = api_call("content.getChapters", {"seriesId": sid, "limit": 5})
ch = chs["chapters"][0]
cid = ch["id"]
print(f"Chapter ID: {cid}\n")

# جرب endpoints مختلفة
endpoints = [
    "content.getChapter",
    "content.getChapterContent",
    "content.getChapterBubbles",
    "content.getChapterWithBubbles",
    "reader.getChapter",
    "chapter.get",
    "chapter.getContent",
    "chapter.getPages",
    "content.getChapterPages",
]

for ep in endpoints:
    r = api_call(ep, {"chapterId": cid})
    if "error" in r:
        print(f"❌ {ep}: {r['error'][:80]}")
    else:
        keys = list(r.keys())
        print(f"✅ {ep}: keys={keys}")
        if "pages" in r:
            print(f"   pages count: {len(r['pages'])}")
            if r["pages"] and isinstance(r["pages"][0], dict):
                print(f"   first page keys: {list(r['pages'][0].keys())}")
                if "bubbles" in r["pages"][0]:
                    print(f"   🎯 فيه bubbles! {len(r['pages'][0]['bubbles'])} bubble")
                    if r["pages"][0]["bubbles"]:
                        print(f"   أول bubble: {json.dumps(r['pages'][0]['bubbles'][0], ensure_ascii=False)[:200]}")
        print()
