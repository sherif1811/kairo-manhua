import urllib.request
import urllib.error

url = 'https://lekmanga.site/manga/absolute-sword-sense/'

headers_list = [
    # 1. Simple Agent
    {'User-Agent': 'Mozilla/5.0'},
    # 2. Browser Mimic
    {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://lekmanga.site/'
    },
    # 3. Simple Agent + Referer
    {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://lekmanga.site/'
    }
]

for i, headers in enumerate(headers_list):
    print(f"Testing configuration {i+1}...")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read()
        print(f" -> Configuration {i+1} SUCCEEDED! Length: {len(html)}")
        break
    except urllib.error.HTTPError as e:
        print(f" -> Configuration {i+1} failed: HTTP {e.code} {e.reason}")
    except Exception as e:
        print(f" -> Configuration {i+1} failed: {e}")
