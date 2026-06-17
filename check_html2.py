#!/usr/bin/env python3
import sys, json, urllib.request, urllib.parse, ssl, re
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

url = "https://mangatime.org/manhwa/solo-leveling/chapter/200"
req = urllib.request.Request(url, headers={"User-Agent": UA})
resp = urllib.request.urlopen(req, timeout=30, context=ctx)
html = resp.read().decode("utf-8")

# دور على أي JSON data في الصفحة (__NEXT_DATA__ أو __PREFETCH__)
next_data = re.search(r'__NEXT_DATA__\s*=\s*({.*?});', html, re.DOTALL)
if next_data:
    print("✅ __NEXT_DATA__ موجود")
    d = json.loads(next_data.group(1))
    # اطبع keys (باختصار)
    print(f"  keys: {list(d.keys())}")
else:
    print("❌ مفيش __NEXT_DATA__")

# دور على prefetched data
prefetch = re.search(r'__PREFETCH__\s*=\s*({.*?});', html, re.DOTALL)
if prefetch:
    print("✅ __PREFETCH__ موجود")
    d = json.loads(prefetch.group(1))
    print(f"  keys: {list(d.keys())}")
    for k, v in d.items():
        if isinstance(v, dict) and "pages" in v:
            print(f"  pages في {k}: {len(v['pages'])} صفحة")
            if v.get("pages"):
                print(f"  أول صفحة: {v['pages'][0][:100] if isinstance(v['pages'][0], str) else v['pages'][0]}")
else:
    print("❌ مفيش __PREFETCH__")

# دور على أي حاجة فيها page URL
page_urls = re.findall(r'uploads/chapter/[^"\']+', html)
if page_urls:
    print(f"\n✅ صفحه URLs في HTML: {len(page_urls)}")
    for p in page_urls[:5]:
        print(f"  {p}")

# دور على أي نصوص بالعربية
arabic = re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]{3,}', html)
if arabic:
    print(f"\n✅ نصوص عربية في الصفحة: {len(arabic)}")
    for t in arabic[:20]:
        print(f"  {t}")
