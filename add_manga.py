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

    detail_file = os.path.join(BASE_DIR, "mangas_data", f"{manga_id}.json")
    if not os.path.exists(detail_file):
        return
    with open(detail_file, "r", encoding="utf-8") as f:
        manga = json.load(f)

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

def main():
    if len(sys.argv) < 2:
        print("الاستخدام: python add_manga.py <link_manhua>")
        print("مثال: python add_manga.py https://olympustaff.com/series/ME")
        sys.exit(1)

    url = sys.argv[1].strip()
    print(f"جاري سحب المانهوا من: {url}")
    print()

    from scrapers.factory import get_scraper
    scraper = get_scraper(url)
    print(f"المصدر: {scraper.__class__.__name__}")
    print()

    meta = scraper.scrape_metadata(url)
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
            img_urls = scraper.scrape_chapter_pages(ch["url"])
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

    genres_raw = meta.get("genres", [])
    if isinstance(genres_raw, str):
        genres_list = [g.strip() for g in genres_raw.split(',') if g.strip()]
    else:
        genres_list = genres_raw
        
    entry = {
        "id": manga_id,
        "title": title,
        "alternative": "",
        "status": meta.get("status", "Ongoing"),
        "cover": meta.get("cover_url", "") or meta.get("cover", ""),
        "synopsis": meta.get("description", ""),
        "author": meta.get("author", ""),
        "artist": meta.get("artist", ""),
        "genres": genres_list,
        "url": url,
        "chapters": chapters_out
    }


    # Smart Database Splitting:
    # 1. Save full detailed data to mangas_data/<manga_id>.json
    data_dir = os.path.join(BASE_DIR, "mangas_data")
    os.makedirs(data_dir, exist_ok=True)
    detail_file = os.path.join(data_dir, f"{manga_id}.json")
    with open(detail_file, "w", encoding="utf-8") as f:
        json.dump(entry, f, ensure_ascii=False, indent=2)

    # 2. Save lightweight index data to scraped_mangas.json
    existing = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                existing = []

    existing = [m for m in existing if m.get("url") != url]
    
    # Create index entry
    index_entry = {
        "id": entry["id"],
        "title": entry["title"],
        "alternative": entry.get("alternative", ""),
        "status": entry.get("status", "Ongoing"),
        "cover": entry.get("cover", ""),
        "synopsis": entry.get("synopsis", ""),
        "author": entry.get("author", ""),
        "artist": entry.get("artist", ""),
        "genres": entry.get("genres", []),
        "url": entry["url"],
        "chaptersCount": len(entry.get("chapters", [])),
        "latestChapter": entry["chapters"][0] if entry.get("chapters") else None
    }
    
    existing.append(index_entry)

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
