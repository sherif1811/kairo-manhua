#!/usr/bin/env python3
import sys, re, urllib.request, ssl
sys.stdout.reconfigure(encoding="utf-8")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

url = "https://mangatime.org/assets/index-Dn_pgqvP.js"
req = urllib.request.Request(url, headers={"User-Agent": UA})
resp = urllib.request.urlopen(req, timeout=60, context=ctx)
js = resp.read().decode("utf-8")

# Search for procedure names related to chapter content
procs = re.findall(r'(?:content|reader|chapter|page)\.[a-zA-Z]+', js)
print("Procedure names found:")
for p in sorted(set(procs)):
    print(f"  {p}")

# Also look for the specific JSON-overlay data
bubble_refs = re.findall(r'.{0,50}bubbles.{0,50}', js)
if bubble_refs:
    print(f"\nBubble references ({len(bubble_refs)}):")
    for b in bubble_refs[:10]:
        print(f"  {b}")

# Search for "json-overlay" - what procedure returns it?
overlay_refs = re.findall(r'.{0,100}json-overlay.{0,100}', js)
if overlay_refs:
    print(f"\njson-overlay references:")
    for o in overlay_refs[:5]:
        print(f"  {o}")

# Search for getChapterPages or similar
pages_proc = re.findall(r'getChapterPages|getChapterContent|chapter\.getContent|reader\.get[^"]+', js)
print(f"\nPage-related procedures: {pages_proc}")
