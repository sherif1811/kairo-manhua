#!/usr/bin/env python3
"""اختبار الصور بدون ومع Referer"""
import sys, urllib.request, ssl
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

img_url = "https://mangatime.org/uploads/chapter/697df75c0c5d340ac1541f88/2026/04/pyafzqf9.webp"

print("1. بدون Referer:")
req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
resp = urllib.request.urlopen(req, timeout=15, context=ctx)
data1 = resp.read()
print(f"   حجم: {len(data1)} bytes")
print(f"   Content-Type: {resp.headers.get('Content-Type')}")
with open("page_no_ref.webp", "wb") as f: f.write(data1)

print("\n2. مع Referer = mangatime.org:")
req2 = urllib.request.Request(img_url, headers={
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://mangatime.org/manhwa/solo-leveling/chapter/200"
})
resp2 = urllib.request.urlopen(req2, timeout=15, context=ctx)
data2 = resp2.read()
print(f"   حجم: {len(data2)} bytes")
print(f"   Content-Type: {resp2.headers.get('Content-Type')}")
with open("page_with_ref.webp", "wb") as f: f.write(data2)

print("\n3. مقارنة:")
if data1 == data2:
    print("   نفس الحجم — مفيش hotlink protection")
else:
    print(f"   مختلف! بدون referer: {len(data1)}, مع referer: {len(data2)}")
    print(f"   الفرق: {abs(len(data1) - len(data2))} bytes")

print("\n4. جرب صفحة HTML بتاع الفصل")
ch_url = "https://mangatime.org/manhwa/solo-leveling/chapter/200"
for ref in [None, "https://mangatime.org/"]:
    h = {"User-Agent": "Mozilla/5.0"}
    if ref: h["Referer"] = ref
    req3 = urllib.request.Request(ch_url, headers=h)
    resp3 = urllib.request.urlopen(req3, timeout=15, context=ctx)
    html = resp3.read().decode("utf-8")
    print(f"   Referer={ref}: {len(html)} bytes — {'reader' if 'reader' in html.lower() else 'no reader'}")
