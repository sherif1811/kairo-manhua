import re
import json
from bs4 import BeautifulSoup
from scrapers.base_scraper import BaseScraper
import logging

logger = logging.getLogger("scrapers.mangatuk")

class MangatukScraper(BaseScraper):
    def scrape_metadata(self, url: str) -> dict:
        from urllib.parse import urljoin
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        # Parse NextJS data
        next_data_script = soup.find("script", id="__NEXT_DATA__")
        if next_data_script:
            try:
                data = json.loads(next_data_script.string)
                props = data.get("props", {}).get("pageProps", {})
                manga_data = props.get("manga", {})
                if not manga_data and "data" in props:
                    manga_data = props["data"]

                if manga_data:
                    title = manga_data.get("title", "")
                    cover = manga_data.get("thumbnail", "") or manga_data.get("cover", "")
                    if cover: cover = urljoin(url, cover)
                    status = manga_data.get("status", "Ongoing")
                    
                    author = manga_data.get("author", "")
                    artist = manga_data.get("artist", "")
                    synopsis = manga_data.get("synopsis", "") or manga_data.get("description", "")
                    
                    genres = []
                    for g in manga_data.get("genres", []):
                        if isinstance(g, dict) and "name" in g:
                            genres.append(g["name"])
                        elif isinstance(g, str):
                            genres.append(g)
                    genres_str = ", ".join(genres)
                    
                    chapters = []
                    raw_chapters = manga_data.get("chapters", [])
                    if not raw_chapters:
                        raw_chapters = props.get("chapters", [])
                        
                    for ch in raw_chapters:
                        ch_slug = ch.get("slug") or ch.get("id") or ch.get("number")
                        if ch_slug:
                            ch_url = f"{url}/{ch_slug}"
                            chapters.append({
                                "url": ch_url,
                                "title": ch.get("title") or ch.get("name") or f"Chapter {ch.get('number')}"
                            })
                    
                    if title and chapters:
                        return {
                            "title": title, 
                            "cover_url": cover, 
                            "status": status, 
                            "author": author,
                            "artist": artist,
                            "genres": genres_str,
                            "description": synopsis,
                            "chapters": chapters
                        }
            except Exception as e:
                logger.error(f"Failed to parse NEXT_DATA for Mangatuk: {e}")

        # Fallback to generic parsing if NEXT_DATA fails
        title_el = soup.find("h1")
        title = title_el.text.strip() if title_el else "Unknown Title"
        
        # Generic extractions
        author = ""
        genres_str = ""
        description = ""
        
        chapters = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/chapter/" in href or re.search(r'/\d+$', href):
                href = urljoin(url, href)
                if not any(c['url'] == href for c in chapters):
                    chapters.append({"url": href, "title": a.text.strip()})
                    
        return {
            "title": title, 
            "status": "Ongoing",
            "author": author,
            "artist": "",
            "genres": genres_str,
            "description": description,
            "chapters": chapters
        }

    def scrape_chapter_pages(self, url: str) -> list[str]:
        html = self.fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        
        next_data_script = soup.find("script", id="__NEXT_DATA__")
        images = []
        if next_data_script:
            try:
                data = json.loads(next_data_script.string)
                props = data.get("props", {}).get("pageProps", {})
                chapter_data = props.get("chapter", {})
                if chapter_data and "images" in chapter_data:
                    for img in chapter_data["images"]:
                        if isinstance(img, dict) and "url" in img:
                            images.append(img["url"])
                        elif isinstance(img, str):
                            images.append(img)
            except Exception as e:
                logger.error(f"Failed to parse NEXT_DATA images for Mangatuk: {e}")
                
        if not images:
            for img in soup.select("img"):
                src = img.get("src") or img.get("data-src")
                if src and src.startswith("http") and "logo" not in src.lower():
                    images.append(src)
        return images
