import urllib.request
import http.cookiejar

url_home = 'https://lekmanga.site/'
url_manga = 'https://lekmanga.site/manga/absolute-sword-sense/'

# Create a cookie jar
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Setup headers
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
}

try:
    print("1. Fetching homepage to set cookies...")
    req_home = urllib.request.Request(url_home, headers=headers)
    with opener.open(req_home, timeout=10) as res:
        res.read()
    
    print("Cookies set:")
    for cookie in cj:
        print(f" - {cookie.name}: {cookie.value}")

    print("\n2. Fetching manga page with cookies...")
    req_manga = urllib.request.Request(url_manga, headers=headers)
    with opener.open(req_manga, timeout=10) as res:
        html = res.read()
    print(f" -> SUCCESS! Page size: {len(html)}")
except Exception as e:
    print("Failed:", e)
