import re
import logging
from scrapers.base_scraper import BaseScraper
# Import specific scrapers here later
# from scrapers.mangatuk_scraper import MangatukScraper
# from scrapers.madara_scraper import MadaraScraper

logger = logging.getLogger("scrapers.factory")

class GenericScraper(BaseScraper):
    """A fallback scraper that uses heuristics if no specific scraper exists."""
    def scrape_metadata(self, url: str) -> dict:
        from urllib.parse import urljoin
        logger.warning(f"No specific extractor found for {url}. Using generic heuristic parser.")
        html = self.fetch_html(url)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        
        # Simple heuristics
        title_tag = soup.find("h1") or soup.find("title")
        title = title_tag.text.strip() if title_tag else "Unknown Manga"
        
        # Try to extract cover from og:image meta
        cover_url = ""
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image:
            cover_url = og_image.get("content", "").strip()
            if cover_url: cover_url = urljoin(url, cover_url)
        if not cover_url:
            img = soup.select_one(".summary_image img, .thumb img, .post-thumbnail img, img.attachment-full")
            if img:
                cover_url = img.get("data-src") or img.get("src") or ""
                if cover_url: cover_url = urljoin(url, cover_url)
        
        chapters = []
        # Narrow to likely chapter-list containers
        chapter_containers = soup.select_one(
            ".chapter-list, #chapterlist, .wp-manga-chapters, "
            "#manga-chapters-holder, ul.chapters, .chapters-list, "
            "div.listing-chapters, .manga-chapter-list"
        )
        if not chapter_containers:
            chapter_containers = soup
        for a in chapter_containers.find_all("a", href=True):
            href = a["href"]
            text = a.text.strip()
            # Must look like a chapter link
            if ("chapter" in href.lower() or "ch-" in href.lower()
                    or "الفصل" in text or re.search(r'(?:chapter|ch|الفصل)\s*\d', text, re.IGNORECASE)):
                # Avoid duplicates and non-chapter paths
                if any(x in href for x in ["tag", "category", "author", "page"]):
                    continue
                from urllib.parse import urljoin
                absolute_url = urljoin(url, href)
                if not any(ch['url'] == absolute_url for ch in chapters):
                    chapters.append({"url": absolute_url, "title": text or f"Chapter {len(chapters)+1}"})
        return {
            "title": title, 
            "cover_url": cover_url, 
            "status": "Ongoing",
            "author": "",
            "artist": "",
            "genres": "",
            "description": "",
            "chapters": chapters
        }

    def scrape_chapter_pages(self, url: str) -> list[str]:
        logger.warning(f"No specific extractor for pages at {url}. Using generic heuristic.")
        html = self.fetch_html(url)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        # 1. Look in known manga-reader containers first
        for container_sel in [".reading-content", ".page-break", ".chapter-content",
                              "#reader-area", ".comic-page", ".manga-page",
                              ".entry-content", ".entry-content p", ".read-content"]:
            container = soup.select_one(container_sel)
            if container:
                imgs = container.find_all("img")
                if imgs:
                    images = []
                    for img in imgs:
                        src = (img.get("data-src") or img.get("data-lazy-src")
                               or img.get("src") or "").strip()
                        if not src:
                            continue
                        if not src.startswith("http"):
                            from urllib.parse import urljoin
                            src = urljoin(url, src)
                        # Skip ads, icons, gifs
                        skip = [".gif", "icon", "logo", "banner", "avatar",
                                "advertisement", "sponsor", "px.gif", "blank.gif",
                                "1x1.gif", "data:image"]
                        if any(kw in src.lower() for kw in skip):
                            continue
                        if src not in images:
                            images.append(src)
                    if images:
                        return images

        # 2. Fallback — collect all images, filter aggressively
        images = []
        for img in soup.find_all("img"):
            src = (img.get("data-src") or img.get("data-lazy-src")
                   or img.get("src") or "").strip()
            if not src:
                continue
            if not src.startswith("http"):
                from urllib.parse import urljoin
                src = urljoin(url, src)
            skip = [".gif", "icon", "logo", "banner", "avatar", "advertisement",
                    "sponsor", "px.gif", "blank.gif", "1x1.gif", "data:image",
                    "social", "share", "like", "button", "badge", "emoji"]
            if any(kw in src.lower() for kw in skip):
                continue
            # Require minimum plausible size (width/height attributes)
            w = img.get("width")
            h = img.get("height")
            if w and h:
                try:
                    if int(w) < 100 or int(h) < 100:
                        continue
                except (ValueError, TypeError):
                    pass
            if src not in images:
                images.append(src)
        return images


def get_scraper(url: str) -> BaseScraper:
    """Factory method to get the correct scraper based on domain."""
    if "mangatuk.com" in url:
        from scrapers.mangatuk_scraper import MangatukScraper
        return MangatukScraper()
    elif "asuracomic" in url or "mangaclash" in url or "manga-starz" in url or "lekmanga" in url or "lek-manga" in url or "3asq.org" in url:
        from scrapers.madara_scraper import MadaraScraper
        return MadaraScraper()
    elif "olympusstaff" in url or "olympustaff" in url:
        from scrapers.olympus_scraper import OlympusScraper
        return OlympusScraper()
    elif "mangagm.geetmark" in url:
        from scrapers.mangagm_scraper import MangaGMScraper
        return MangaGMScraper()
    elif "geetmark" in url:
        from scrapers.geetmark_scraper import GeetmarkScraper
        return GeetmarkScraper()
    elif "mgeko.cc" in url:
        from scrapers.mgeko_scraper import MgekoScraper
        return MgekoScraper()
    elif "3asq.org" in url:
        from scrapers.madara_scraper import MadaraScraper
        return MadaraScraper()
    elif "mangatime.org" in url:
        from scrapers.mangatime_scraper import MangatimeScraper
        return MangatimeScraper()
    elif "hijala.com" in url:
        from scrapers.hijala_scraper import HijalaScraper
        return HijalaScraper()
    
    # Fallback to Generic
    return GenericScraper()
