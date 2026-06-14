#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مستورد المانجا والمنهوا من المواقع الخارجية
يقوم بسحب بيانات المانجا والفصول بالكامل وإضافتها إلى قاعدة البيانات المحلية
"""

import re
import os
import sys
import json
import time
import random
import sqlite3
import argparse
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

try:
    import cloudscraper
    _SCRAPER = cloudscraper.create_scraper()
    HAS_CLOUDSCRAPER = True
except ImportError:
    import requests
    _SCRAPER = requests
    HAS_CLOUDSCRAPER = False
    log.warning("cloudscraper غير مثبت. المواقع التي تستخدم Cloudflare قد تمنع الاتصال. قم بالتثبيت عبر: pip install cloudscraper")

from bs4 import BeautifulSoup

try:
    import lxml
    PARSER = "lxml"
except ImportError:
    PARSER = "html.parser"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(BASE_DIR, "kairo.db")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/125.0.0.0",
]

def _get_headers():
    return {"User-Agent": random.choice(USER_AGENTS)}

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def _create_session():
    session = _SCRAPER if HAS_CLOUDSCRAPER else requests.Session()
    retries = Retry(total=2, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["GET", "POST"])
    adapter = HTTPAdapter(max_retries=retries, pool_connections=5, pool_maxsize=10)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

def _get(url, delay=1.0, **kwargs):
    kwargs.setdefault("headers", _get_headers())
    kwargs.setdefault("timeout", 30)
    time.sleep(delay)
    session = _create_session()
    return session.get(url, **kwargs)

def _post(url, data, delay=0.5, **kwargs):
    kwargs.setdefault("headers", _get_headers())
    kwargs.setdefault("timeout", 15)
    time.sleep(delay)
    session = _create_session()
    return session.post(url, data=data, **kwargs)

def _normalize_url(url):
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    if url.endswith("/"):
        url = url.rstrip("/")
    return url

def _generate_manga_id(url, title=""):
    import hashlib
    combined = url + title
    return hashlib.md5(combined.encode()).hexdigest()[:10]

# ------------------------------------------------------------
#  الكشف عن نوع الموقع واستخدام السكرابر المناسب
# ------------------------------------------------------------

def detect_site(url):
    url_lower = url.lower()
    if "olympustaff" in url_lower:
        return "olympustaff"
    if "mangatuk" in url_lower or "mangatuk" in url_lower:
        return "mangatuk"
    if "lek-manga" in url_lower or "lekmanga" in url_lower:
        return "lekmanga"
    return "generic"

def scrape_manga_metadata(url):
    from scrapers.factory import get_scraper
    scraper = get_scraper(url)
    return scraper.scrape_metadata(url)

def scrape_chapter_pages(url):
    from scrapers.factory import get_scraper
    scraper = get_scraper(url)
    return scraper.scrape_chapter_pages(url)

# ═══════════════════════════════════════════════════════════
#  الدالة الرئيسية للتنسيق
# ═══════════════════════════════════════════════════════════

def import_manga_from_url(url, db_path=DEFAULT_DB, scrape_images=False, max_threads=5):
    """سحب بيانات مانجا من رابط وإضافتها إلى قاعدة البيانات"""
    log.info("بدء استيراد المانجا من: %s", url)
    from scrapers.importer import import_manga_from_url as _importer
    return _importer(url, db_path=db_path, scrape_images=scrape_images, max_threads=max_threads)

# ═══════════════════════════════════════════════════════════
#  نقطة الدخول (سطر الأوامر)
# ═══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="استيراد المانجا والمنهوا من مواقع خارجية إلى قاعدة البيانات المحلية")
    parser.add_argument("url", help="رابط المانجا (مثل: https://olympustaff.com/series/...)")
    parser.add_argument("--db", default=DEFAULT_DB, help="مسار ملف قاعدة البيانات (افتراضي: kairo.db)")
    parser.add_argument("--scrape-images", action="store_true", help="سحب صور الفصول أيضًا")
    parser.add_argument("--threads", type=int, default=5, help="عدد خيوط المعالجة المتوازية")
    parser.add_argument("--json", action="store_true", help="إظهار النتيجة بصيغة JSON")
    parser.add_argument("--dump-metadata", action="store_true", help="سحب البيانات فقط دون إضافة إلى قاعدة البيانات")

    args = parser.parse_args()

    if args.dump_metadata:
        from pprint import pprint
        data = scrape_manga_metadata(args.url)
        if args.json:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            pprint(data)
        return

    result = import_manga_from_url(url=args.url, db_path=args.db, scrape_images=args.scrape_images, max_threads=args.threads)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print()
        print("=" * 50)
        print("✅ تم استيراد المانجا بنجاح!")
        print("=" * 50)
        print(f"  المعرف:     {result.get('manga_id', '?')}")
        print(f"  العنوان:    {result.get('title', '?')}")
        print(f"  الفصول:     {result.get('chapters_count', 0)}")
        print(f"  الحالة:     {result.get('status', '?')}")
        if result.get("cover_url"):
            print(f"  الغلاف:     {result['cover_url']}")
        print("=" * 50)

if __name__ == "__main__":
    main()
