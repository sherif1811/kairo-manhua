import re
import logging
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper

logger = logging.getLogger("scrapers.hijala")

class HijalaScraper(BaseScraper):
    def scrape_metadata(self, url: str) -> dict:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")

        title_el = soup.select_one(".post-title h1") or soup.select_one("h1")
        title = title_el.text.strip() if title_el else ""
        if not title:
            og_title = soup.select_one('meta[property="og:title"]')
            title = og_title.get("content", "").strip() if og_title else ""

        cover_url = ""
        cover_el = soup.select_one(".summary_image img")
        if cover_el:
            cover_url = (cover_el.get("data-src") or cover_el.get("data-lazy-src") or cover_el.get("src") or "").strip()
        if not cover_url:
            og_img = soup.select_one('meta[property="og:image"]')
            cover_url = og_img.get("content", "").strip() if og_img else ""
        if cover_url:
            cover_url = urljoin(url, cover_url)

        status = ""
        status_el = soup.select_one(".post-status .summary-content")
        if status_el:
            status = status_el.text.strip()

        author = ""
        author_el = soup.select_one(".author-content a")
        if author_el:
            author = author_el.text.strip()

        artist = ""
        artist_el = soup.select_one(".artist-content a")
        if artist_el:
            artist = artist_el.text.strip()

        genres = []
        for g in soup.select(".genres-content a"):
            t = g.text.strip()
            if t and t not in genres:
                genres.append(t)

        description = ""
        desc_el = soup.select_one(".description-summary .summary__content") or soup.select_one(".summary__content") or soup.select_one('meta[name="description"]')
        if desc_el:
            description = desc_el.get("content", desc_el.text).strip() if hasattr(desc_el, 'get') else desc_el.text.strip()

        chapters = []
        chapter_selectors = [
            "li.wp-manga-chapter",
            "div.chapter-item",
            "li.chapter-item",
            ".chapter-list li",
            "#chapterlist li",
            "ul.chapters li",
            ".listing-chapters li",
            ".manga-chapter-list li",
        ]
        for sel in chapter_selectors:
            items = soup.select(sel)
            if items:
                for item in items:
                    a_tag = item.select_one("a")
                    if a_tag and a_tag.get("href"):
                        ch_url = urljoin(url, a_tag["href"].strip())
                        if ch_url.startswith('#') or ch_url.startswith('javascript'):
                            continue
                        ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip()
                        if not ch_title:
                            ch_title = a_tag.text.strip()
                        ch_title = re.sub(r'\s+', ' ', ch_title)
                        date_span = item.select_one(".chapter-release-date i, .chapter-release-date a, span.post-on")
                        ch_date = date_span.text.strip() if date_span else ""
                        if not any(c['url'] == ch_url for c in chapters):
                            chapters.append({"url": ch_url, "title": ch_title, "date": ch_date})
                if chapters:
                    break

        if not chapters:
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"]
                text = a_tag.text.strip().lower()
                if ("chapter" in href.lower() or "الفصل" in text) and not any(x in href for x in ["tag", "category", "author", "#"]):
                    ch_url = urljoin(url, href)
                    ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip() or a_tag.text.strip()
                    ch_title = re.sub(r'\s+', ' ', ch_title)
                    if not any(c['url'] == ch_url for c in chapters):
                        chapters.append({"url": ch_url, "title": ch_title})

        def extract_num(ch):
            title = ch.get("title", "").lower()
            url_str = ch.get("url", "")
            match = re.search(r'(?:chapter|ch|chap|الفصل)[^\d]*(\d+(?:\.\d+)?)', title)
            if not match:
                match = re.search(r'(\d+(?:\.\d+)?)', url_str.split('/')[-2] if url_str.endswith('/') else url_str.split('/')[-1])
            return float(match.group(1)) if match else 0.0

        chapters.sort(key=extract_num, reverse=True)

        return {
            "title": title,
            "cover": cover_url,
            "description": description,
            "author": author,
            "artist": artist,
            "genres": genres if genres else "",
            "status": status if status else "Ongoing",
            "chapters": chapters,
        }

    def scrape_chapter_pages(self, url: str) -> list[str]:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")

        images = []
        for container_sel in [".reading-content", ".page-break", ".chapter-content", ".text-center", "#reader-area", ".entry-content"]:
            container = soup.select_one(container_sel)
            if container:
                for img in container.find_all("img"):
                    src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
                    if src and "placeholder" not in src.lower() and ".gif" not in src.lower():
                        if src not in images:
                            images.append(src)
                if images:
                    return images

        for img in soup.find_all("img"):
            src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
            if not src:
                continue
            if not src.startswith("http"):
                src = urljoin(url, src)
            skip = [".gif", "icon", "logo", "banner", "avatar", "px.gif", "blank.gif", "1x1.gif", "data:image"]
            if any(kw in src.lower() for kw in skip):
                continue
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
