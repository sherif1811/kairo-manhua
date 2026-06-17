import re
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from scrapers.base_scraper import BaseScraper

logger = logging.getLogger("scrapers.geetmark")

class GeetmarkScraper(BaseScraper):
    def scrape_metadata(self, url: str) -> dict:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        # 1. Title
        title = "Unknown"
        title_el = soup.select_one('.anime__details__title h3') or soup.select_one('h3')
        if title_el:
            title = title_el.text.strip()
        else:
            title_tag = soup.find('title')
            if title_tag:
                title_text = title_tag.text
                m = re.search(r'مانهوا\s+(.*?)\s+مترجم', title_text)
                if m:
                    title = m.group(1).strip()
                else:
                    title = title_text.replace("فصول", "").replace("مانهوا", "").replace("مترجم كامل", "").replace("مترجم", "").strip()

        # 2. Cover
        cover_url = ""
        cover_el = soup.select_one('.anime__details__pic')
        if cover_el and cover_el.get('data-setbg'):
            cover_url = urljoin(url, cover_el.get('data-setbg').strip())
            
        # 3. Status
        status = "Ongoing"
        status_li = soup.find(lambda tag: tag.name == "span" and "حالة العمل" in tag.text)
        if status_li and status_li.parent:
            status_text = status_li.parent.text.replace("حالة العمل:", "").strip()
            if "مستمرة" in status_text or "مستمر" in status_text:
                status = "Ongoing"
            elif "مكتمل" in status_text:
                status = "Completed"

        # 4. Description
        description = ""
        desc_p = soup.select_one('.anime__details__text > p')
        if desc_p:
            description = desc_p.text.strip()
            description = re.sub(r'^قصة عمل.*?:', '', description).strip()

        # 5. Genres
        genres = []
        for li in soup.select('.product__item__text ul li'):
            g = li.text.strip()
            if g: genres.append(g)

        # 6. Chapters
        chapters = []
        for a in soup.find_all('a'):
            href = a.get('href')
            text = a.text.strip()
            if href and 'manga-show' in href and 'الفصل' in text:
                # Extract chapter number
                num_match = re.search(r'(\d+(?:\.\d+)?)', text)
                if num_match:
                    num = float(num_match.group(1))
                    if num not in [c['number'] for c in chapters]:
                        chapters.append({
                            "title": text,
                            "url": urljoin(url, href),
                            "number": num,
                            "date": ""
                        })
        
        # Sort chapters descending
        chapters.sort(key=lambda x: x['number'], reverse=True)

        return {
            "title": title,
            "status": status,
            "cover_url": cover_url,
            "description": description,
            "genres": genres,
            "chapters": chapters
        }

    def scrape_chapter_pages(self, url: str) -> list:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        images = []
        
        # Geetmark places chapter images loosely or inside divs near the bottom
        for img in soup.find_all("img"):
            src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
            if not src:
                continue
            src = urljoin(url, src)
            
            # Filter out UI elements
            skip = [".gif", "logo", "banner", "avatar", "icon", "advertisement", "px.gif"]
            if any(kw in src.lower() for kw in skip):
                continue
                
            if src not in images:
                images.append(src)
                
        return images
