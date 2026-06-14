import time
import random
import logging
from bs4 import BeautifulSoup
import cloudscraper
from playwright.sync_api import sync_playwright

logger = logging.getLogger("scrapers.base")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
]

class BaseScraper:
    """Base class for all extractors, providing anti-ban mechanisms."""

    def __init__(self):
        pass

    def _get_random_user_agent(self):
        return random.choice(USER_AGENTS)

    def fetch_html(self, url: str) -> str:
        """Fetch HTML content with Cloudscraper, falling back to Playwright on failure."""
        user_agent = self._get_random_user_agent()
        logger.info(f"Fetching {url} with cloudscraper (UA: {user_agent})")
        
        try:
            scraper = cloudscraper.create_scraper()
            response = scraper.get(url, headers={"User-Agent": user_agent}, timeout=15)
            
            if response.status_code in (200, 201, 304):
                return response.text
            else:
                logger.warning(f"Cloudscraper returned status {response.status_code}. Engaging Playwright fallback.")
        except Exception as e:
            logger.warning(f"Cloudscraper failed: {e}. Engaging Playwright fallback.")
        
        return self._fetch_with_playwright(url, user_agent)

    def _fetch_with_playwright(self, url: str, user_agent: str) -> str:
        """Fallback method using Playwright headless browser."""
        logger.info(f"Playwright fetching {url}...")
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(user_agent=user_agent)
                page = context.new_page()
                
                from playwright_stealth import Stealth
                Stealth().apply_stealth_sync(page)
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                
                # Attempt to solve Cloudflare Turnstile if present
                try:
                    page.wait_for_timeout(3000)
                    iframe = page.frame_locator('iframe[src*="challenges.cloudflare.com"]')
                    checkbox = iframe.locator('.cb-tc, input[type="checkbox"]')
                    if checkbox.count() > 0:
                        logger.info("Cloudflare Turnstile found! Attempting to click...")
                        checkbox.click()
                        page.wait_for_timeout(5000)
                except Exception as cf_e:
                    logger.info(f"No Turnstile clicked: {cf_e}")
                    
                # Wait for actual content to bypass CF
                try:
                    page.wait_for_selector(".post-title, #manga-chapters-holder, .summary_image", timeout=15000)
                except Exception:
                    logger.warning(f"Could not find Manga content, possibly still blocked by Cloudflare. URL: {url}")
                
                # Intelligent delay to allow JS rendering & Cloudflare bypass
                page.wait_for_timeout(5000)
                
                # Scroll down as a human to trigger lazy-loaded chapters
                try:
                    logger.info("Scrolling down to trigger native chapter loading...")
                    page.evaluate("""
                        const scrollInterval = setInterval(() => {
                            window.scrollBy(0, window.innerHeight);
                        }, 500);
                        setTimeout(() => clearInterval(scrollInterval), 5000);
                    """)
                    page.wait_for_timeout(5000)
                except Exception as scroll_e:
                    logger.warning(f"Failed to scroll: {scroll_e}")
                
                # Wait for Native AJAX to populate the chapters (e.g. Manga-Starz)
                try:
                    page.wait_for_selector("li.wp-manga-chapter, div.chapter-item", timeout=15000)
                    logger.info("Chapters loaded natively by the page scripts.")
                except Exception:
                    pass
                
                # Auto-fetch Madara chapters if they load via AJAX and native script failed
                try:
                    import re
                    temp_html = page.content()
                    
                    if "wp-manga-chapter" not in temp_html and "chapter-item" not in temp_html:
                        post_id = None
                        m1 = re.search(r'data-id="(\d+)"', temp_html)
                        m2 = re.search(r'"manga_id":"(\d+)"', temp_html)
                        m3 = re.search(r'postid-(\d+)', temp_html)
                        if m1: post_id = m1.group(1)
                        elif m2: post_id = m2.group(1)
                        elif m3: post_id = m3.group(1)
                    
                    if post_id:
                        page.evaluate(f"""
                            async () => {{
                                const holder = document.querySelector("#manga-chapters-holder");
                                if (holder && (!holder.innerHTML.trim() || holder.innerHTML.includes("fa-spinner"))) {{
                                    const ajax_url = window.ajaxurl || '/wp-admin/admin-ajax.php';
                                    try {{
                                        const response = await fetch(ajax_url, {{
                                            method: 'POST',
                                            headers: {{
                                                'Content-Type': 'application/x-www-form-urlencoded',
                                                'X-Requested-With': 'XMLHttpRequest'
                                            }},
                                            body: 'action=manga_get_chapters&manga={post_id}'
                                        }});
                                        if(response.ok) {{
                                            let text = await response.text();
                                            if (text === '0' || text === '') {{
                                                const alt_resp = await fetch(window.location.href.split('?')[0].replace(/\/$/, '') + '/ajax/chapters/', {{ method: 'POST' }});
                                                if(alt_resp.ok) {{ text = await alt_resp.text(); }}
                                            }}
                                            try {{
                                                const json = JSON.parse(text);
                                                if (json.data) text = json.data;
                                                else if (json.html) text = json.html;
                                            }} catch(e) {{}}
                                            holder.innerHTML = text;
                                        }}
                                    }} catch (e) {{
                                        console.error(e);
                                    }}
                                }}
                            }}
                        """)
                        # Wait an extra second for DOM to update
                        page.wait_for_timeout(1000)
                except Exception as eval_e:
                    logger.warning(f"JS AJAX evaluation failed: {eval_e}")
                    
                content = page.content()
                browser.close()
                return content
        except Exception as e:
            logger.error(f"Playwright fallback failed for {url}: {e}")
            raise RuntimeError(f"All scraping methods failed for {url}: {e}")

    def scrape_metadata(self, url: str) -> dict:
        """Extract manga title, cover, and chapters. Must be implemented by subclass."""
        raise NotImplementedError()

    def scrape_chapter_pages(self, url: str) -> list[str]:
        """Extract list of image URLs from a chapter page. Must be implemented by subclass."""
        raise NotImplementedError()
