#!/usr/bin/env python3
import urllib.request, urllib.parse, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Try different slug variations
slugs = ["one-piece", "one.piece", "one_piece", "ون-بيس", "one piece"]
for slug in slugs:
    try:
        payload = {"0": {"json": {"slug": slug}}}
        encoded = urllib.parse.quote(json.dumps(payload))
        url = f"https://mangatime.org/api/trpc/content.getSeriesBySlug?batch=1&input={encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        data = json.loads(resp.read().decode("utf-8"))
        series = data[0]["result"]["data"]["json"]
        print(f"Slug '{slug}': FOUND - ID={series['id']}, Title={series.get('title')}, Chapters={series.get('chapterCount', '?')}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Slug '{slug}': 404 Not Found")
        else:
            print(f"Slug '{slug}': Error {e.code}")
    except Exception as e:
        print(f"Slug '{slug}': {e}")

# Also try searching in Arabic
print("\n=== Search ون بيس ===")
try:
    payload2 = {"0": {"json": {"search": "ون بيس", "limit": 10}}}
    encoded2 = urllib.parse.quote(json.dumps(payload2))
    url2 = f"https://mangatime.org/api/trpc/content.search?batch=1&input={encoded2}"
    req2 = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
    resp2 = urllib.request.urlopen(req2, timeout=15, context=ctx)
    data2 = json.loads(resp2.read().decode("utf-8"))
    results = data2[0]["result"]["data"]["json"]["results"]
    for r in results:
        s = r["series"]
        print(f"  {s['title']} (slug={s['slug']})")
except Exception as e:
    print(f"  Error: {e}")
