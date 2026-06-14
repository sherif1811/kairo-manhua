import os
import re
import json
import uuid
import time
import logging
import sqlite3
import shutil
import requests
import numpy as np
import cv2
from pathlib import Path
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont
from celery_app import celery_app
from image_processor import detect_chapter_language
import arabic_reshaper
from bidi.algorithm import get_display

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

TEMP_DIR = Path("temp_chapters")
DRAFT_DB = "kairo_drafts.db"
OUTPUT_DIR = Path("static/drafts")
FONTS_DIR = Path("fonts")
FONT_PATH = str(FONTS_DIR / "Almarai-Bold.ttf")
FONT_FALLBACK = "arial.ttf"
AI_API_URL = "https://api.openai.com/v1/chat/completions"
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = "gpt-4o-mini"


# ═══════════════════════════════════════════
# 1.  Fetch & download chapter images
# ═══════════════════════════════════════════
def fetch_chapter_images(source_url: str, chapter_id: str, image_urls: list[str] | None = None) -> list[str]:
    chapter_dir = TEMP_DIR / chapter_id
    chapter_dir.mkdir(parents=True, exist_ok=True)
    local_paths = []

    if image_urls:
        logger.info(f"Downloading {len(image_urls)} pre-scraped images for {chapter_id}")
        import cloudscraper
        scraper = cloudscraper.create_scraper()
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Referer": source_url}
        for i, url in enumerate(image_urls):
            try:
                resp = scraper.get(url, headers=headers, timeout=60)
                resp.raise_for_status()
                ext = ".jpg"
                for e in (".jpg", ".jpeg", ".png", ".webp", ".avif"):
                    if e in resp.headers.get("content-type", "").lower():
                        ext = e
                        break
                fname = f"page_{i+1:03d}{ext}"
                fpath = chapter_dir / fname
                fpath.write_bytes(resp.content)
                local_paths.append(str(fpath))
                logger.info(f"  Downloaded [{i+1}/{len(image_urls)}]: {fname}")
            except Exception as e:
                logger.warning(f"  Failed to download {url}: {e}")
        if not local_paths:
            raise RuntimeError("All pre-scraped image downloads failed")
        return local_paths

    logger.info(f"Fetching: {source_url} via Playwright")
    from playwright.sync_api import sync_playwright
    import requests
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        context = browser.new_context(user_agent=user_agent)
        page = context.new_page()
        try:
            from playwright_stealth import Stealth
            Stealth().apply_stealth_sync(page)
        except: pass
        
        try:
            page.goto(source_url, wait_until="domcontentloaded", timeout=60000)
            
            # Auto-scroll to trigger lazy loading
            logger.info("Scrolling down to load lazy images...")
            page.evaluate("""
                new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 300;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight - window.innerHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 250);
                });
            """)
            page.wait_for_timeout(3000)
            
            # Extract image URLs
            image_urls = page.evaluate("""
                () => {
                    const imgs = Array.from(document.querySelectorAll('.reading-content img, #readerarea img, .wp-manga-chapter-img, .page-break img'));
                    const urls = imgs.map(img => img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-setbg') || img.getAttribute('src'));
                    return urls.filter(u => u && !u.toLowerCase().includes('placeholder'));
                }
            """)
            
            # Fallback if specific selectors fail
            if not image_urls:
                image_urls = page.evaluate("""
                    () => {
                        const imgs = Array.from(document.querySelectorAll('img'));
                        return imgs.map(img => img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-setbg') || img.getAttribute('src'))
                                   .filter(u => u && u.match(/\\.(jpg|jpeg|png|webp)(\\?.*)?$/i));
                    }
                """)
                
            unique_urls = []
            skip_patterns = ["avatar", "icon", "logo", "banner", "thumb", "emoji", "sprite", "favicon"]
            for url in image_urls:
                if url:
                    url = url.strip()
                    if url.startswith('//'):
                        url = 'https:' + url
                    elif url.startswith('/'):
                        from urllib.parse import urlparse
                        parsed = urlparse(source_url)
                        url = f"{parsed.scheme}://{parsed.netloc}{url}"
                    url_lower = url.lower()
                    if not any(p in url_lower for p in skip_patterns) and url not in unique_urls:
                        unique_urls.append(url)
                        
            if not unique_urls:
                raise RuntimeError("No chapter images found after scrolling")
                
            # Download images using Playwright context cookies to bypass 403
            cookies = context.cookies()
            cookie_dict = {c.get('name', ''): c.get('value', '') for c in cookies}
            headers = {"User-Agent": user_agent, "Referer": source_url}
            
            for i, url in enumerate(unique_urls):
                try:
                    img_resp = requests.get(url, headers=headers, cookies=cookie_dict, timeout=60)
                    img_resp.raise_for_status()
                    
                    from urllib.parse import urlparse
                    import os
                    parsed = urlparse(url)
                    ext = os.path.splitext(parsed.path)[1] or ".jpg"
                    if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
                        ext = ".jpg"
                    fname = f"page_{i+1:03d}{ext}"
                    fpath = chapter_dir / fname
                    fpath.write_bytes(img_resp.content)
                    local_paths.append(str(fpath))
                    logger.info(f"  Downloaded [{i+1}/{len(unique_urls)}]: {fname}")
                except Exception as e:
                    logger.warning(f"  Failed to download {url}: {e}")
                    
        finally:
            browser.close()
            
    if not local_paths:
        raise RuntimeError("All image downloads failed")
        
    return local_paths


