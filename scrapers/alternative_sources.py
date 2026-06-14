import os, json, re, time, logging, requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

logger = logging.getLogger("scrapers.alternative")

MANGADEX_API = "https://api.mangadex.org"
SEARCH_ENGINES = [
    {"name": "MangaDex", "priority": 1},
    {"name": "MangaNato", "priority": 2},
    {"name": "AsuraScans", "priority": 3},
]

def search_mangadex(title: str) -> list[dict]:
    results = []
    try:
        resp = requests.get(f"{MANGADEX_API}/manga", params={
            "title": title, "limit": 5, "contentRating[]": ["safe", "suggestive", "erotica"]
        }, timeout=15)
        if resp.status_code != 200:
            return results
        data = resp.json()
        for manga in data.get("data", []):
            attrs = manga.get("attributes", {})
            titles = attrs.get("title", {})
            alt_titles_list = attrs.get("altTitles", [])
            all_titles = [titles.get("en", "").lower()]
            for at in alt_titles_list:
                for v in at.values():
                    if isinstance(v, str):
                        all_titles.append(v.lower())
            results.append({
                "id": manga["id"],
                "title": titles.get("en", "Unknown"),
                "source": "MangaDex",
                "url": f"https://mangadex.org/title/{manga['id']}",
                "cover": f"https://uploads.mangadex.org/covers/{manga['id']}/",
                "chapters_url": f"{MANGADEX_API}/manga/{manga['id']}/feed",
            })
    except Exception as e:
        logger.warning(f"MangaDex search failed: {e}")
    return results

def get_mangadex_feed(manga_id: str, limit: int = 200) -> list[dict]:
    chapters = []
    try:
        resp = requests.get(f"{MANGADEX_API}/manga/{manga_id}/feed", params={
            "translatedLanguage[]": "en",
            "order[chapter]": "desc",
            "limit": min(limit, 500),
        }, timeout=15)
        if resp.status_code != 200:
            return chapters
        data = resp.json()
        for ch in data.get("data", []):
            attrs = ch.get("attributes", {})
            ch_num = attrs.get("chapter", "")
            title = attrs.get("title", f"Chapter {ch_num}")
            chapters.append({
                "id": ch["id"],
                "title": title,
                "number": ch_num,
                "url": f"https://mangadex.org/chapter/{ch['id']}",
            })
    except Exception as e:
        logger.warning(f"MangaDex feed failed: {e}")
    return chapters

def get_mangadex_chapter_images(chapter_url: str) -> list[str]:
    try:
        import re
        m = re.search(r'/chapter/([a-f0-9-]+)', chapter_url)
        if not m:
            return []
        ch_id = m.group(1)
        resp = requests.get(f"{MANGADEX_API}/at-home/server/{ch_id}", timeout=15)
        if resp.status_code != 200:
            return []
        data = resp.json()
        base_url = data.get("baseUrl", "")
        chapter_data = data.get("chapter", {})
        hash_id = chapter_data.get("hash", "")
        pages = chapter_data.get("data", [])
        images = [f"{base_url}/data/{hash_id}/{p}" for p in pages]
        return images
    except Exception as e:
        logger.warning(f"MangaDex chapter images failed: {e}")
    return []

def search_alternative_sources(title: str) -> list[dict]:
    results = search_mangadex(title)
    if results:
        for r in results[:1]:
            feed = get_mangadex_feed(r["id"])
            r["chapters"] = feed
    return results

def find_fallback_images(manga_title: str, chapter_number: str) -> list[str]:
    alt_sources = search_mangadex(manga_title)
    if not alt_sources:
        return []
    feed = get_mangadex_feed(alt_sources[0]["id"])
    target = chapter_number.replace("ch_", "").replace("الفصل ", "")
    for ch in feed:
        ch_num = str(ch.get("number", ""))
        if ch_num == target or ch_num.rstrip("0").rstrip(".") == target.rstrip("0").rstrip("."):
            return get_mangadex_chapter_images(ch["url"])
    return []
