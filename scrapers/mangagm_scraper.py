import re
import json
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, parse_qs
from scrapers.base_scraper import BaseScraper

logger = logging.getLogger("scrapers.mangagm")

BASE = "https://mangagm.geetmark.com"


def _make_manga_url(raw_url: str) -> str:
    """Convert any mangagm.geetmark.com URL to the canonical ?action=manga form."""
    # Already the right format
    if "action=manga" in raw_url:
        return raw_url
    # If it's the search page or home page, just return as-is
    return raw_url


class MangaGMScraper(BaseScraper):
    """Scraper for mangagm.geetmark.com – an aggregator that embeds
    all chapter images as a pagesObject JSON in the reader page HTML."""

    # ------------------------------------------------------------------ #
    #  Metadata
    # ------------------------------------------------------------------ #
    def scrape_metadata(self, url: str) -> dict:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")

        # --- title ---
        title = "Unknown"
        h1 = soup.select_one("h1.manga-title")
        if h1:
            title = h1.get_text(strip=True)
        else:
            og = soup.select_one('meta[property="og:title"]')
            if og:
                title = og.get("content", "Unknown").replace("Read", "").replace("Manga Online", "").replace("- MangaGM", "").strip()

        # --- cover ---
        cover_url = ""
        cover_img = soup.select_one(".cover-image img")
        if cover_img:
            cover_url = (
                cover_img.get("data-src")
                or cover_img.get("src")
                or ""
            ).strip()

        # --- description ---
        description = ""
        desc_el = soup.select_one(".description-content")
        if desc_el:
            description = desc_el.get_text(separator=" ", strip=True)

        # --- genres (links of form ?action=search&q=GENRE&source=...) ---
        genres = []
        bad = {"", "home", "search", "login", "register", "search for similar manga"}
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "action=search" in href and "q=" in href:
                g = a.get_text(strip=True)
                if g.lower() not in bad:
                    genres.append(g)

        # --- status ---
        status = "Ongoing"
        status_el = soup.select_one(".manga-status") or soup.find(
            lambda tag: tag.name in ["span", "li", "td"]
            and "Status" in tag.get_text()
        )
        if status_el:
            txt = status_el.get_text(strip=True).lower()
            if "complet" in txt:
                status = "Completed"
            elif "hiatus" in txt or "dropped" in txt:
                status = "Dropped"

        # --- chapters (table rows with read-button links) ---
        chapters = []
        seen = set()
        for row in soup.select("tr[role='row']"):
            # chapter number cell
            num_td = row.select_one("td.chapter-number")
            read_a = row.select_one("a.read-button")
            if not num_td or not read_a:
                continue
            ch_href = read_a.get("href", "")
            if not ch_href or ch_href in seen:
                continue
            seen.add(ch_href)
            ch_url = urljoin(BASE, ch_href)
            num_text = num_td.get_text(strip=True)  # e.g. "Chapter 185"
            num_match = re.search(r"(\d+(?:\.\d+)?)", num_text)
            num = float(num_match.group(1)) if num_match else len(chapters) + 1
            chapters.append({
                "url": ch_url,
                "title": num_text,
                "number": num,
                "date": "",
            })

        # Sort descending (newest first)
        chapters.sort(key=lambda c: c["number"], reverse=True)

        return {
            "title": title,
            "status": status,
            "cover_url": cover_url,
            "description": description,
            "genres": genres,
            "chapters": chapters,
        }

    # ------------------------------------------------------------------ #
    #  Chapter pages
    # ------------------------------------------------------------------ #
    def scrape_chapter_pages(self, url: str) -> list:
        """Extract chapter images from the pagesObject JSON embedded in the
        reader page – no headless browser needed."""
        html = self.fetch_html(url)

        # The reader page embeds a JavaScript variable:
        #   const pagesObject = {"0":{"url":"https://...1.jpg",...},...};
        # We parse that JSON blob directly.
        images = self._extract_pages_object(html)
        if images:
            return images

        # Fallback: grab all img[src] that look like chapter pages
        soup = BeautifulSoup(html, "html.parser")
        skip_kw = ["logo", "banner", "icon", "avatar", ".gif"]
        for img in soup.find_all("img"):
            src = (img.get("data-src") or img.get("src") or "").strip()
            if not src:
                continue
            if not src.startswith("http"):
                src = urljoin(BASE, src)
            if any(kw in src.lower() for kw in skip_kw):
                continue
            images.append(src)

        return images

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _extract_pages_object(html: str) -> list:
        """Parse the pagesObject / pages JS variable from the reader HTML."""
        # Pattern: const pagesObject = {...};  OR  const pages = {...};
        patterns = [
            r"const\s+pagesObject\s*=\s*(\{.*?\})\s*(?:\|\|\s*\{\})?;",
            r"const\s+pages\s*=\s*(\{.*?\})\s*(?:\|\|\s*\{\})?;",
            r"var\s+pagesObject\s*=\s*(\{.*?\})\s*(?:\|\|\s*\{\})?;",
        ]
        for pattern in patterns:
            m = re.search(pattern, html, re.DOTALL)
            if not m:
                continue
            try:
                raw = m.group(1)
                # Unescape forward slashes produced by PHP json_encode
                raw = raw.replace("\\/", "/")
                data = json.loads(raw)
                images = []
                # Keys are "0", "1", ... ; also may have "cached" etc.
                for key, val in sorted(
                    ((k, v) for k, v in data.items() if isinstance(v, dict)),
                    key=lambda x: int(x[0]) if x[0].isdigit() else 9999,
                ):
                    img_url = val.get("url", "").strip()
                    if img_url:
                        images.append(img_url)
                if images:
                    return images
            except (json.JSONDecodeError, ValueError, TypeError) as e:
                logger.warning(f"Failed to parse pagesObject: {e}")
                continue
        return []