# ═══════════════════════════════════════════
# 2.  OCR text extraction (PaddleOCR)
# ═══════════════════════════════════════════
_ocr_instance = None

def get_ocr():
    global _ocr_instance
    if _ocr_instance is None:
        from paddleocr import PaddleOCR
        logger.info("Loading PaddleOCR ...")
        _ocr_instance = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr_instance


def extract_text_regions(image_path: str):
    ocr = get_ocr()
    img = cv2.imread(image_path)
    if img is None:
        return []
    result = ocr.ocr(img, cls=False)
    regions = []
    if result and result[0]:
        for line in result[0]:
            pts = line[0]
            text, conf = line[1]
            if conf < 0.4:
                continue
            regions.append((pts, text.strip(), conf))
    return regions


# ═══════════════════════════════════════════
# 3.  Inpaint — erase original text from image
# ═══════════════════════════════════════════
def inpaint_text_regions(image_path: str, regions: list) -> np.ndarray:
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Cannot read: {image_path}")

    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    for pts, text, conf in regions:
        pts = np.array(pts, dtype=np.int32)
        padding = 4
        pts[:, 0] = np.clip(pts[:, 0] - padding, 0, w)
        pts[:, 1] = np.clip(pts[:, 1] - padding, 0, h)
        cv2.fillPoly(mask, [pts], 255)

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    inpainted = cv2.inpaint(img, mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
    return inpainted


# ═══════════════════════════════════════════
# 4.  AI translation (English → Egyptian Arabic)
# ═══════════════════════════════════════════
def translate_texts(texts: list[str]) -> list[str]:
    if not texts:
        return []

    prompt = (
        "You are a manga / manhwa translator. Translate the following English dialogue "
        "lines into **Egyptian colloquial Arabic (عامية مصرية)** exactly as a native speaker "
        "would say it in a comic. Keep the tone natural, expressive, and suitable for speech "
        "bubbles. Return only a JSON array of strings, nothing else.\n\n"
        f"Texts:\n{json.dumps(texts, ensure_ascii=False)}"
    )

    try:
        resp = requests.post(
            AI_API_URL,
            headers={
                "Authorization": f"Bearer {AI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 4096
            },
            timeout=60
        )
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("API response missing 'choices'")
        msg = choices[0].get("message", {})
        content = msg.get("content", "").strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("\n", 1)[0]
            if content.startswith("json"):
                content = content[4:].strip()
        translations = json.loads(content)
        if not isinstance(translations, list):
            raise ValueError("Response is not a list")
        return translations
    except Exception as e:
        logger.error(f"Translation API call failed: {e}")
        return texts


# ═══════════════════════════════════════════
# 5.  RTL Typesetting
# ═══════════════════════════════════════════
def _load_font(size=28):
    if os.path.exists(FONT_PATH):
        return ImageFont.truetype(FONT_PATH, size)
    try:
        return ImageFont.truetype(FONT_FALLBACK, size)
    except Exception:
        return ImageFont.load_default()


def reshape_arabic(text: str) -> str:
    reshaped = arabic_reshaper.reshape(text)
    return get_display(reshaped)


def typeset_bubble(image: Image.Image, bubble_pts, text: str, font_size=28):
    draw = ImageDraw.Draw(image)
    font = _load_font(font_size)
    reshaped = reshape_arabic(text)

    xs = [p[0] for p in bubble_pts]
    ys = [p[1] for p in bubble_pts]
    bx_min, bx_max = int(min(xs)), int(max(xs))
    by_min, by_max = int(min(ys)), int(max(ys))
    box_w = bx_max - bx_min
    box_h = by_max - by_min

    if box_w < 30 or box_h < 20:
        return

    max_text_w = box_w - 16
    words = reshaped.split()
    lines = []
    current_line = ""
    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        tw = bbox[2] - bbox[0]
        if tw > max_text_w and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test_line
    if current_line:
        lines.append(current_line)

    if not lines:
        return

    line_heights = []
    total_h = 0
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lh = bbox[3] - bbox[1]
        line_heights.append(lh)
        total_h += lh + 4
    total_h -= 4

    text_y = by_min + (box_h - total_h) // 2
    if text_y < by_min + 4:
        text_y = by_min + 4

    for idx, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        lh = line_heights[idx]
        text_x = bx_max - lw - 8
        if text_x < bx_min + 4:
            text_x = bx_min + 4

        draw.text((text_x+1, text_y+1), line, font=font, fill=(0, 0, 0, 200))
        draw.text((text_x, text_y), line, font=font, fill=(255, 255, 255, 240))
        text_y += lh + 4


def estimate_font_size(box_w: int, box_h: int, text: str) -> int:
    length = len(text)
    area = box_w * box_h
    if length == 0:
        return 24
    size = int((area / (length * 40)) ** 0.5 * 3)
    return max(16, min(size, 48))


# ═══════════════════════════════════════════
# 6.  Translate + typeset single image
# ═══════════════════════════════════════════
def translate_and_typeset_single(image_path: str, output_path: str, regions: list, translations: list[str]):
    img_array = inpaint_text_regions(image_path, regions)
    img = Image.fromarray(cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB))

    for (pts, original_text, conf), tl in zip(regions, translations):
        if not tl.strip():
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        box_w = int(max(xs) - min(xs))
        box_h = int(max(ys) - min(ys))
        fs = estimate_font_size(box_w, box_h, tl)
        typeset_bubble(img, pts, tl, font_size=fs)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, quality=92)


