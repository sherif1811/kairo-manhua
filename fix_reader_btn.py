import io
import re

with io.open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Modify reader-nav return button styles
target_css = """.reader-nav .reader-btn:not(.return-to-manga) {
    width: 38px;
    height: 38px;
    border-radius: 50%;"""

replacement_css = """.reader-nav .reader-btn:not(.return-to-manga) {
    width: 38px;
    height: 38px;
    border-radius: 50%;"""

if target_css in css:
    css = css.replace(target_css, replacement_css)

# Add custom styling for the return button
custom_return_css = """
.reader-nav .return-to-manga {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 8px 16px;
    color: var(--text-main);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}
.reader-nav .return-to-manga:hover {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
    box-shadow: 0 0 10px var(--color-primary-glow);
    transform: translateY(-2px);
}
"""
if ".reader-nav .return-to-manga {" not in css:
    css += custom_return_css

with io.open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

with io.open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Update button HTML in renderReaderView
target_html = """<button class="reader-btn return-to-manga" title="العودة لصفحة المانهوا"><i class="fa-solid fa-arrow-right"></i></button>"""
replacement_html = """<button class="reader-btn return-to-manga" title="العودة لصفحة المانهوا"><i class="fa-solid fa-arrow-right"></i> <span>رجوع إلى المانهوا</span></button>"""
js = js.replace(target_html, replacement_html)

# 2. Update onclick logic to show loading spinner
target_js_click = """        returnBtn.onclick = () => {
            navigate('detail', state.activeMangaId);
        };"""

replacement_js_click = """        returnBtn.onclick = () => {
            returnBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري الرجوع...</span>';
            returnBtn.style.pointerEvents = 'none';
            setTimeout(() => {
                navigate('detail', state.activeMangaId);
            }, 50);
        };"""

js = js.replace(target_js_click, replacement_js_click)

with io.open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("done")
