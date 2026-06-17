import urllib.request, urllib.parse, json, ssl, sys
sys.stdout.reconfigure(encoding="utf-8")
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

# Check first search page for total count
data = call("content.search", {"search": "", "page": 1, "limit": 50})
print(f"Results this page: {len(data.get('results', []))}")
print(f"Full keys: {data.keys()}")

# Check getSeriesBySlug full response for Blue Lock
series = call("content.getSeriesBySlug", {"slug": "blue-lock"})
with open("series_test.json", "w", encoding="utf-8") as f:
    json.dump(series, f, ensure_ascii=False, indent=2)
print("\nFull series data saved to series_test.json")
print(f"Keys: {series.keys()}")
print(f"Has 'genres': {'genres' in series}")
if "genres" in series:
    print(f"Genres: {series['genres']}")
if "tags" in series:
    print(f"Tags: {series['tags']}")
if "categories" in series:
    print(f"Categories: {series['categories']}")
