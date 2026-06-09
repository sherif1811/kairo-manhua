import urllib.request
import urllib.error

urls = [
    'https://lekmanga.site/feed/',
    'https://lekmanga.site/manga/feed/',
    'https://lekmanga.site/manga/absolute-sword-sense/feed/'
]

headers = {'User-Agent': 'Mozilla/5.0'}

for url in urls:
    print(f"Testing RSS Feed: {url}")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            xml = res.read()
        print(f" -> SUCCESS! Feed size: {len(xml)}")
        print(xml[:300].decode('utf-8', errors='ignore'))
    except urllib.error.HTTPError as e:
        print(f" -> Failed: HTTP {e.code} {e.reason}")
    except Exception as e:
        print(f" -> Failed: {e}")
