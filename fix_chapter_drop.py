import io
import re

with io.open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

target = """                <div class="custom-dropdown" id="chapter-dropdown">
                    <button class="dropdown-trigger">
                        <span>الفصل ${chapter.id}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-content">
                        <div class="dropdown-search-box">
                            <input type="text" id="chapter-drop-search" placeholder="ابحث عن رقم الفصل..." autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <div class="dropdown-items-list">
                            ${manga.chapters.map(ch => {
                                const subtitle = ch.title ? (ch.title.includes(':') ? ch.title.split(':').slice(1).join(':').trim() : ch.title) : '';
                                return `
                                    <div class="dropdown-item-opt ${normalizeChapterId(ch.id) === normalizeChapterId(chapter.id) ? 'active' : ''}" data-value="${ch.id}">
                                        <span class="opt-num">الفصل ${ch.id}</span>
                                        ${subtitle ? `<span class="opt-title">${subtitle}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>"""

replacement = """                <div class="custom-dropdown" id="chapter-dropdown">
                    <button class="dropdown-trigger">
                        <span>الفصل ${String(chapter.id).replace(/^ch_/, '').replace(/_0$/, '').replace(/_/g, '.')}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-content">
                        <div class="dropdown-search-box">
                            <input type="text" id="chapter-drop-search" placeholder="ابحث عن رقم الفصل..." autocomplete="off">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <div class="dropdown-items-list">
                            ${manga.chapters.map(ch => {
                                let numClean = String(ch.id).replace(/^ch_/, '').replace(/_0$/, '').replace(/_/g, '.');
                                let subtitle = ch.title ? (ch.title.includes(':') ? ch.title.split(':').slice(1).join(':').trim() : ch.title) : '';
                                
                                // Prevent duplication if subtitle is exactly "الفصل X" or "chapter X"
                                if (subtitle.replace(/[^0-9.]/g, '') === numClean) {
                                    subtitle = '';
                                }

                                return `
                                    <div class="dropdown-item-opt ${normalizeChapterId(ch.id) === normalizeChapterId(chapter.id) ? 'active' : ''}" data-value="${ch.id}">
                                        <span class="opt-num">الفصل ${numClean}</span>
                                        ${subtitle ? `<span class="opt-title">${subtitle}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>"""

if target in js:
    js = js.replace(target, replacement)
    with io.open('app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("Replaced dropdown logic")
else:
    print("Target not found. Please verify strings.")

