#!/usr/bin/env python3
"""
محرك السحب الشامل والذكي (Global Scraper Engine)
- يتخطى حماية Cloudflare باستخدام curl_cffi
- يدعم استخراج المانجا من أي موقع تقريباً (Madara, MangaStream, etc.)
- يقوم بترتيب الفصول رياضياً
- يدعم التخزين الهجين (Hybrid Storage): سحب أول 5 فصول محلياً، والاحتفاظ بروابط الباقي.
"""

import sys, os, json, time, hashlib, re, traceback
from bs4 import BeautifulSoup

try:
    from curl_cffi import requests
except ImportError:
    print("يرجى تثبيت curl_cffi: pip install curl_cffi")
    sys.exit(1)

# مسارات التخزين
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
DATA_DIR = os.path.join(BASE_DIR, "mangas_data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)


# ==========================================
# 1. Cloudflare Bypasser & HTTP Client
# ==========================================
class CloudflareBypasser:
    def __init__(self):
        # استخدام بصمة متصفح كروم حقيقية لتخطي Cloudflare
        self.session = requests.Session(impersonate="chrome110")
        self.headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
            "Upgrade-Insecure-Requests": "1"
        }

    def get_html(self, url):
        try:
            resp = self.session.get(url, headers=self.headers, timeout=30)
            if resp.status_code == 200:
                return resp.text
            else:
                print(f"[Error] HTTP {resp.status_code} for {url}")
                return None
        except Exception as e:
            print(f"[Error] Failed to fetch {url}: {e}")
            return None

    def download_image(self, img_url, save_path, compress=True):
        """تحميل الصورة وتطبيق الضغط إذا طلب"""
        try:
            resp = self.session.get(img_url, headers={"Referer": img_url}, timeout=20)
            if resp.status_code == 200:
                data = resp.content
                if compress:
                    data = self._compress_image(data)
                
                # تأكد من وجود المجلد
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(data)
                return True
            return False
        except Exception as e:
            print(f"[Warning] Failed to download image {img_url}: {e}")
            return False

    def _compress_image(self, img_bytes, quality=80, max_width=1200):
        try:
            from PIL import Image
            from io import BytesIO
            img = Image.open(BytesIO(img_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            w, h = img.size
            if w > max_width:
                ratio = max_width / w
                img = img.resize((max_width, int(h * ratio)), Image.LANCZOS)
            buf = BytesIO()
            img.save(buf, "JPEG", quality=quality, optimize=True)
            img.close()
            return buf.getvalue()
        except Exception:
            return img_bytes  # إذا فشل الضغط، أرجع الصورة الأصلية


# ==========================================
# 2. Theme Detector & Extractors
# ==========================================
class GlobalExtractor:
    def __init__(self, bypasser):
        self.bypasser = bypasser

    def detect_theme(self, soup):
        if soup.find(class_=re.compile("wp-manga")):
            return "madara"
        if soup.find(class_="eplister") or soup.find(id="chapterlist"):
            return "mangastream"
        return "generic"

    def extract_metadata(self, soup, url):
        # محاولة استخراج العنوان
        title = ""
        title_tag = soup.find("h1") or soup.find(class_="post-title")
        if title_tag:
            title = title_tag.get_text(strip=True)
        else:
            title = soup.title.string.split("-")[0].strip() if soup.title else "Unknown"

        # محاولة استخراج الغلاف
        cover = ""
        cover_tag = soup.find(class_="summary_image") or soup.find(class_="thumb")
        if cover_tag:
            img = cover_tag.find("img")
            if img:
                cover = img.get("data-src") or img.get("src") or ""
        if not cover:
            # Generic og:image
            og = soup.find("meta", property="og:image")
            if og: cover = og.get("content", "")

        return {
            "title": title,
            "cover": cover,
            "synopsis": "", # يمكن تطويره لاحقاً
            "genres": [],
            "status": "مستمرة",
            "url": url
        }

    def extract_chapters(self, soup, theme):
        chapters = []
        links = []
        
        if theme == "madara":
            links = soup.select("li.wp-manga-chapter a")
        elif theme == "mangastream":
            links = soup.select("div.eplister ul li a, #chapterlist ul li a")
        else:
            # Generic: Search for any link containing chapter indicators
            for a in soup.find_all("a", href=True):
                text = a.get_text().lower()
                href = a["href"].lower()
                if re.search(r"(chapter|ch|فصل)-?\s*\d+", text) or re.search(r"(chapter|ch)-?\d+", href):
                    links.append(a)

        # إزالة التكرارات واستخراج الأرقام للترتيب
        seen_urls = set()
        for a in links:
            href = a["href"]
            if href in seen_urls or href == "#": continue
            seen_urls.add(href)
            
            title = a.get_text(strip=True)
            # محاولة العثور على رقم الفصل رياضياً
            num_match = re.search(r"(?:chapter|ch|فصل)[^\d]*(\d+(?:\.\d+)?)", title.lower() + " " + href.lower())
            number = float(num_match.group(1)) if num_match else 0
            
            chapters.append({
                "title": title,
                "url": href,
                "number": number
            })

        # فرز الفصول تصاعدياً (من 1 إلى الأخير) لضمان عدم وجود فصول ناقصة
        chapters.sort(key=lambda x: x["number"])
        return chapters

    def extract_images(self, chapter_url, theme):
        html = self.bypasser.get_html(chapter_url)
        if not html: return []
        soup = BeautifulSoup(html, "html.parser")
        images = []

        if theme == "madara":
            imgs = soup.select("div.reading-content img")
        elif theme == "mangastream":
            imgs = soup.select("div#readerarea img")
        else:
            # Generic: Search for images inside likely containers
            container = soup.find(class_=re.compile("reader|reading|content|chapter", re.I))
            imgs = container.find_all("img") if container else soup.find_all("img")

        for img in imgs:
            src = img.get("data-src") or img.get("src") or img.get("data-lazy-src")
            if src and not src.endswith(".gif"):
                images.append(src.strip())
        
        return images


# ==========================================
# 3. Global Scraper Engine (Main)
# ==========================================
class GlobalScraperEngine:
    def __init__(self):
        self.bypasser = CloudflareBypasser()
        self.extractor = GlobalExtractor(self.bypasser)

    def update_index(self, manga_id, meta):
        idx = []
        if os.path.exists(INDEX_FILE):
            try:
                with open(INDEX_FILE, "r", encoding="utf-8") as f:
                    idx = json.load(f)
            except: pass
        
        found = False
        for m in idx:
            if str(m.get("id")) == str(manga_id):
                m.update(meta)
                found = True
                break
        if not found:
            entry = {"id": manga_id, "chapters": []}
            entry.update(meta)
            idx.append(entry)
            
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump(idx, f, ensure_ascii=False, indent=2)

    def run(self, manga_url):
        print(f"[*] البدء في تحليل الموقع: {manga_url}")
        html = self.bypasser.get_html(manga_url)
        if not html:
            print("[-] فشل الوصول للموقع (قد تكون الحماية قوية جداً).")
            return

        soup = BeautifulSoup(html, "html.parser")
        theme = self.extractor.detect_theme(soup)
        print(f"[*] تم التعرف على القالب: {theme}")

        meta = self.extractor.extract_metadata(soup, manga_url)
        print(f"[*] اسم المانجا: {meta['title']}")

        # إنشاء ID فريد
        manga_id = hashlib.md5(manga_url.encode()).hexdigest()[:10]
        self.update_index(manga_id, meta)

        chapters = self.extractor.extract_chapters(soup, theme)
        total_chaps = len(chapters)
        print(f"[*] تم العثور على {total_chaps} فصل.")
        if total_chaps == 0: return

        # ---------------------------------------------------------
        # Hybrid Storage Logic (أول 5 فصول حفظ محلي + الباقي روابط)
        # ---------------------------------------------------------
        final_chapters = []
        for i, ch in enumerate(chapters):
            print(f"  -> جاري معالجة الفصل {ch['number']} ({i+1}/{total_chaps})...")
            images_urls = self.extractor.extract_images(ch["url"], theme)
            
            final_images = []
            
            # إذا كان من أول 5 فصول -> تحميل الصور للسيرفر
            if i < 5:
                for img_idx, img_url in enumerate(images_urls):
                    filename = f"ch_{ch['number']}_{img_idx+1}.jpg"
                    save_path = os.path.join(IMAGES_DIR, manga_id, filename)
                    
                    if not os.path.exists(save_path):
                        self.bypasser.download_image(img_url, save_path, compress=True)
                    
                    # حفظ الرابط المحلي
                    final_images.append(f"/mangas_data/images/{manga_id}/{filename}")
            else:
                # الفصول الباقية -> حفظ الرابط الأصلي (Hotlink)
                final_images = images_urls

            ch_entry = {
                "id": f"ch_{ch['number']}_{i}",
                "title": ch["title"],
                "number": ch["number"],
                "url": ch["url"],
                "date": str(time.time()),
                "images": final_images
            }
            final_chapters.append(ch_entry)
            
            # تفريغ الذاكرة
            time.sleep(1) 

        # حفظ البيانات النهائية
        data_file = os.path.join(DATA_DIR, f"{manga_id}.json")
        with open(data_file, "w", encoding="utf-8") as f:
            json.dump({
                "id": manga_id,
                "title": meta["title"],
                "chapters": final_chapters,
                "updated_at": time.time()
            }, f, ensure_ascii=False, indent=2)
            
        print(f"[+] تمت العملية بنجاح! تم دمج المانجا في قاعدة البيانات برمز: {manga_id}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("الاستخدام: python global_scraper.py <رابط_المانجا>")
        sys.exit(1)
    
    url = sys.argv[1]
    engine = GlobalScraperEngine()
    engine.run(url)
