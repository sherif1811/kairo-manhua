#!/usr/bin/env python3
import sys, json, urllib.request, urllib.parse, ssl, re
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# جرب نجيب صفحة الفصل HTML 
url = "https://mangatime.org/manhwa/solo-leveling/chapter/200"
req = urllib.request.Request(url, headers={"User-Agent": UA})
resp = urllib.request.urlopen(req, timeout=30, context=ctx)
html = resp.read().decode("utf-8")

# دور على أي API calls في الـ JavaScript
# طريقة MangaTime غالباً بتحمل الصفحات عبر API
# دور على "getChapterPages" أو "pages" في الـ JS code
api_calls = re.findall(r'(getChapterPages|getChapters|chapterPages|pagesApi|trpc/[^"\']+)', html)
if api_calls:
    print("API calls found:")
    for a in set(api_calls):
        print(f"  {a}")
else:
    print("No API calls found in static HTML")

# دور على أي "img" أو "image" أو "url" في الـ HTML
# أو أي references للـ chapter images
page_refs = re.findall(r'(?:page|img|image|src)\s*[:=]\s*["\']([^"\']+)["\']', html)
print(f"\nPage/img references: {len(page_refs)}")
for p in page_refs[:10]:
    print(f"  {p[:150]}")

# Search for the chapter ID we know
print(f"\n\nSearching for '69ec8da0ce715c8d6e7261bb' in HTML...")
if "69ec8da0ce715c8d6e7261bb" in html:
    print("  FOUND!")
else:
    print("  Not found in static HTML")

# Check if there's any JSON-like structure with page data
json_patterns = re.findall(r'({[^}]{100,500})', html)
print(f"\nLong JSON-like patterns: {len(json_patterns)}")
