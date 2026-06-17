#!/usr/bin/env python3
import urllib.request, urllib.parse, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Try search
print("=== Search ===")
try:
    payload = {"0": {"json": {"search": "one piece", "page": 1, "limit": 10}}}
    encoded = urllib.parse.quote(json.dumps(payload))
    url = f"https://mangatime.org/api/trpc/content.search?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    data = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(data, ensure_ascii=False)[:2000])
except Exception as e:
    print(f"Search error: {e}")

# Try browse without search
print("\n=== Browse (all) ===")
try:
    payload2 = {"0": {"json": {"page": 1, "limit": 20, "sort": "POPULARITY"}}}
    encoded2 = urllib.parse.quote(json.dumps(payload2))
    url2 = f"https://mangatime.org/api/trpc/content.browse?batch=1&input={encoded2}"
    req2 = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
    resp2 = urllib.request.urlopen(req2, timeout=15, context=ctx)
    data2 = json.loads(resp2.read().decode("utf-8"))
    print(json.dumps(data2, ensure_ascii=False)[:2000])
except Exception as e:
    print(f"Browse error: {e}")
