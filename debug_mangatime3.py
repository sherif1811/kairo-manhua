#!/usr/bin/env python3
import urllib.request, urllib.parse, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Search for One Piece specifically  
print("=== Search for 'one piece' ===")
try:
    payload = {"0": {"json": {"search": "one piece", "page": 1, "limit": 50}}}
    encoded = urllib.parse.quote(json.dumps(payload))
    url = f"https://mangatime.org/api/trpc/content.search?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    data = json.loads(resp.read().decode("utf-8"))
    results = data[0]["result"]["data"]["json"]["results"]
    for r in results:
        s = r["series"]
        print(f"  {s['title']} (id={s['id']}, slug={s['slug']}, chapters={s.get('chapterCount', '?')})")
except Exception as e:
    print(f"  Error: {e}")

# Try getSeriesBySlug with known working slug from search
print("\n=== Try getSeriesBySlug: blue-lock ===")
try:
    payload2 = {"0": {"json": {"slug": "blue-lock"}}}
    encoded2 = urllib.parse.quote(json.dumps(payload2))
    url2 = f"https://mangatime.org/api/trpc/content.getSeriesBySlug?batch=1&input={encoded2}"
    req2 = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
    resp2 = urllib.request.urlopen(req2, timeout=15, context=ctx)
    data2 = json.loads(resp2.read().decode("utf-8"))
    series = data2[0]["result"]["data"]["json"]
    print(f"  ID: {series['id']}")
    
    # Now get chapters for this series
    sid = series["id"]
    payload3 = {"0": {"json": {"seriesId": sid, "limit": 10}}}
    encoded3 = urllib.parse.quote(json.dumps(payload3))
    url3 = f"https://mangatime.org/api/trpc/content.getChapters?batch=1&input={encoded3}"
    req3 = urllib.request.Request(url3, headers={"User-Agent": "Mozilla/5.0"})
    resp3 = urllib.request.urlopen(req3, timeout=15, context=ctx)
    data3 = json.loads(resp3.read().decode("utf-8"))
    chapters = data3[0]["result"]["data"]["json"]
    print(f"  Chapters: {len(chapters.get('chapters', []))}")
    if chapters.get('chapters'):
        print(f"  First: {chapters['chapters'][0]}")
        print(f"  HasMore: {chapters.get('hasMore')}")
except Exception as e:
    print(f"  Error: {e}")

# Try direct getChapters for One Piece with various options
print("\n=== Try One Piece chapters with different params ===")
op_id = "6999fdf2a3d831d3564fe9a2"
for param_name in ["seriesId", "series_id"]:
    for extra in [{}, {"sort": "NUMBER_ASC"}, {"sort": "NUMBER_DESC"}]:
        params = {param_name: op_id, "limit": 10}
        params.update(extra)
        try:
            payload4 = {"0": {"json": params}}
            encoded4 = urllib.parse.quote(json.dumps(payload4))
            url4 = f"https://mangatime.org/api/trpc/content.getChapters?batch=1&input={encoded4}"
            req4 = urllib.request.Request(url4, headers={"User-Agent": "Mozilla/5.0"})
            resp4 = urllib.request.urlopen(req4, timeout=15, context=ctx)
            data4 = json.loads(resp4.read().decode("utf-8"))
            chapters = data4[0]["result"]["data"]["json"]
            count = len(chapters.get("chapters", []))
            print(f"  {param_name} {extra}: {count} chapters, hasMore={chapters.get('hasMore')}")
        except Exception as e:
            print(f"  {param_name} {extra}: error {e}")
