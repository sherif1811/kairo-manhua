import io
import re

with io.open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

target = """    addToHistory(mangaId, chapterId, scrollY = 0, percentage = 0, pageIndex = 0) {
        this.history.unshift({"""

replacement = """    addToHistory(mangaId, chapterId, scrollY = 0, percentage = 0, pageIndex = 0) {
        // Remove existing history for this manga to avoid duplication
        this.history = this.history.filter(h => h.mangaId !== mangaId);
        this.history.unshift({"""

if target in js:
    js = js.replace(target, replacement)
    with io.open('app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("History fixed")
else:
    print("History target not found")

