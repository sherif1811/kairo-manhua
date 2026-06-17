import logging
import re
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper
from urllib.parse import urljoin

logger = logging.getLogger("scrapers.olympus")

class OlympusScraper(BaseScraper):
    def fetch_html(self, url: str) -> str:
        return super().fetch_html(url)

    def scrape_metadata(self, url: str) -> dict:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        # Extract title
        title_el = soup.find("h1") or soup.find("title")
        title = title_el.text.strip() if title_el else ""
        if " - " in title:
            title = title.split(" - ")[0].strip()
            
        # Extract cover
        cover = ""
        # Try OpenGraph image first (most reliable for Olympus)
        og_img = soup.select_one('meta[property="og:image"]')
        if og_img and og_img.get("content"):
            cover = og_img["content"]
        else:
            cover_el = soup.select_one(
                ".summary_image img, .manga-poster img, .comic-cover img, "
                "img[src*='/images/manga/'], img[src*='/uploads/manga_'], "
                ".serie-img img, .poster img, img[src*='cover']"
            )
            if cover_el:
                cover = cover_el.get("src", "") or cover_el.get("data-src", "")
        
        # Extract description — try body containers first, then fallback to meta tags
        description = ""
        for sel in [".review-content", ".description", ".summary", ".manga-description", ".serie-description",
                    ".panel-body", ".comic-description", ".entry-content"]:
            el = soup.select_one(sel)
            if el:
                desc = el.text.strip()
                if len(desc) > 30:
                    description = desc
                    break
        if not description:
            for meta_sel in ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']:
                m = soup.select_one(meta_sel)
                if m and m.get("content"):
                    desc = m["content"].strip()
                    if len(desc) > 20 and not desc.startswith("مانجا") and not "مترجمة" in desc:
                        description = desc
                        break
        
        # Extract genres — look for genre/category links or tags
        genres = []
        for a in soup.select('a.subtitle, a[href*="/genre/"], a[href*="/categoria/"], a[href*="/category/"], a[href*="/tag/"]'):
            t = a.text.strip()
            if t and len(t) < 30 and t not in genres:
                genres.append(t)
        if not genres:
            for tag in soup.select(".tags a, .genres a, .manga-tags a, [class*='genre'] a, [class*='tag'] a"):
                t = tag.text.strip()
                if t and len(t) < 30 and t not in genres:
                    genres.append(t)
        
        # Extract author
        author = ""
        author_el = soup.select_one(".author-content a, .author a, a[href*='/author/']")
        if author_el:
            author = author_el.text.strip()
            
        # Extract chapters
        chapters = []
        chapter_links = soup.find_all("a", href=True)
        seen_urls = set()
        
        for a in chapter_links:
            href = a.get("href", "")
            # Olympus chapter links usually have /series/manga-name/chapter-number
            # Avoid ?page=, /genre/, /author/, /add/, /series/add/
            if "/add/" in href or "?" in href:
                continue
            if "/series/" in href and href.split("/")[-1].replace(".", "").isdigit():
                if href in seen_urls:
                    continue
                seen_urls.add(href)
                
                num_part = href.split("/")[-1]
                ch_title = f"\u0627\u0644\u0641\u0635\u0644 {num_part}"
                
                chapters.append({
                    "title": ch_title,
                    "url": urljoin(url, href)
                })
        
        # Sort chapters by number ascending
        chapters.sort(key=lambda c: float(c["url"].split("/")[-1].replace(".", "")))
        
        # Try to extract total chapter count from text like "قائمة الفصول (281)"
        total_chapters = None
        count_match = re.search(r'قائمة الفصول\s*\((\d+)\)', soup.get_text())
        if count_match:
            total_chapters = int(count_match.group(1))
        

        
        return {
            "title": title,
            "cover": urljoin(url, cover) if cover else "",
            "description": description,
            "author": author,
            "artist": "",
            "genres": genres,
            "chapters": chapters
        }

    def scrape_chapter_pages(self, url: str) -> list[str]:
        # Try curl_cffi first (much faster than Playwright)
        try:
            from curl_cffi import requests as curl_requests
            cs = curl_requests.Session(impersonate="chrome110")
            resp = cs.get(url, timeout=10)
            if resp.status_code == 200:
                html = resp.text
                soup = BeautifulSoup(html, "html.parser")
                images = []
                for img in soup.find_all("img"):
                    src = img.get("src", "").strip().replace(' ', '%20')
                    if not src:
                        src = img.get("data-src", "").strip().replace(' ', '%20')
                    if "uploads/manga_" in src or "images/manga/" in src:
                        images.append(urljoin(url, src))
                if images:
                    return list(dict.fromkeys(images))
        except Exception:
            pass
        
        # Fallback to Playwright
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        images = []
        # Olympus specific image structure
        for img in soup.find_all("img"):
            src = img.get("src", "").strip().replace(' ', '%20')
            if not src:
                src = img.get("data-src", "").strip().replace(' ', '%20')
                
            if "uploads/manga_" in src or "images/manga/" in src:
                images.append(urljoin(url, src))
                
        # Fallback regex if images are lazy loaded differently
        if not images:
            import re
            img_urls = re.findall(r'https?://[^"\'\s]+\.(?:jpg|png|webp)', html)
            for src in img_urls:
                if "uploads/manga_" in src or "images/manga/" in src:
                    images.append(src)
                    
        # Remove duplicates while preserving order
        return list(dict.fromkeys(images))