# ═══════════════════════════════════════════
# 7.  Batch translate & typeset
# ═══════════════════════════════════════════
def translate_and_typeset(images: list[str]) -> list[str]:
    output_dir = TEMP_DIR / f"{Path(images[0]).parent.name}_translated"
    output_dir.mkdir(parents=True, exist_ok=True)
    result_paths = []

    all_regions = []
    all_texts = []
    for img_path in images:
        regions = extract_text_regions(img_path)
        all_regions.append(regions)
        for pts, text, conf in regions:
            if text.strip():
                all_texts.append(text)

    if not all_texts:
        logger.info("No text found in any page — copying originals")
        for img_path in images:
            out = str(output_dir / Path(img_path).name)
            Image.open(img_path).save(out, quality=92)
            result_paths.append(out)
        return result_paths

    logger.info(f"Translating {len(all_texts)} text segments via AI...")
    translations = translate_texts(all_texts)

    text_idx = 0
    for page_idx, img_path in enumerate(images):
        regions = all_regions[page_idx]
        page_translations = []
        for pts, text, conf in regions:
            if text.strip() and text_idx < len(translations):
                page_translations.append(translations[text_idx])
                text_idx += 1
            else:
                page_translations.append("")

        out = str(output_dir / Path(img_path).name)
        if regions:
            translate_and_typeset_single(img_path, out, regions, page_translations)
        else:
            Image.open(img_path).save(out, quality=92)
        result_paths.append(out)

    return result_paths


# ═══════════════════════════════════════════
# 8.  Kairo Manhwa watermark
# ═══════════════════════════════════════════
def apply_kairo_watermark(images: list[str]) -> list[str]:
    output_dir = TEMP_DIR / f"{Path(images[0]).parent.name}_final"
    output_dir.mkdir(parents=True, exist_ok=True)
    result_paths = []

    for img_path in images:
        img = Image.open(img_path).convert("RGBA")
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        brand_text = "KAIRO Manhwa"
        font_size = max(14, int(img.width * 0.025))
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), brand_text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]

        margin = 16
        x = img.width - tw - margin
        y = img.height - th - margin

        draw.text((x+1, y+1), brand_text, font=font, fill=(255, 255, 255, 40))
        draw.text((x, y), brand_text, font=font, fill=(255, 255, 255, 70))

        watermarked = Image.alpha_composite(img, overlay).convert("RGB")
        out = str(output_dir / Path(img_path).name)
        watermarked.save(out, quality=90)
        result_paths.append(out)

    return result_paths


