import re
import logging
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper

logger = logging.getLogger("scrapers.mgeko")

class MgekoScraper(BaseScraper):
    def scrape_metadata(self, url: str) -> dict:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")

        title_el = soup.find("h1")
        title = title_el.text.strip() if title_el else ""
        if not title:
            og_title = soup.select_one('meta[property="og:title"]')
            title = og_title.get("content", "").strip() if og_title else ""

        cover_url = ""
        og_img = soup.select_one('meta[property="og:image"]')
        if og_img and og_img.get("content"):
            cover_url = og_img["content"].strip()
            cover_url = urljoin(url, cover_url)

        description = ""
        for meta_sel in ['meta[name="description"]', 'meta[property="og:description"]']:
            m = soup.select_one(meta_sel)
            if m and m.get("content"):
                desc = m["content"].strip()
                if len(desc) > 20:
                    description = desc
                    break

        genres = []
        for a in soup.select('a[href*="/genre/"], a[href*="/category/"]'):
            t = a.text.strip()
            if t and len(t) < 30 and t not in genres:
                genres.append(t)

        chapters = []
        seen_urls = set()
        for a in soup.select("ul.chapter-list li.chapter-list-item a"):
            href = a.get("href", "")
            if not href or href.startswith("#") or href.startswith("javascript"):
                continue
            abs_href = urljoin(url, href)
            if abs_href in seen_urls:
                continue
            seen_urls.add(abs_href)

            ch_text = a.text.strip()
            ch_num_match = re.search(r'chapter[-\s]*(\d+(?:\.\d+)?)', ch_text, re.IGNORECASE)
            if not ch_num_match:
                ch_num_match = re.search(r'(\d+(?:\.\d+)?)', ch_text)
            ch_title = f"الفصل {ch_num_match.group(1)}" if ch_num_match else ch_text

            chapters.append({"url": abs_href, "title": ch_title})

        return {
            "title": title,
            "cover": cover_url,
            "description": description,
            "author": "",
            "artist": "",
            "genres": genres,
            "chapters": chapters,
        }

    def scrape_chapter_pages(self, url: str) -> list[str]:
        html = self._fetch_with_playwright(url, self._get_random_user_agent())
        soup = BeautifulSoup(html, "html.parser")

        images = []
        for container_sel in [".chapter-content", ".page-break", ".reading-content",
                              ".read-content", "#reader", ".reader-container",
                              "main", ".entry-content"]:
            container = soup.select_one(container_sel)
            if container:
                imgs = container.find_all("img")
                if imgs:
                    for img in imgs:
                        src = (img.get("data-src") or img.get("data-lazy-src")
                               or img.get("src") or "").strip()
                        if src and src.startswith("http"):
                            skip = [".gif", "icon", "logo", "banner", "avatar",
                                    "px.gif", "blank.gif", "1x1.gif", "data:image",
                                    "loading", "placeholder", "svg", "credits"]
                            if any(kw in src.lower() for kw in skip):
                                continue
                            if src not in images:
                                images.append(src)
                    images = [i for i in images if urlparse(i).hostname in ('imgsrv4.com',)]
                    if images:
                        return images

        for img in soup.find_all("img"):
            src = (img.get("data-src") or img.get("data-lazy-src")
                   or img.get("src") or "").strip()
            if not src or not src.startswith("http"):
                continue
            skip = [".gif", "icon", "logo", "banner", "avatar", "px.gif",
                    "blank.gif", "1x1.gif", "data:image", "loading", "placeholder", "svg", "credits"]
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

        images = [i for i in images if urlparse(i).hostname in ('imgsrv4.com',)]
        return images
