import io
import re

with io.open('sw.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Just replace kairo-cache-v* with kairo-cache-v18
content = re.sub(r"kairo-cache-v\d+", "kairo-cache-v18", content)

with io.open('sw.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
