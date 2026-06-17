import urllib.request, urllib.parse, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

def call(proc, params):
    payload = json.dumps({"0": {"json": params}})
    encoded = urllib.parse.quote(payload)
    url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    return json.loads(resp.read().decode("utf-8"))[0]["result"]["data"]["json"]

# Get full search result structure
data = call("content.search", {"search": "", "limit": 3})
result = data["results"][0]
print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])

# Also try getSeriesBySlug for a known manga to see genres
print("\n\n=== Series details ===")
series = call("content.getSeriesBySlug", {"slug": "blue-lock"})
print(json.dumps(series, ensure_ascii=False, indent=2)[:2000])
