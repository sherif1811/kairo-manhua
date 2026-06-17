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

# Try empty search
try:
    data = call("content.search", {"search": "", "limit": 50})
    print(f"Empty search: {len(data.get('results', []))} results")
except Exception as e:
    print(f"Empty search error: {e}")

# Try with a dot or space
try:
    data = call("content.search", {"search": "a", "limit": 50})
    n = len(data.get("results", []))
    print(f"Search 'a': {n} results")
    if n > 0:
        s = data["results"][0]["series"]
        print(f"  First: {s['title']} - genres={s.get('genres', [])}")
except Exception as e:
    print(f"Error: {e}")

# Try with 'ال' 
try:
    data = call("content.search", {"search": "ال", "limit": 50})
    print(f"Search 'ال': {len(data.get('results', []))} results")
except Exception as e:
    print(f"Error: {e}")

# Also try to get ALL by searching common word
for term in ["manhwa", "manga", "the", "king"]:
    try:
        data = call("content.search", {"search": term, "limit": 50})
        n = len(data.get("results", []))
        print(f"Search '{term}': {n} results")
        if n > 0:
            s = data["results"][0]["series"]
            genres = [g.get("name", str(g)) if isinstance(g, dict) else str(g) for g in s.get("genres", [])]
            print(f"  First: {s['title']} ({', '.join(genres)})")
    except Exception as e:
        print(f"Error: {e}")
