#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Usage: python add_manga.py <manga_url>

Scrapes a manga URL and adds it to scraped_mangas.json with all chapter image URLs.
Then preloads the first 5 chapters' images into cache.

Example:
    python add_manga.py https://lekmanga.site/manga/killer-pietro/
"""
import sys
import io as _io
# Force UTF-8 for console output
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = _io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
import os
import json
import time
import hashlib
import re
import threading
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
CACHE_DIR = os.path.join(BASE_DIR, "image_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

PRELOAD_SEMAPHORE = threading.Semaphore(3)
_preload_cache = {}

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def _apply_watermark(img):
    try:
        from flask_app import _apply_watermark as wm
        return wm(img)
    except Exception:
        return img

def fetch_html(url):
    r = requests.get(url, headers={'User-Agent': UA}, timeout=30)
    r.raise_for_status()
    return r.text

def preload_chapter_images(manga_id, chapter_id, quality=90):
    key = f"{manga_id}_{chapter_id}"
    if key in _preload_cache:
        return
    _preload_cache[key] = True
    if not os.path.exists(OUTPUT_FILE):
        return
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        scraped_db = json.load(f)
    manga = next((m for m in scraped_db if str(m.get('id')) == str(manga_id)), None)
    if not manga:
        return
    chapter = next((ch for ch in (manga.get('chapters') or []) if str(ch.get('id')) == str(chapter_id)), None)
    if not chapter:
        return
    images = chapter.get('images', [])
    if not images:
        return
    print(f"    تحميل صور {chapter.get('title', chapter_id)} ({len(images)} صورة)...")
    for i, url in enumerate(images):
        PRELOAD_SEMAPHORE.acquire()
        try:
            url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
            cache_path = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
            if os.path.exists(cache_path):
                print(f"      [{i+1}/{len(images)}] موجودة مسبقًا ✓")
                continue
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                img_data = resp.read()
            if PIL_AVAILABLE:
                try:
                    img = Image.open(_io.BytesIO(img_data))
                    img = _apply_watermark(img)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    img.save(cache_path, "JPEG", quality=quality)
                except Exception:
                    pass
            print(f"      [{i+1}/{len(images)}] تم ✓")
        except Exception as e:
            print(f"      [{i+1}/{len(images)}] فشل: {e}")
        finally:
            PRELOAD_SEMAPHORE.release()
            time.sleep(0.5)

def generate_id(title):
    return hashlib.md5((title + str(time.time())).encode('utf-8')).hexdigest()[:10]

def extract_num(text):
    m = re.search(r'(\d+(?:\.\d+)?)', text)
    return float(m.group(1)) if m else 0.0

# ---- Olympus scraper (direct requests, no Playwright) ----
def scrape_olympus_metadata(url):
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    title_el = soup.find("h1") or soup.find("title")
    title = title_el.text.strip() if title_el else ""
    if " - " in title:
        title = title.split(" - ")[0].strip()
    og_img = soup.select_one('meta[property="og:image"]')
    cover = og_img.get("content", "") if og_img else ""
    desc = ""
    for sel in ['meta[name="description"]', 'meta[property="og:description"]']:
        m = soup.select_one(sel)
        if m and m.get("content"):
            desc = m["content"].strip()
            if len(desc) > 20:
                break
    genres = []
    for a in soup.select('a[href*="/genre/"], a[href*="/categoria/"], a[href*="/tag/"]'):
        t = a.text.strip()
        if t and t not in genres:
            genres.append(t)
    author = ""
    author_el = soup.select_one("a[href*='/author/']")
    if author_el:
        author = author_el.text.strip()
    chapters = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/series/" in href and href.split("/")[-1].replace(".", "").isdigit():
            if href in seen:
                continue
            seen.add(href)
            num = href.split("/")[-1]
            chapters.append({"title": f"الفصل {num}", "url": urllib.parse.urljoin(url, href)})
    # Generate missing chapters
    nums = set()
    for ch in chapters:
        try:
            nums.add(int(ch["url"].rstrip("/").split("/")[-1]))
        except ValueError:
            pass
    if nums:
        for n in range(1, max(nums)):
            if n not in nums:
                chapters.append({"title": f"الفصل {n}", "url": url.rstrip("/") + "/" + str(n)})
    chapters.sort(key=lambda c: int(c["url"].rstrip("/").split("/")[-1]))
    return {"title": title, "cover_url": cover, "description": desc, "author": author, "artist": "", "genres": ", ".join(genres), "status": "Ongoing", "chapters": chapters}

def scrape_olympus_chapter_pages(chapter_url):
    html = fetch_html(chapter_url)
    soup = BeautifulSoup(html, "html.parser")
    images = []
    for img in soup.find_all("img"):
        src = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
        src = src.strip().replace(" ", "%20")
        if "uploads/manga_" in src or "images/manga/" in src:
            images.append(urllib.parse.urljoin(chapter_url, src))
    if not images:
        imgs = re.findall(r'https?://[^"\'\s]+(?:uploads/manga_|images/manga/)[^"\'\s]+', html)
        images = list(dict.fromkeys(imgs))
    return images

# ---- Madara scraper (direct requests) ----
def scrape_madara_metadata(url):
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    title_el = soup.select_one(".post-title h1") or soup.find("h1")
    title = title_el.text.strip() if title_el else ""
    if not title:
        og = soup.select_one('meta[property="og:title"]')
        title = og.get("content", "").strip() if og else ""
    cover_el = soup.select_one(".summary_image img")
    cover = ""
    if cover_el:
        cover = (cover_el.get("data-src") or cover_el.get("src") or "")
        cover = urllib.parse.urljoin(url, cover)
    if not cover:
        og_img = soup.select_one('meta[property="og:image"]')
        if og_img:
            cover = og_img.get("content", "")
    desc = ""
    desc_el = soup.select_one(".description-summary .summary__content, .summary__content")
    if desc_el:
        desc = desc_el.text.strip()
    genres_l = []
    for g in soup.select(".genres-content a"):
        genres_l.append(g.text.strip())
    author = ""
    author_el = soup.select_one(".author-content a")
    if author_el:
        author = author_el.text.strip()
    chapters = []
    for li in soup.select("li.wp-manga-chapter"):
        a = li.select_one("a")
        if a and a.get("href"):
            ch_url = a["href"].strip()
            if ch_url.startswith("#") or ch_url.startswith("javascript"):
                continue
            ch_title = a.text.strip()
            ch_title = re.sub(r'\s+', ' ', ch_title)
            chapters.append({"title": ch_title, "url": urllib.parse.urljoin(url, ch_url)})
    return {"title": title, "cover_url": cover, "description": desc, "author": author, "artist": "", "genres": ", ".join(genres_l), "status": "Ongoing", "chapters": chapters}

def scrape_madara_chapter_pages(chapter_url):
    html = fetch_html(chapter_url)
    soup = BeautifulSoup(html, "html.parser")
    images = []
    for img in soup.select(".reading-content img, .page-break img, .wp-manga-chapter-img"):
        src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
        if src and "placeholder" not in src.lower():
            images.append(urllib.parse.urljoin(chapter_url, src))
    return images

# ---- Generic scraper (fallback) ----
def scrape_generic_metadata(url):
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    title_el = soup.find("h1") or soup.find("title")
    title = title_el.text.strip() if title_el else ""
    if " - " in title:
        title = title.split(" - ")[0].strip()
    og_img = soup.select_one('meta[property="og:image"]')
    cover = og_img.get("content", "") if og_img else ""
    desc = ""
    for sel in ['meta[name="description"]', 'meta[property="og:description"]']:
        m = soup.select_one(sel)
        if m and m.get("content"):
            desc = m["content"].strip()
            if len(desc) > 20:
                break
    chapters = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.text.strip()
        if "chapter" in href.lower() or "ch-" in href.lower() or "الفصل" in text or re.search(r'(?:chapter|ch|الفصل)\s*\d', text, re.I):
            if any(x in href for x in ["tag", "category", "author"]):
                continue
            ch_title = re.sub(r'\s+', ' ', text)
            chapters.append({"title": ch_title, "url": urllib.parse.urljoin(url, href)})
    return {"title": title, "cover_url": cover, "description": desc, "author": "", "artist": "", "genres": "", "status": "Ongoing", "chapters": chapters}

def scrape_generic_chapter_pages(chapter_url):
    html = fetch_html(chapter_url)
    soup = BeautifulSoup(html, "html.parser")
    images = []
    for container_sel in [".reading-content", ".page-break", ".chapter-content", "#reader-area", ".comic-page", ".manga-page", ".entry-content"]:
        container = soup.select_one(container_sel)
        if container:
            for img in container.find_all("img"):
                src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
                if src and ".gif" not in src.lower():
                    images.append(urllib.parse.urljoin(chapter_url, src))
            if images:
                break
    if not images:
        for img in soup.find_all("img"):
            src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
            if not src:
                continue
            w = img.get("width")
            h = img.get("height")
            if w and h:
                try:
                    if int(w) < 100 or int(h) < 100:
                        continue
                except ValueError:
                    pass
            skip_kw = [".gif", "icon", "logo", "banner", "avatar", "advertisement", "sponsor", "button"]
            if any(k in src.lower() for k in skip_kw):
                continue
            images.append(urllib.parse.urljoin(chapter_url, src))
    return images

# ---- Router ----
def get_scraper_for_url(url):
    if "olympustaff" in url or "olympusstaff" in url:
        return "olympus"
    elif any(x in url for x in ["lekmanga", "lek-manga", "asuracomic", "mangaclash", "manga-starz", "3asq.org"]):
        return "madara"
    elif "mangatuk.com" in url:
        return "madara"
    else:
        return "generic"

SCRAPERS = {
    "olympus": (scrape_olympus_metadata, scrape_olympus_chapter_pages),
    "madara": (scrape_madara_metadata, scrape_madara_chapter_pages),
    "generic": (scrape_generic_metadata, scrape_generic_chapter_pages),
}

def main():
    if len(sys.argv) < 2:
        print("الاستخدام: python add_manga.py <link_manhua>")
        print("مثال: python add_manga.py https://olympustaff.com/series/ME")
        sys.exit(1)

    url = sys.argv[1].strip()
    print(f"جاري سحب المانهوا من: {url}")
    print()

    name = get_scraper_for_url(url)
    meta_fn, pages_fn = SCRAPERS[name]
    print(f"المصدر: {name}")
    print()

    meta = meta_fn(url)
    title = meta.get("title", "") or "Unknown"
    chapters_raw = meta.get("chapters", [])

    if not title or title == "Unknown":
        print("❌ فشل في العثور على عنوان المانهوا")
        sys.exit(1)

    if not chapters_raw:
        print("❌ لم يتم العثور على فصول")
        sys.exit(1)

    print(f"العنوان: {title}")
    if meta.get("genres"):
        print(f"التصنيفات: {meta['genres']}")
    print(f"الفصول: {len(chapters_raw)} فصل")
    print()

    manga_id = generate_id(title)
    chapters_sorted = sorted(chapters_raw, key=lambda c: extract_num(c["url"].rstrip("/").split("/")[-1]), reverse=True)

    chapters_out = []
    print("جاري سحب صور الفصول...")
    for idx, ch in enumerate(chapters_sorted):
        ch_num = extract_num(ch["url"].rstrip("/").split("/")[-1])
        ch_id = f"ch_{ch_num}_{idx}"
        ch_title = ch.get("title", f"Chapter {ch_num}")

        try:
            img_urls = pages_fn(ch["url"])
            if not img_urls:
                print(f"  ❌ {ch_title}: لم يتم العثور على صور")
                continue
        except Exception as e:
            print(f"  ❌ {ch_title}: فشل - {e}")
            continue

        chapters_out.append({
            "id": ch_id,
            "title": ch_title,
            "url": ch["url"],
            "date": ch.get("date", ""),
            "images": img_urls,
            "number": ch_num
        })
        print(f"  ✓ {ch_title}: {len(img_urls)} صورة")

    if not chapters_out:
        print("❌ فشل في سحب أي فصل")
        sys.exit(1)

    entry = {
        "id": manga_id,
        "title": title,
        "alternative": "",
        "status": meta.get("status", "Ongoing"),
        "cover": meta.get("cover_url", ""),
        "synopsis": meta.get("description", ""),
        "author": meta.get("author", ""),
        "artist": meta.get("artist", ""),
        "genres": meta.get("genres", ""),
        "url": url,
        "chapters": chapters_out
    }

    existing = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                existing = []

    existing = [m for m in existing if m.get("url") != url]
    existing.append(entry)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ تمت إضافة \"{title}\" بنجاح!")
    print(f"   إجمالي الفصول: {len(chapters_out)}")
    print(f"   موقع الملف: scraped_mangas.json")
    print()

    print("جاري تحميل أول 5 فصول في الخلفية (لتصفح أسرع)...")
    # Preload first 5 chapters (ascending) for new readers
    chapters_asc = sorted(chapters_out, key=lambda c: float(c.get('number', 0)))
    threads = []
    for ch in chapters_asc[:5]:
        t = threading.Thread(target=preload_chapter_images, args=(manga_id, ch["id"]), daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

    print()
    print("✨ تم الانتهاء! المانهوا جاهزة للقراءة.")
    print("   شغل السيرفر: python flask_app.py")


if __name__ == "__main__":
    main()
