#!/usr/bin/env python3
import sys, json, urllib.request, urllib.parse, ssl, re
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# جيب صفحة الفصل HTML
url = "https://mangatime.org/manhwa/solo-leveling/chapter/200"
req = urllib.request.Request(url, headers={"User-Agent": UA})
resp = urllib.request.urlopen(req, timeout=30, context=ctx)
html = resp.read().decode("utf-8")

# شوف إزاي النصوص بتتظبط
# دور على حاجة زي "text" أو "content" أو "page" 
sections = []
for line in html.split('\n'):
    line_lower = line.lower()
    if any(x in line_lower for x in ['reader', 'page', 'chapter-content', 'reading-content', 'text-overlay', 'image-text', 'canvas']):
        sections.append(line[:300])

print("أسطر مهمة في HTML:\n")
for s in sections[:30]:
    print(s)

print("\n\n===== البحث عن نصوص أو صور =====")
# دور على الصور
imgs = re.findall(r'<img[^>]+src="([^"]+)"', html)
print(f"صور في الصفحة: {len(imgs)}")
for img in imgs[:10]:
    print(f"  {img}")

# دور على canvas (يمكن يستخدمو canvas للنص)
canvas = re.findall(r'<canvas[^>]+', html)
print(f"\nCanvas elements: {len(canvas)}")

# دور على script tags with text rendering
scripts = re.findall(r'<script[^>]*>([^<]+)', html)
print(f"\nScript tags: {len(scripts)}")
for s in scripts[:5]:
    if len(s) < 500:
        print(f"  {s[:200]}")
