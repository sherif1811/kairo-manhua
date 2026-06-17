#!/usr/bin/env python3
import sys, re, urllib.request, ssl
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# Download JS bundle
url = "https://mangatime.org/assets/index-Dn_pgqvP.js"
req = urllib.request.Request(url, headers={"User-Agent": UA})
resp = urllib.request.urlopen(req, timeout=60, context=ctx)
js = resp.read().decode("utf-8")
print(f"JS bundle size: {len(js)} bytes")

# Search for text-rendering related code
patterns = [
    "text-overlay", "textLayer", "overlay", "textCanvas",
    "bubble", "speech", "dialogue", "ترجمة", "translate",
    "font", "Arabic", "arabic", "position", 
    "getChapterPages", "pages", "chapterContent"
]

for p in patterns:
    matches = re.findall(r'.{0,100}' + re.escape(p) + r'.{0,100}', js, re.IGNORECASE)
    if matches:
        print(f"\n--- {p} ({len(matches)} matches) ---")
        for m in matches[:3]:
            print(m[:200])
            print()
