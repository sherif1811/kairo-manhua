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

# Find .createCaller or .procedure or .query references that include bubbles/chapter/language
# These are likely the tRPC endpoint names
matches = re.findall(r'[a-zA-Z]+\.[a-zA-Z]+\([^)]*\)', js)
# Filter for interesting ones
interesting = [m for m in matches if any(x in m for x in ['chapter', 'page', 'bubble', 'reader', 'content', 'series'])]
print("Interesting function calls:")
for m in interesting[:30]:
    print(f"  {m[:150]}")

# Also search for the exact pattern of chapter+bubble API
# The schema definition was: d({chapterId:S,targetLang:i(),version:f().optional(),pages:E(ng)})
# Let me find where this schema is used (the procedure name)
# Search for the string "targetLang" context
target_ctx = re.findall(r'.{0,200}targetLang.{0,200}', js)
print(f"\ntargetLang context:")
for t in target_ctx[:5]:
    print(f"  {t[:300]}")
    print()
