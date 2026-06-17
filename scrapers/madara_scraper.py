import re
import json
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper
import logging

logger = logging.getLogger("scrapers.madara")

class MadaraScraper(BaseScraper):
    def scrape_metadata(self, url: str) -> dict:
        from urllib.parse import urljoin
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        title_el = soup.select_one(".post-title h1") or soup.select_one("h1")
        title = title_el.text.strip() if title_el else ""
        if not title:
            og_title = soup.select_one('meta[property="og:title"]')
            title = og_title.get("content", "").strip() if og_title else "Unknown Title"

        cover_el = soup.select_one(".summary_image img")
        cover_url = ""
        if cover_el:
            cover_url = (cover_el.get("data-src") or cover_el.get("data-lazy-src") or cover_el.get("data-setbg") or cover_el.get("src") or "").strip()
            cover_url = urljoin(url, cover_url)
        if not cover_url:
            og_img = soup.select_one('meta[property="og:image"]')
            cover_url = og_img.get("content", "").strip() if og_img else ""
            if cover_url: cover_url = urljoin(url, cover_url)
        
        status = "Unknown"
        status_items = soup.select(".post-status .summary-content")
        if len(status_items) >= 2:
            for item in status_items:
                txt = item.text.strip().lower()
                if txt in ("مستمرة", "مستمر", "ongoing", "completed", "مكتملة", "متوقف", "hiatus", "dropped", "cancelled"):
                    status = item.text.strip()
                    break
            if status == "Unknown":
                status = status_items[-1].text.strip()
        elif status_items:
            status = status_items[0].text.strip()

        # Extract extra metadata
        author = ""
        author_el = soup.select_one(".author-content a")
        if author_el: author = author_el.text.strip()

        artist = ""
        artist_el = soup.select_one(".artist-content a")
        if artist_el: artist = artist_el.text.strip()

        genres = []
        for g in soup.select(".genres-content a"):
            genres.append(g.text.strip())
        genres_str = ", ".join(genres)

        description = ""
        desc_el = soup.select_one(".description-summary .summary__content") or soup.select_one(".summary__content")
        if desc_el:
            description = desc_el.text.strip()

        chapters = []
        ch_list = soup.select("li.wp-manga-chapter")
        for li in ch_list:
            a_tag = li.select_one("a")
            if a_tag and a_tag.get("href"):
                ch_url = urljoin(url, a_tag["href"].strip())
                if ch_url.startswith('#') or ch_url.startswith('javascript'):
                    continue
                # Clean title: just get the text directly inside the anchor, not children
                ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip()
                if not ch_title:
                    ch_title = a_tag.text.strip()
                ch_title = re.sub(r'\s+', ' ', ch_title)
                
                date_span = li.select_one(".chapter-release-date i, .chapter-release-date a, span.post-on, .c-new-tag a")
                ch_date = date_span.text.strip() if date_span else ""
                
                if not any(c['url'] == ch_url for c in chapters):
                    chapters.append({"url": ch_url, "title": ch_title, "date": ch_date})

        # Check for alternative Madara themes (like manga-starz custom theme)
        if not chapters:
            for item in soup.select("div.chapter-item"):
                a_tag = item.select_one("a")
                if a_tag and a_tag.get("href"):
                    ch_url = urljoin(url, a_tag["href"].strip())
                    if ch_url.startswith('#') or ch_url.startswith('javascript'):
                        continue
                    ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip()
                    if not ch_title:
                        ch_title = a_tag.text.strip()
                    ch_title = re.sub(r'\s+', ' ', ch_title)
                    
                    date_span = item.select_one(".chapter-release-date, .post-on")
                    ch_date = date_span.text.strip() if date_span else ""
                    
                    if not any(c['url'] == ch_url for c in chapters):
                        chapters.append({"url": ch_url, "title": ch_title, "date": ch_date})

        if not chapters:
            logger.info(f"MadaraScraper: No li.wp-manga-chapter found. Attempting generic link extraction for {url}")
            holder = soup.select_one("#manga-chapters-holder")
            search_area = holder if holder else soup
            for a_tag in search_area.find_all("a"):
                href = a_tag.get("href", "")
                text = a_tag.text.strip().lower()
                
                is_chapter = False
                if holder:
                    is_chapter = True
                elif href and ("chapter" in href.lower() or "الفصل" in text or "chapter" in text or "ch" in text):
                    is_chapter = True
                    
                if is_chapter and href:
                    if href.startswith('#') or href.startswith('javascript'):
                        continue
                    if "tag" not in href and "category" not in href and href != url and not href.endswith('#'):
                        href = urljoin(url, href)
                        ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip()
                        if not ch_title:
                            ch_title = a_tag.text.strip()
                        
                        # Clean dates mixed in title
                        ch_title = re.sub(r'(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}', '', ch_title, flags=re.IGNORECASE)
                        ch_title = re.sub(r'(?:\d+\s+)?(?:years|months|days|hours|mins|minutes)\s+ago(?:\s+\d+)?', '', ch_title, flags=re.IGNORECASE)
                        ch_title = re.sub(r'\d{4}-\d{2}-\d{2}', '', ch_title)
                        ch_title = re.sub(r'\s+', ' ', ch_title).strip()
                        
                        if ch_title and not any(c['url'] == href for c in chapters):
                            # Try to find a date near it
                            parent = a_tag.parent
                            date_span = parent.select_one(".post-on, i") if parent else None
                            ch_date = date_span.text.strip() if date_span else ""
                            chapters.append({"url": href, "title": ch_title, "date": ch_date})
                            
            wp_manga_div = soup.select_one("#wp-manga-js-extra")
            post_id = None
            if wp_manga_div:
                match = re.search(r'"manga_id":"(\d+)"', html)
                if match:
                    post_id = match.group(1)
            if not post_id:
                rating_div = soup.select_one("#manga-chapters-holder")
                if rating_div:
                    post_id = rating_div.get("data-id", "")
                    
            if post_id:
                logger.info(f"Found post_id: {post_id}. Attempting admin-ajax.php...")
                ajax_url = ""
                ajax_match = re.search(r'"ajax_url":"([^"]+)"', html)
                if ajax_match:
                    ajax_url = ajax_match.group(1).replace("\\/", "/")
                if not ajax_url:
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    ajax_url = f"{parsed.scheme}://{parsed.netloc}/wp-admin/admin-ajax.php"
                    
                try:
                    from curl_cffi import requests as curl_requests
                    scraper = curl_requests.Session(impersonate="chrome110")
                    ajax_data = {"action": "manga_get_chapters", "manga": post_id}
                    ajax_resp = scraper.post(ajax_url, data=ajax_data, timeout=15)
                    if ajax_resp.status_code == 200:
                        ajax_soup = BeautifulSoup(ajax_resp.text, "html.parser")
                        for li in ajax_soup.select("li.wp-manga-chapter"):
                            a_tag = li.select_one("a")
                            if a_tag and a_tag.get("href"):
                                ch_url = urljoin(url, a_tag["href"].strip())
                                if ch_url.startswith('#') or ch_url.startswith('javascript'):
                                    continue
                                ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip()
                                if not ch_title:
                                    ch_title = a_tag.text.strip()
                                ch_title = re.sub(r'\s+', ' ', ch_title)
                                date_span = li.select_one(".chapter-release-date i, .chapter-release-date a, span.post-on, .c-new-tag a")
                                ch_date = date_span.text.strip() if date_span else ""
                                if not any(c['url'] == ch_url for c in chapters):
                                    chapters.append({"url": ch_url, "title": ch_title, "date": ch_date})
                except Exception as e:
                    logger.warning(f"AJAX fallback failed: {e}")
                    
            if not chapters:
                logger.info("Attempting alternative AJAX route (url/ajax/chapters/)...")
                try:
                    from curl_cffi import requests as curl_requests
                    scraper = curl_requests.Session(impersonate="chrome110")
                    ajax_new_url = url.rstrip('/') + '/ajax/chapters/'
                    ajax_resp = scraper.post(ajax_new_url, timeout=15)
                    if ajax_resp.status_code == 200:
                        ajax_soup = BeautifulSoup(ajax_resp.text, "html.parser")
                        for li in ajax_soup.select("li.wp-manga-chapter, div.chapter-item"):
                            a_tag = li.select_one("a")
                            if a_tag and a_tag.get("href"):
                                ch_url = urljoin(url, a_tag["href"].strip())
                                if ch_url.startswith('#') or ch_url.startswith('javascript'):
                                    continue
                                ch_title = "".join(a_tag.find_all(string=True, recursive=False)).strip()
                                if not ch_title:
                                    ch_title = a_tag.text.strip()
                                ch_title = re.sub(r'\s+', ' ', ch_title)
                                date_span = li.select_one(".chapter-release-date i, .chapter-release-date a, span.post-on, .c-new-tag a")
                                ch_date = date_span.text.strip() if date_span else ""
                                if not any(c['url'] == ch_url for c in chapters):
                                    chapters.append({"url": ch_url, "title": ch_title, "date": ch_date})
                except Exception as e:
                    logger.warning(f"Alternative AJAX fallback failed: {e}")

        # Sort chapters by number descending
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
            "cover_url": cover_url, 
            "status": status, 
            "author": author,
            "artist": artist,
            "genres": genres_str,
            "description": description,
            "chapters": chapters
        }


    def scrape_chapter_pages(self, url: str) -> list[str]:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        images = []
        img_tags = (
            soup.select(".reading-content img")
            or soup.select(".page-break img")
            or soup.select(".wp-manga-chapter-img")
        )
        for img in img_tags:
            src = (img.get("data-src") or img.get("data-lazy-src") or img.get("src") or "").strip()
            if src and not "placeholder" in src.lower():
                images.append(src)
        return images
