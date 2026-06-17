import io
import re

with io.open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'app\.js\?v=\d+\.\d+', 'app.js?v=2.9', content)
content = re.sub(r'style\.css\?v=\d+\.\d+', 'style.css?v=2.9', content)

with io.open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

with io.open('sw.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"kairo-cache-v\d+", "kairo-cache-v22", content)

with io.open('sw.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
