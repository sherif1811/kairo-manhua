import re
import json
import logging
import urllib.request
import urllib.parse
import ssl
from urllib.parse import urlparse
from scrapers.base_scraper import BaseScraper

logger = logging.getLogger("scrapers.mangatime")

API_BASE = "https://mangatime.org/api/trpc"

def _api_call(procedure: str, input_params: dict) -> dict:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    payload = {"0": {"json": input_params}}
    encoded = urllib.parse.quote(json.dumps(payload))
    url = f"{API_BASE}/{procedure}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    data = json.loads(resp.read().decode("utf-8"))
    return data[0]["result"]["data"]["json"]


class MangatimeScraper(BaseScraper):
    def scrape_metadata(self, url: str) -> dict:
        parsed = urlparse(url)
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) < 2:
            raise ValueError(f"URL غير صالح: {url}")
        series_type = parts[0]
        slug = parts[1]
        series = _api_call("content.getSeriesBySlug", {"slug": slug})
        series_id = series["id"]
        all_chapters = []
        cursor = None
        while True:
            params = {"seriesId": series_id, "limit": 500}
            if cursor:
                params["cursor"] = cursor
            result = _api_call("content.getChapters", params)
            chapters = result.get("chapters", [])
            for c in chapters:
                ch_url = f"https://mangatime.org/{series_type}/{slug}/chapter/{c['number']}"
                all_chapters.append({
                    "url": ch_url,
                    "title": c.get("title") or f"الفصل {c['number']}",
                    "id": c["id"],
                    "number": c["number"],
                })
            if not result.get("hasMore"):
                break
            cursor = result.get("nextCursor")
            if not cursor:
                break
        cover_url = series.get("coverUrl", "")
        if cover_url and not cover_url.startswith("http"):
            cover_url = f"https://mangatime.org{cover_url}"
        return {
            "title": series.get("title", ""),
            "cover": cover_url,
            "description": series.get("description", ""),
            "author": "",
            "artist": "",
            "genres": [g.get("name") if isinstance(g, dict) else str(g) for g in series.get("genres", [])],
            "chapters": all_chapters,
            "_series_id": series_id,
            "_series_type": series_type,
            "_slug": slug,
        }

    def scrape_chapter_pages(self, url: str) -> list[str]:
        parsed = urlparse(url)
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) < 4:
            raise ValueError(f"رابط فصل غير صالح: {url}")
        slug = parts[1]
        chapter_number = parts[3]
        series = _api_call("content.getSeriesBySlug", {"slug": slug})
        series_id = series["id"]
        cursor = None
        chapter_id = None
        while True:
            params = {"seriesId": series_id, "limit": 500}
            if cursor:
                params["cursor"] = cursor
            result = _api_call("content.getChapters", params)
            for c in result.get("chapters", []):
                if str(c["number"]) == chapter_number:
                    chapter_id = c["id"]
                    break
            if chapter_id:
                break
            if not result.get("hasMore"):
                break
            cursor = result.get("nextCursor")
            if not cursor:
                break
        if not chapter_id:
            logger.warning(f"لم يتم العثور على الفصل {chapter_number} في {slug}")
            return []
        pages = _api_call("content.getChapterPages", {"chapterId": chapter_id})
        return pages.get("pages", [])
