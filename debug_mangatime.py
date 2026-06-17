#!/usr/bin/env python3
import urllib.request, urllib.parse, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Try getting the series first
payload = {"0": {"json": {"slug": "one-piece"}}}
encoded = urllib.parse.quote(json.dumps(payload))
url = f"https://mangatime.org/api/trpc/content.getSeriesBySlug?batch=1&input={encoded}"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
resp = urllib.request.urlopen(req, timeout=15, context=ctx)
data = json.loads(resp.read().decode("utf-8"))
series = data[0]["result"]["data"]["json"]
series_id = series["id"]
print(f"Series ID: {series_id}")
print(f"Title: {series.get('title')}")

# Try different limits
for limit in [100, 500, 1000]:
    try:
        payload2 = {"0": {"json": {"seriesId": series_id, "limit": limit}}}
        encoded2 = urllib.parse.quote(json.dumps(payload2))
        url2 = f"https://mangatime.org/api/trpc/content.getChapters?batch=1&input={encoded2}"
        req2 = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
        resp2 = urllib.request.urlopen(req2, timeout=15, context=ctx)
        data2 = json.loads(resp2.read().decode("utf-8"))
        chapters = data2[0]["result"]["data"]["json"]
        ch_list = chapters.get("chapters", [])
        print(f"limit={limit}: {len(ch_list)} chapters, hasMore={chapters.get('hasMore')}")
        if ch_list:
            print(f"  First chapter number: {ch_list[0].get('number')}")
    except Exception as e:
        print(f"limit={limit}: error {e}")

# Check browse API to find One Piece
print("\nLooking for One Piece in browse...")
payload3 = {"0": {"json": {"search": "one piece", "page": 1, "limit": 10}}}
encoded3 = urllib.parse.quote(json.dumps(payload3))
url3 = f"https://mangatime.org/api/trpc/content.browse?batch=1&input={encoded3}"
req3 = urllib.request.Request(url3, headers={"User-Agent": "Mozilla/5.0"})
resp3 = urllib.request.urlopen(req3, timeout=15, context=ctx)
data3 = json.loads(resp3.read().decode("utf-8"))
browse = data3[0]["result"]["data"]["json"]
print(f"Browse results: {json.dumps(browse, ensure_ascii=False)[:1000]}")