# ═══════════════════════════════════════════
# 9.  Draft DB operations
# ═══════════════════════════════════════════
def init_drafts_db():
    conn = sqlite3.connect(DRAFT_DB)
    try:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS chapter_drafts (
                id TEXT PRIMARY KEY,
                manga_id TEXT NOT NULL,
                chapter_id TEXT NOT NULL,
                source_url TEXT,
                status TEXT DEFAULT 'draft',
                images TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS task_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT,
                manga_id TEXT,
                chapter_id TEXT,
                status TEXT,
                result TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
    finally:
        conn.close()


def save_draft(manga_id: str, chapter_id: str, source_url: str,
               images: list[str], status: str = "draft") -> dict:
    init_drafts_db()
    conn = sqlite3.connect(DRAFT_DB)
    conn.row_factory = sqlite3.Row
    try:
        c = conn.cursor()
        draft_id = str(uuid.uuid4())[:8]
        c.execute(
            "INSERT INTO chapter_drafts (id, manga_id, chapter_id, source_url, status, images) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (draft_id, manga_id, chapter_id, source_url, status, json.dumps(images))
        )
        conn.commit()
        logger.info(f"Draft saved: {draft_id} ({manga_id}/{chapter_id})")
        return {"draft_id": draft_id, "manga_id": manga_id, "chapter_id": chapter_id, "status": status}
    finally:
        conn.close()


def update_draft_status(draft_id: str, status: str, images: list[str] | None = None):
    conn = sqlite3.connect(DRAFT_DB)
    try:
        c = conn.cursor()
        if images:
            c.execute("UPDATE chapter_drafts SET status=?, images=? WHERE id=?",
                      (status, json.dumps(images), draft_id))
        else:
            c.execute("UPDATE chapter_drafts SET status=? WHERE id=?", (status, draft_id))
        conn.commit()
    finally:
        conn.close()


def log_task(task_id: str, manga_id: str, chapter_id: str, status: str, result: str = ""):
    init_drafts_db()
    conn = sqlite3.connect(DRAFT_DB)
    try:
        c = conn.cursor()
        c.execute(
            "INSERT INTO task_log (task_id, manga_id, chapter_id, status, result) "
            "VALUES (?, ?, ?, ?, ?)",
            (task_id, manga_id, chapter_id, status, result)
        )
        conn.commit()
    finally:
        conn.close()


# ═══════════════════════════════════════════
# 10.  Main Celery Task
# ═══════════════════════════════════════════
@celery_app.task(bind=True, name="process_chapter", max_retries=5, default_retry_delay=30)
def process_chapter(self, manga_id: str, chapter_id: str, source_url: str, image_urls: list[str] | None = None):
    task_id = self.request.id
    logger.info(f"[{task_id}] === Started: {manga_id}/{chapter_id} ===")

    try:
        self.update_state(state="FETCHING", meta={"progress": 5})
        raw_images = fetch_chapter_images(source_url, chapter_id, image_urls=image_urls)

        self.update_state(state="CLEANING", meta={"progress": 20})
        clean_dir = TEMP_DIR / f"{chapter_id}_clean"
        clean_dir.mkdir(parents=True, exist_ok=True)
        clean_images = []
        for img_path in raw_images:
            out = str(clean_dir / Path(img_path).name)
            import shutil
            shutil.copy(img_path, out)
            clean_images.append(out)

        self.update_state(state="DETECTING_LANG", meta={"progress": 40})
        lang = detect_chapter_language(clean_images, sample_count=5)

        self.update_state(state="TRANSLATING", meta={"progress": 55})
        if lang == "ar":
            translated_images = clean_images
        else:
            translated_images = translate_and_typeset(clean_images)

        self.update_state(state="WATERMARKING", meta={"progress": 80})
        watermarked = apply_kairo_watermark(translated_images)

        self.update_state(state="SAVING", meta={"progress": 90})
        draft_dir = OUTPUT_DIR / manga_id / chapter_id
        draft_dir.mkdir(parents=True, exist_ok=True)
        final_paths = []
        for src in watermarked:
            dst = draft_dir / Path(src).name
            shutil.move(src, str(dst))
            final_paths.append(str(dst.resolve()))

        draft = save_draft(manga_id, chapter_id, source_url, final_paths, status="draft")

        self.update_state(state="CLEANUP", meta={"progress": 98})
        for d in [TEMP_DIR / chapter_id, clean_dir,
                  TEMP_DIR / f"{chapter_id}_translated",
                  TEMP_DIR / f"{chapter_id}_final"]:
            shutil.rmtree(d, ignore_errors=True)

        log_task(task_id, manga_id, chapter_id, "success",
                 json.dumps({"draft_id": draft["draft_id"], "pages": len(final_paths), "language": lang}))
                 
        try:
            import sqlite3
            conn = sqlite3.connect("kairo.db")
            conn.execute("UPDATE chapters SET status='completed', translated=1 WHERE id=? AND manga_id=?", (chapter_id, manga_id))
            conn.commit()
            conn.close()
        except Exception as dbe:
            logger.error(f"DB Update failed: {dbe}")

        return {
            "status": "success",
            "draft": draft,
            "language": lang,
            "total_pages": len(final_paths),
            "task_id": task_id
        }

    except Exception as e:
        logger.exception(f"[{task_id}] === FAILED: {e} ===")
        import logging
        fetch_error_logger = logging.getLogger("fetch_errors")
        if not fetch_error_logger.handlers:
            fh = logging.FileHandler("fetch_errors.log", encoding="utf-8")
            fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
            fetch_error_logger.addHandler(fh)
            fetch_error_logger.setLevel(logging.ERROR)
        
        fetch_error_logger.error(f"Error fetching {source_url} (Manga: {manga_id}, Chapter: {chapter_id}): {e}")
        
        # Update DB to failed if max retries
        if self.request.retries >= self.max_retries:
            try:
                import sqlite3
                conn = sqlite3.connect("kairo.db")
                conn.execute("UPDATE chapters SET status='failed' WHERE id=? AND manga_id=?", (chapter_id, manga_id))
                conn.commit()
                conn.close()
            except: pass
            log_task(task_id, manga_id, chapter_id, "error", str(e))
            return {"status": "error", "error": str(e), "task_id": task_id}
            
        countdown = (2 ** self.request.retries) * 30
        logger.info(f"Retrying in {countdown}s...")
        raise self.retry(exc=e, countdown=countdown)


# ═══════════════════════════════════════════
# 11.  Periodic: check for new chapters
# ═══════════════════════════════════════════
@celery_app.task(name="check_new_chapters")
def check_new_chapters():
    """Periodic task (every 3h): check source_url for new chapters, trigger process_chapter"""

    manga_json_path = "scraped_mangas.json"
    if not os.path.exists(manga_json_path):
        logger.warning("check_new_chapters: scraped_mangas.json not found")
        return {"status": "skipped", "reason": "no catalog"}

    try:
        with open(manga_json_path, "r", encoding="utf-8") as f:
            mangas = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"check_new_chapters: failed to read catalog: {e}")
        return {"status": "error", "reason": str(e)}

    if not isinstance(mangas, list):
        mangas = [mangas]

    from scrapers.factory import get_scraper

    total_new = 0
    new_details = []
    errors = []
    manga_updated = False

    for manga in mangas:
        manga_id = manga.get("id", "")
        title = manga.get("title", "")
        source_url = manga.get("source_url", "")

        if not source_url:
            continue

        try:
            from scrapers.factory import get_scraper
            scraper = get_scraper(source_url)
            result = scraper.scrape_metadata(source_url)
            if "error" in result:
                logger.warning("[%s] Scrape error: %s", title, result["error"])
                errors.append({"manga": title, "error": result["error"]})
                continue

            current_chapters = result.get("chapters", [])
            existing = manga.get("chapters", [])

            existing_urls = {ch.get("url", "") for ch in existing}

            new_chs = []
            for ch in current_chapters:
                ch_url = ch.get("url", "")
                ch_title = ch.get("title", "")
                if ch_url and ch_url not in existing_urls:
                    ch_id = str(uuid.uuid4())[:8]
                    entry = {
                        "id": ch_id,
                        "title": ch_title,
                        "url": ch_url,
                        "date": time.strftime("%Y-%m-%d"),
                        "images": [],
                    }
                    existing.append(entry)
                    existing_urls.add(ch_url)
                    new_chs.append(entry)

            if new_chs:
                manga["chapters"] = existing
                manga_updated = True
                logger.info("[%s] Found %d new chapter(s)", title, len(new_chs))
                for ch in new_chs:
                    logger.info("  -> %s (%s)", ch["title"], ch["url"])
                    process_chapter.delay(manga_id, ch["id"], ch["url"])
                total_new += len(new_chs)
                new_details.append({
                    "manga": title,
                    "manga_id": manga_id,
                    "chapters": [{"id": c["id"], "title": c["title"]} for c in new_chs],
                })
        except Exception as e:
            logger.exception("[%s] Unexpected error: %s", title, e)
            errors.append({"manga": title, "error": str(e)})

    if manga_updated:
        try:
            with open(manga_json_path, "w", encoding="utf-8") as f:
                json.dump(mangas, f, ensure_ascii=False, indent=2)
        except IOError as e:
            logger.error("Failed to save catalog: %s", e)

    if total_new > 0 or errors:
        msg_parts = []
        if total_new > 0:
            msg_parts.append("تم اكتشاف %d فصول جديدة:" % total_new)
            for d in new_details:
                ch_list = ", ".join(c["title"] for c in d["chapters"])
                msg_parts.append("- %s: %s" % (d["manga"], ch_list))
        if errors:
            msg_parts.append("أخطاء في %d مانجا:" % len(errors))
            for e in errors:
                msg_parts.append("- %s: %s" % (e["manga"], e["error"]))
        message = "\n".join(msg_parts)

        try:
            conn = sqlite3.connect("kairo.db")
            c = conn.cursor()
            c.execute(
                "INSERT INTO notifications (email, type, title, message, manga_id, chapter_id, is_read, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
                ("admin@kairo.com", "admin", "فصول جديدة مكتشفة", message, "", "", time.time()),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning("Failed to create notification: %s", e)

    return {
        "status": "completed",
        "total_new": total_new,
        "details": new_details,
        "errors": errors,
    }


# ═══════════════════════════════════════════
# 12.  Full Manga Automated Download
# ═══════════════════════════════════════════
@celery_app.task(bind=True, name="download_full_manga", max_retries=5)
def download_full_manga(self, source_url: str):
    task_id = self.request.id
    logger.info(f"[{task_id}] === Started Full Manga Download: {source_url} ===")

    try:
        from scrapers.importer import _generate_manga_id, import_manga_from_url
        
        # Initialize manga in DB/json and get metadata
        # import_manga_from_url with scrape_images=False registers it.
        import_result = import_manga_from_url(source_url, scrape_images=False)
        if "error" in import_result:
            logger.error(f"[{task_id}] Import error: {import_result['error']}")
            return {"status": "error", "error": import_result["error"]}
            
        manga_id = import_result.get("manga_id") or _generate_manga_id(source_url, import_result.get("title", ""))
        title = import_result.get("title", "")
        chapters = import_result.get("chapters", [])
        
        if not chapters:
            logger.warning(f"[{task_id}] No chapters found for {source_url}")
            return {"status": "error", "error": "No chapters found"}

        logger.info(f"[{task_id}] Found {len(chapters)} chapters. Scheduling with 120s fixed delay between each.")
        
        scheduled_count = 0
        for index, ch in enumerate(chapters):
            ch_url = ch.get("url")
            ch_id = str(ch.get("id") or uuid.uuid4().hex[:8])
            if not ch_url:
                continue
            
            try:
                # 120 seconds fixed delay between chapters (incremental countdown)
                delay_seconds = index * 120
                process_chapter.apply_async(
                    args=[manga_id, ch_id, ch_url], 
                    countdown=delay_seconds
                )
                scheduled_count += 1
            except Exception as ex:
                logger.error(f"[{task_id}] Failed to schedule chapter {ch_url}: {ex}")
                
        logger.info(f"[{task_id}] Successfully scheduled {scheduled_count} chapters.")
        return {
            "status": "success",
            "manga_id": manga_id,
            "title": title,
            "scheduled_chapters": scheduled_count
        }

    except Exception as e:
        logger.exception(f"[{task_id}] === FULL DOWNLOAD FAILED: {e} ===")
        return {"status": "error", "error": str(e)}

