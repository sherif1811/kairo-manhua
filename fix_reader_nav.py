import io
import re

with io.open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

custom_css = """
.reader-bottom-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-top: 40px;
    margin-bottom: 20px;
    padding: 20px 0;
    border-top: 1px solid rgba(255,255,255,0.05);
}
.reader-bottom-nav .reader-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 20px;
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: var(--text-main) !important;
    font-size: 0.95rem !important;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    width: auto !important;
    height: auto !important;
}
.reader-bottom-nav .reader-btn:hover:not(.disabled) {
    background: var(--color-primary) !important;
    border-color: var(--color-primary) !important;
    color: #fff !important;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px var(--color-primary-glow);
}
.reader-bottom-nav .reader-btn.disabled {
    opacity: 0.3 !important;
    cursor: not-allowed;
}
@media (max-width: 600px) {
    .reader-bottom-nav {
        flex-direction: column;
        gap: 15px;
    }
    .reader-bottom-nav .reader-btn {
        width: 100% !important;
        justify-content: center;
    }
}
"""

if ".reader-bottom-nav {" not in css:
    css += custom_css
    with io.open('style.css', 'w', encoding='utf-8') as f:
        f.write(css)

with io.open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Inject HTML into ReaderViewComponent
target_html = """        <div class="chapter-likes-interactive">
            <button class="like-chapter-btn ${isLiked ? 'liked' : ''}" id="chapter-like-btn">
                <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                <span id="like-text">${isLiked ? 'تم الإعجاب بالفصل!' : 'إعجاب'}</span>
            </button>
        </div>"""

replacement_html = """        <div class="chapter-likes-interactive">
            <button class="like-chapter-btn ${isLiked ? 'liked' : ''}" id="chapter-like-btn">
                <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                <span id="like-text">${isLiked ? 'تم الإعجاب بالفصل!' : 'إعجاب'}</span>
            </button>
        </div>
        
        <div class="reader-bottom-nav">
            <button class="reader-btn prev-chapter-btn ${chapterIndex === manga.chapters.length - 1 ? 'disabled' : ''}" title="الفصل السابق"><i class="fa-solid fa-chevron-right"></i> الفصل السابق</button>
            <button class="reader-btn return-to-manga" title="العودة لصفحة المانهوا">رجوع إلى المانهوا</button>
            <button class="reader-btn next-chapter-btn ${chapterIndex === 0 ? 'disabled' : ''}" title="الفصل التالي">الفصل التالي <i class="fa-solid fa-chevron-left"></i></button>
        </div>"""

if "reader-bottom-nav" not in js:
    js = js.replace(target_html, replacement_html)

# 2. Update listeners
# Return btns
target_return_js = """    const returnBtn = document.querySelector('.return-to-manga');
    if (returnBtn) {
        returnBtn.onclick = () => {
            returnBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري الرجوع...</span>';
            returnBtn.style.pointerEvents = 'none';
            setTimeout(() => {
                navigate('detail', state.activeMangaId);
            }, 50);
        };
    }"""
replacement_return_js = """    const returnBtns = document.querySelectorAll('.return-to-manga');
    returnBtns.forEach(btn => {
        btn.onclick = () => {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري الرجوع...</span>';
            btn.style.pointerEvents = 'none';
            setTimeout(() => {
                navigate('detail', state.activeMangaId);
            }, 50);
        };
    });"""
js = js.replace(target_return_js, replacement_return_js)

# Prev btns
target_prev_js = """    const prevBtn = document.querySelector('.prev-chapter-btn');
    if (prevBtn && !prevBtn.classList.contains('disabled')) {
        prevBtn.onclick = () => {
            const manga = state.mangas.find(m => m.id === state.activeMangaId);
            const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
            if (chapterIndex < manga.chapters.length - 1) {
                const prevChapId = manga.chapters[chapterIndex + 1].id;
                navigate('reader', state.activeMangaId, prevChapId);
            }
        };
    }"""
replacement_prev_js = """    const prevBtns = document.querySelectorAll('.prev-chapter-btn');
    prevBtns.forEach(btn => {
        if (!btn.classList.contains('disabled')) {
            btn.onclick = () => {
                const manga = state.mangas.find(m => m.id === state.activeMangaId);
                const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
                if (chapterIndex < manga.chapters.length - 1) {
                    const prevChapId = manga.chapters[chapterIndex + 1].id;
                    navigate('reader', state.activeMangaId, prevChapId);
                    window.scrollTo(0, 0);
                }
            };
        }
    });"""
js = js.replace(target_prev_js, replacement_prev_js)

# Next btns
target_next_js = """    const nextBtn = document.querySelector('.next-chapter-btn');
    if (nextBtn && !nextBtn.classList.contains('disabled')) {
        nextBtn.onclick = () => {
            const manga = state.mangas.find(m => m.id === state.activeMangaId);
            const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
            if (chapterIndex > 0) {
                const nextChapId = manga.chapters[chapterIndex - 1].id;
                navigate('reader', state.activeMangaId, nextChapId);
            }
        };
    }"""
replacement_next_js = """    const nextBtns = document.querySelectorAll('.next-chapter-btn');
    nextBtns.forEach(btn => {
        if (!btn.classList.contains('disabled')) {
            btn.onclick = () => {
                const manga = state.mangas.find(m => m.id === state.activeMangaId);
                const chapterIndex = manga.chapters.findIndex(c => normalizeChapterId(c.id) === normalizeChapterId(state.activeChapterId));
                if (chapterIndex > 0) {
                    const nextChapId = manga.chapters[chapterIndex - 1].id;
                    navigate('reader', state.activeMangaId, nextChapId);
                    window.scrollTo(0, 0);
                }
            };
        }
    });"""
js = js.replace(target_next_js, replacement_next_js)

with io.open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("done")
