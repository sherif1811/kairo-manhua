import re
import os
import json
import time
import sqlite3
import logging
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
from scrapers.factory import get_scraper

log = logging.getLogger("scrapers.importer")

def _generate_manga_id(url: str, title: str) -> str:
    slug_match = re.search(r"/manga/([^/]+)", url)
    if slug_match:
        base = slug_match.group(1)
        base = re.sub(r'[^a-zA-Z0-9-]', '', base).lower()
        if base: return base
    hash_obj = hashlib.md5((title + url).encode("utf-8"))
    return hash_obj.hexdigest()[:10]

def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS manga (
            id TEXT PRIMARY KEY,
            title TEXT,
            alt_title TEXT,
            author TEXT,
            artist TEXT,
            description TEXT,
            cover_url TEXT,
            banner_url TEXT,
            status TEXT,
            genres TEXT,
            source TEXT,
            source_url TEXT,
            created_at REAL,
            updated_at REAL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS chapters (
            id TEXT,
            manga_id TEXT,
            title TEXT,
            number REAL,
            source_url TEXT,
            pages INTEGER,
            translated BOOLEAN DEFAULT FALSE,
            status TEXT DEFAULT 'pending',
            created_at REAL,
            PRIMARY KEY (id, manga_id)
        )
    """)
    conn.commit()
    conn.close()

def import_manga_from_url(url: str, db_path: str = "kairo.db", scrape_images: bool = False, max_threads: int = 5) -> dict:
    log.info(f"Importing manga from URL: {url}")
    
    init_db(db_path)
    
    scraper = get_scraper(url)
    try:
        metadata = scraper.scrape_metadata(url)
    except Exception as e:
        return {"error": str(e)}

    title = metadata.get("title", "")
    chapters_raw = metadata.get("chapters", [])

    if not title:
        return {"error": "Could not extract manga title"}
    if not chapters_raw:
        return {"error": "No chapters found", "title": title}

    manga_id = _generate_manga_id(url, title)
    metadata["id"] = manga_id
    metadata["source_url"] = url

    # Clean chapter titles and extract chapter numbers
    for ch in chapters_raw:
        ch_title = ch.get("title", "")
        ch_url = ch.get("url", "")
        # Try to extract number from title first
        num_match = re.search(r'(?:chapter|ch|chap|الفصل)[\s.-]*(\d+(?:\.\d+)?)', ch_title, re.IGNORECASE)
        if not num_match:
            # Try from URL — last path segment before trailing slash
            url_part = ch_url.rstrip('/').split('/')[-1]
            num_match = re.search(r'(?:chapter|ch|chap)[\s.-]*(\d+(?:\.\d+)?)', url_part, re.IGNORECASE)
        if not num_match:
            num_match = re.search(r'(\d+(?:\.\d+)?)', url_part if 'url_part' in dir() else ch_url)
        ch_number = float(num_match.group(1)) if num_match else 0.0
        cleaned_title = f"الفصل {int(ch_number) if ch_number == int(ch_number) else ch_number}"
        ch["title"] = cleaned_title
        ch["number"] = ch_number

    # Always sort chapters ascending by their real number (oldest first)
    # The frontend will handle display order (newest first toggle)
    chapters_raw.sort(key=lambda c: c.get("number", 0))
    log.info(f"Chapters sorted: {len(chapters_raw)} chapters, range [{chapters_raw[0].get('number',0) if chapters_raw else 'N/A'} - {chapters_raw[-1].get('number',0) if chapters_raw else 'N/A'}]")

    # Preserve existing images if re-importing (must happen BEFORE scrape/clear)
    existing_images = {}
    manga_id_from_url = _generate_manga_id(url, title)
    try:
        json_path_import = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scraped_mangas.json")
        with open(json_path_import, "r", encoding="utf-8") as f:
            existing_db = json.load(f)
        for m in existing_db:
            if str(m.get("id")) == str(manga_id_from_url) or m.get("url") == url:
                for ch in m.get("chapters", []):
                    imgs = ch.get("images", [])
                    if imgs:
                        ch_url = ch.get("url", "")
                        key = ch_url or f"num_{ch.get('number', '')}"
                        existing_images[key] = imgs
        if existing_images:
            log.info(f"Preserved {len(existing_images)} existing chapter image sets from scraped_mangas.json")
    except Exception as e:
        log.warning(f"Could not preserve existing images: {e}")

    # Apply preserved images to matching chapters
    for ch in chapters_raw:
        ch_url = ch.get("url", "")
        key = ch_url or f"num_{ch.get('number', '')}"
        if key in existing_images:
            ch["images"] = existing_images[key]

    # Scrape chapter page images if requested
    if scrape_images:
        log.info(f"Scraping images for {len(chapters_raw)} chapters ({max_threads} threads)...")
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import time as _time
        def _scrape_chapter(ch):
            ch_url = ch.get("url", "")
            if not ch_url:
                return ch
            # Skip if we already have images for this chapter
            if ch.get("images"):
                log.info(f"Skipping {ch.get('title', ch_url)} — already has {len(ch['images'])} images")
                return ch
            _time.sleep(0.5)
            try:
                images = scraper.scrape_chapter_pages(ch_url)
                ch["images"] = images
                log.info(f"Got {len(images)} pages for {ch.get('title', ch_url)}")
            except Exception as e:
                log.error(f"Failed to scrape pages for {ch_url}: {e}")
                ch["images"] = []
            return ch
        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            futures = {executor.submit(_scrape_chapter, ch): i for i, ch in enumerate(chapters_raw)}
            for future in as_completed(futures):
                future.result()
    else:
        for ch in chapters_raw:
            if not ch.get("images"):
                ch["images"] = []

    # Save to DB
    db_manga_id = create_manga_in_db(db_path, metadata)
    chapter_ids = create_chapters_in_db(db_path, db_manga_id, chapters_raw)

    # Save to scraped_mangas.json so the frontend can read it
    json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scraped_mangas.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            scraped_db = json.load(f)
    except Exception:
        scraped_db = []
    
    # Remove old version if exists
    scraped_db = [m for m in scraped_db if str(m.get("id")) != str(manga_id)]
    
    # Create the manga object for frontend
    frontend_chapters = []
    for idx, ch in enumerate(chapters_raw):
        frontend_chapters.append({
            "id": chapter_ids[idx] if idx < len(chapter_ids) else f"ch_{idx}",
            "title": ch.get("title", ""),
            "url": ch.get("url", ""),
            "date": ch.get("date") or time.strftime("%Y-%m-%d"),
            "images": ch.get("images", []),
            "number": ch.get("number", 0.0),
        })

    manga_obj = {
        "id": manga_id,
        "title": title,
        "alternative": metadata.get("alternative", metadata.get("alt_title", "")),
        "status": metadata.get("status", "Ongoing"),
        "cover": metadata.get("cover", metadata.get("cover_url", "")),
        "synopsis": metadata.get("description", ""),
        "author": metadata.get("author", ""),
        "artist": metadata.get("artist", ""),
        "genres": ", ".join(metadata.get("genres", [])) if isinstance(metadata.get("genres"), list) else metadata.get("genres", ""),
        "url": url,
        "chapters": frontend_chapters
    }
    scraped_db.append(manga_obj)
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)

    # حقن IDs في chapters_raw لاستخدامها لاحقاً
    for idx, ch in enumerate(chapters_raw):
        ch["id"] = chapter_ids[idx] if idx < len(chapter_ids) else f"ch_{idx}"

    return {
        "success": True,
        "manga_id": db_manga_id,
        "title": title,
        "chapters_count": len(chapter_ids),
        "chapters": chapters_raw,
        "status": metadata.get("status", "Ongoing"),
        "cover_url": metadata.get("cover", metadata.get("cover_url", "")),
    }

def create_manga_in_db(db_path: str, metadata: dict) -> str:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    m_id = metadata.get("id") or _generate_manga_id(metadata.get("source_url", ""), metadata.get("title", ""))
    
    now = time.time()
    c.execute(
        """
        INSERT OR REPLACE INTO manga
            (id, title, alt_title, author, artist, description, cover_url, status, genres, source_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            m_id,
            metadata.get("title", ""),
            metadata.get("alternative", metadata.get("alt_title", "")),
            metadata.get("author", ""),
            metadata.get("artist", ""),
            metadata.get("description", ""),
            metadata.get("cover", metadata.get("cover_url", "")),
            metadata.get("status", "Ongoing"),
            ", ".join(metadata.get("genres", [])) if isinstance(metadata.get("genres"), list) else metadata.get("genres", ""),
            metadata.get("source_url", ""),
            now,
            now,
        ),
    )
    conn.commit()
    conn.close()
    return m_id

def create_chapters_in_db(db_path: str, manga_id: str, chapters: list) -> list:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    now = time.time()
    created_ids = []

    # Ensure schema has status column
    try:
        c.execute("ALTER TABLE chapters ADD COLUMN status TEXT DEFAULT 'pending'")
    except: pass

    for ch in chapters:
        ch_url = ch.get("url", "")
        ch_title = ch.get("title", "")
        ch_number = ch.get("number", 0.0)
        ch_id = f"ch_{ch_number}".replace(".", "_")
        
        c.execute(
            """
            INSERT OR REPLACE INTO chapters
                (id, manga_id, title, number, source_url, pages, translated, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (ch_id, manga_id, ch_title, ch_number, ch_url, 0, False, 'pending', now)
        )
        created_ids.append(ch_id)

    conn.commit()
    conn.close()
    return created_ids
