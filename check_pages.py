#!/usr/bin/env python3
import sys, json, urllib.request, urllib.parse, ssl
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

def api_call(proc, params):
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

# جيب صفحة فصل من Solo Leveling (آخر فصل)
series = api_call("content.getSeriesBySlug", {"slug": "solo-leveling"})
sid = series["id"]
chs = api_call("content.getChapters", {"seriesId": sid, "limit": 5})
ch = chs["chapters"][0]  # first chapter
print(f"الفصل: {ch['number']}, id: {ch['id']}")

pages = api_call("content.getChapterPages", {"chapterId": ch["id"]})
print(f"عدد الصفحات: {len(pages.get('pages', []))}")
print(f"\nأول 5 صفحات:")
for p in pages["pages"][:5]:
    print(f"  {p}")
