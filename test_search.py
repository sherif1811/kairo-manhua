import re
with open('app.js', 'r', encoding='utf-8') as f: content = f.read()
with open('test_out25.txt', 'w', encoding='utf-8') as out:
    for m in re.finditer(r'.{0,30}نر.{0,30}', content):
        out.write(repr(m.group(0)) + '\n')
