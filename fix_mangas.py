import io
import re

with io.open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update loadMangas
target_load = """        this.mangas = this.mangas.map(manga => normalizeMangaAssets(manga));
        this.saveMangas();
    }"""

replacement_load = """        this.mangas = this.mangas.map(manga => normalizeMangaAssets(manga));
        // Strict Blacklist Filter
        if (this.deletedIds && this.deletedIds.size > 0) {
            this.mangas = this.mangas.filter(m => !this.deletedIds.has(m.id));
        }
        this.saveMangas();
    }"""
content = content.replace(target_load, replacement_load)

# 2. Remove other default mangas
# Find the start of the second manga:
start_pattern = r',\s*\{\s*id:\s*"2",'
# Find the end of the array:
end_pattern = r'\s*\}\s*\];'

start_idx = re.search(start_pattern, content).start()
end_idx = re.search(end_pattern, content).end()

content = content[:start_idx] + "\n];" + content[end_idx:]

with io.open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
