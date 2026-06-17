#!/usr/bin/env python3
import sys, urllib.request, ssl
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

img_url = "https://mangatime.org/uploads/chapter/697df75c0c5d340ac1541f88/2026/04/pyafzqf9.webp"
req = urllib.request.Request(img_url, headers={
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://mangatime.org/",
})
resp = urllib.request.urlopen(req, timeout=30, context=ctx)
data = resp.read()
print(f"الحجم: {len(data)} bytes")
print(f"Content-Type: {resp.headers.get('Content-Type')}")
print(f"Content-Length: {resp.headers.get('Content-Length')}")

# احفظ الصورة عشان نشوفها
with open("test_page.webp", "wb") as f:
    f.write(data)
print("اتحفظ في: test_page.webp")
