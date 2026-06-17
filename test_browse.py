import urllib.request, urllib.parse, json, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0"

procedures = [
    "content.browse",
    "content.getBrowse",
    "content.getAllSeries", 
    "content.getSeries",
    "content.list",
    "content.browseSeries",
    "content.getBrowseSeries",
    "content.browseAll",
    "content.getMangas",
]
for proc in procedures:
    try:
        payload = {"0": {"json": {"page": 1, "limit": 5, "sort": "POPULARITY"}}}
        encoded = urllib.parse.quote(json.dumps(payload))
        url = f"https://mangatime.org/api/trpc/{proc}?batch=1&input={encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        data = json.loads(resp.read().decode("utf-8"))
        print(f"{proc}: OK")
    except urllib.error.HTTPError as e:
        print(f"{proc}: HTTP {e.code}")
    except Exception as e:
        print(f"{proc}: {type(e).__name__}")
