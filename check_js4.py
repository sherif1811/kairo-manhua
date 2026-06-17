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

# البحث عن كل الـ procedure names
# في tRPC، بيبقى فيه `trpc.` أو `api.` قبل اسم الـ procedure
# دور على pattern زي: content.X  أو chapter.X
procs = re.findall(r'(?:content|chapter|reader|bubble|page|series)\.[a-zA-Z]+\b', js)
for p in sorted(set(procs)):
    print(p)

print("\n\n=== دور على query/mutation names ===")
# دور على حاجة زي "useQuery" أو "useMutation" أو ".query("
q = re.findall(r'\.[a-z]+\([\s\S]{0,50}\bchapterId\b[\s\S]{0,50}', js)
for m in q[:20]:
    clean = re.sub(r'\s+', ' ', m)[:200]
    print(clean)
