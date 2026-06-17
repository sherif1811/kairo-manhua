import re
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('geetmark.html', 'r', encoding='utf-8') as f:
    html = f.read()
for match in re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', html):
    if 'helmut' in match[0] and '?????' in match[1]:
        print(match[1].strip(), match[0])
