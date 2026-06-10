import sys
import os
import re
import json
import argparse
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import cloudscraper
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

# Output database file
OUTPUT_FILE = "scraped_mangas.json"

def clean_filename(name):
    return re.sub(r'[\\/*?:"<>|]', "", name)

COVERS_DIR = "covers"

def ensure_covers_dir():
    os.makedirs(COVERS_DIR, exist_ok=True)

def download_image(url, filepath):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            with open(filepath, 'wb') as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"    [WARN] Failed to download {url}: {e}")
        return False

def extract_banner_url(soup):
    banner = ""
    bg_div = soup.select_one('.background-image')
    if bg_div:
        style = bg_div.get('style', '')
        m = re.search(r'url\([\'"]?([^\'"]+)[\'"]?\)', style)
        if m:
            banner = m.group(1)
    if not banner:
        og_img = soup.select_one('meta[property="og:image"]')
        if og_img:
            banner = og_img.get('content', '')
    if not banner:
        tw_img = soup.select_one('meta[name="twitter:image"]')
        if tw_img:
            banner = tw_img.get('content', '')
    return banner

def parse_args():
    parser = argparse.ArgumentParser(description="تحميل المنهوا والمانجا من موقع LekManga وتلقيمها للموقع")
    parser.add_argument("url", help="رابط المانجا من LekManga (مثال: https://lekmanga.site/manga/absolute-sword-sense/)")
    parser.add_argument("--cookie", help="قيمة ملف تعريف الارتباط cf_clearance لتخطي جدار الحماية (إذا طلب الموقع التحقق)")
    parser.add_argument("--user-agent", help="قيمة الـ User-Agent الخاصة بمتصفحك المقترنة بالـ Cookie")
    parser.add_argument("--threads", type=int, default=8, help="عدد خيوط المعالجة المتوازية لتسريع التحميل")
    return parser.parse_args()

def scrape_chapter_pages(scraper, chap_url, cookie, ua):
    """جلب صفحات الصور لفصل معين"""
    headers = {}
    if cookie:
        headers['Cookie'] = f'cf_clearance={cookie}'
    if ua:
        headers['User-Agent'] = ua

    try:
        r = scraper.get(chap_url, headers=headers, timeout=15)
        if r.status_code != 200:
            return None
        
        soup = BeautifulSoup(r.text, 'html.parser')
        images = []
        
        # Madara theme image selectors (.reading-content img or .page-break img)
        img_tags = soup.select('.reading-content img') or soup.select('.page-break img') or soup.select('.wp-manga-chapter-img')
        
        for img in img_tags:
            # Check lazy loading attributes first
            src = img.get('data-src') or img.get('data-lazy-src') or img.get('src')
            if src:
                src = src.strip()
                # Exclude placeholders
                if "placeholder" not in src.lower() and src.startswith("http"):
                    images.append(src)
        
        return images
    except Exception as e:
        print(f"Error fetching chapter pages for {chap_url}: {e}")
        return None

def main():
    args = parse_args()
    
    url = args.url
    if not url.endswith('/'):
        url += '/'
        
    # Extract slug
    match = re.search(r'/manga/([^/]+)/', url)
    if not match:
        print("[-] خطأ: رابط المانجا غير صحيح. يرجى إدخال رابط يبدأ بـ https://lekmanga.site/manga/")
        return
    
    manga_slug = match.group(1)
    manga_id = f"lek_{manga_slug}"
    
    # Initialize cloudscraper
    scraper = cloudscraper.create_scraper()
    
    headers = {}
    if args.cookie:
        headers['Cookie'] = f'cf_clearance={args.cookie}'
        print(f"[+] تم تطبيق ملف الـ Cookie: cf_clearance={args.cookie[:10]}...")
    if args.user_agent:
        headers['User-Agent'] = args.user_agent
        print(f"[+] تم تطبيق الـ User-Agent: {args.user_agent[:40]}...")
    else:
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        
    print(f"[+] جاري جلب تفاصيل المنهوا من الرابط: {url}")
    
    try:
        r = scraper.get(url, headers=headers, timeout=15)
        if r.status_code == 403:
            print("[-] خطأ 403: لقد تم حظرك بواسطة Cloudflare.")
            print("    لتجاوز هذا الحظر، يرجى فتح الموقع في متصفحك ونسخ الـ cf_clearance و User-Agent وتشغيل الأمر هكذا:")
            print("    python import_from_lek.py <url> --cookie <قيمة_الكوكي> --user-agent \"<بيانات_المتصفح>\"")
            return
        elif r.status_code != 200:
            print(f"[-] خطأ في الاتصال بالموقع: رمز الحالة {r.status_code}")
            return
    except Exception as e:
        print(f"[-] خطأ في الاتصال بالشبكة: {e}")
        return
        
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # 1. Title
    title = ""
    title_box = soup.select_one('.post-title h1') or soup.select_one('h1')
    if title_box:
        title = title_box.text.strip()
    else:
        title = manga_slug.replace('-', ' ').title()
        
    print(f"[+] تم العثور على العنوان: {title}")
    
    # 2. Cover Image
    cover = ""
    cover_box = soup.select_one('.summary_image img')
    if cover_box:
        cover = cover_box.get('data-src') or cover_box.get('data-lazy-src') or cover_box.get('src') or ""
        cover = cover.strip()
    
    # Banner
    banner = extract_banner_url(soup)
        
    # 3. Synopsis
    synopsis = ""
    syn_box = soup.select_one('.summary__content') or soup.select_one('.description-summary') or soup.select_one('.manga-excerpt')
    if syn_box:
        synopsis = syn_box.text.strip()
        
    # 4. Author & Alternative Title & Status
    alternative = ""
    author = "غير معروف"
    status = "مستمر"
    
    # Madara detail rows usually have class .post-content_item
    items = soup.select('.post-content_item')
    for item in items:
        text = item.text.strip()
        if "الاسم البديل" in text or "Alternative" in text:
            val_box = item.select_one('.summary-content')
            if val_box:
                alternative = val_box.text.strip()
        elif "المؤلف" in text or "Author" in text:
            val_box = item.select_one('.author-content') or item.select_one('.summary-content')
            if val_box:
                author = val_box.text.strip()
        elif "الحالة" in text or "Status" in text:
            val_box = item.select_one('.summary-content')
            if val_box:
                status = val_box.text.strip()
                
    # 5. Genres
    genres = []
    genre_links = soup.select('.genres-content a')
    for g in genre_links:
        genres.append(g.text.strip())
    if not genres:
        genres = ["منهوا", "أكشن", "خيال"]
        
    # 6. Chapters List
    chapters_raw = []
    chapter_elements = soup.select('li.wp-manga-chapter')
    
    if chapter_elements:
        print(f"[+] تم العثور على {len(chapter_elements)} فصل مباشرة في صفحة HTML.")
        for el in chapter_elements:
            a = el.find('a')
            if a:
                chapters_raw.append((a.text.strip(), a['href']))
    else:
        # Fallback to AJAX
        print("[*] جاري البحث عن رقم تعريف المانجا لجلب الفصول عبر AJAX...")
        manga_id_match = re.search(r'manga-id-(\d+)', r.text) or re.search(r'post_id\s*=\s*\"?(\d+)\"?', r.text) or re.search(r'id=\"wp-manga-bookmark-([^\"]+)\"', r.text)
        if not manga_id_match:
            manga_id_match = re.search(r'data-id=\"(\d+)\"', r.text)
            
        if manga_id_match:
            m_id = manga_id_match.group(1)
            print(f"[+] تم العثور على معرف المانجا: {m_id}. جاري الاتصال بخدمة AJAX...")
            
            ajax_url = 'https://lekmanga.site/wp-admin/admin-ajax.php'
            try:
                ajax_res = scraper.post(ajax_url, data={
                    'action': 'manga_get_chapters',
                    'manga': m_id
                }, headers=headers, timeout=15).text
                ajax_soup = BeautifulSoup(ajax_res, 'html.parser')
                ajax_chaps = ajax_soup.select('li.wp-manga-chapter')
                print(f"[+] تم جلب {len(ajax_chaps)} فصل بنجاح عبر AJAX.")
                for el in ajax_chaps:
                    a = el.find('a')
                    if a:
                        chapters_raw.append((a.text.strip(), a['href']))
            except Exception as ajax_err:
                print(f"[-] فشل اتصال AJAX: {ajax_err}")
        else:
            print("[-] لم يتم العثور على رقم تعريف المانجا في الصفحة.")
            
    if not chapters_raw:
        print("[-] خطأ: لم يتم العثور على أي فصول لهذه المانجا. تأكد من توفر الفصول في الموقع.")
        return
        
    print(f"[+] جاري جلب صفحات الفصول بالتوازي باستخدام {args.threads} خيوط معالجة...")
    
    # Process chapters
    chapters = []
    
    # Helper for thread mapping
    def process_chapter_task(idx, chap_name, chap_url):
        # Extract number
        num_match = re.search(r'الفصل\s*([\d.]+)', chap_name) or re.search(r'chapter\s*([\d.]+)', chap_name, re.IGNORECASE) or re.search(r'([\d.]+)', chap_name)
        c_id = num_match.group(1) if num_match else str(idx + 1)
        
        images = scrape_chapter_pages(scraper, chap_url, args.cookie, args.user_agent)
        return {
            "id": c_id,
            "title": chap_name,
            "date": "2026-06-09",
            "images": images or []
        }

    completed = 0
    total_chapters = len(chapters_raw)
    
    # Scrape parallelly
    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        futures = {executor.submit(process_chapter_task, idx, name, url): idx for idx, (name, url) in enumerate(chapters_raw)}
        
        for future in as_completed(futures):
            idx = futures[future]
            try:
                res = future.result()
                if res and res["images"]:
                    chapters.append(res)
                    completed += 1
                    print(f" -> تم تحميل {res['title']} ({len(res['images'])} صفحة) [{completed}/{total_chapters}]")
                else:
                    print(f" -> فشل تحميل صفحات {chapters_raw[idx][0]} (ربما تم حظره أو لا توجد صور)")
            except Exception as exc:
                print(f" -> خطأ في تحميل الفصل {chapters_raw[idx][0]}: {exc}")

    if not chapters:
        print("[-] خطأ: لم يتم تحميل أي صفحات فصول بنجاح.")
        return
        
    # Download cover and banner locally
    ensure_covers_dir()
    local_cover = ""
    local_banner = ""
    if cover:
        cover_ext = os.path.splitext(urllib.parse.urlsplit(cover).path)[1] or ".jpg"
        cover_path = os.path.join(COVERS_DIR, f"{manga_id}_cover{cover_ext}")
        if download_image(cover, cover_path):
            local_cover = f"/{COVERS_DIR}/{manga_id}_cover{cover_ext}"
            print(f"[+] تم تحميل الغلاف محلياً: {local_cover}")
    if banner:
        banner_ext = os.path.splitext(urllib.parse.urlsplit(banner).path)[1] or ".jpg"
        banner_path = os.path.join(COVERS_DIR, f"{manga_id}_banner{banner_ext}")
        if download_image(banner, banner_path):
            local_banner = f"/{COVERS_DIR}/{manga_id}_banner{banner_ext}"
            print(f"[+] تم تحميل الخلفية محلياً: {local_banner}")

    # Sort chapters descending (latest first)
    chapters.sort(key=lambda x: float(x["id"]) if x["id"].replace('.','',1).isdigit() else 0, reverse=True)
    
    # Construct final manga object
    manga_obj = {
        "id": manga_id,
        "title": title,
        "alternative": alternative or title,
        "author": author,
        "cover": local_cover or cover or "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500",
        "banner": local_banner or banner or "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80",
        "rating": 4.9,
        "status": status,
        "type": "منهوا",
        "views": 1500,
        "genres": genres,
        "synopsis": synopsis or "لا يوجد وصف لهذه المنهوا حالياً.",
        "chapters": chapters
    }
    
    # Save to scraped_mangas.json database
    scraped_db = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            scraped_db = []
            
    # Remove old entry if exists
    scraped_db = [m for m in scraped_db if m["id"] != manga_id]
    scraped_db.append(manga_obj)
    
    # Save back
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(scraped_db, f, ensure_ascii=False, indent=2)
        print(f"\n[+] نجاح! تم حفظ وتلقيم منهوا '{title}' بنجاح بمجموع {len(chapters)} فصول.")
        print(f"[+] سيتم تحميل المنهوا تلقائياً في واجهة الموقع بمجرد إعادة تشغيل المتصفح/تحديث الصفحة.")
    except Exception as save_err:
        print(f"[-] خطأ أثناء حفظ قاعدة البيانات: {save_err}")

if __name__ == "__main__":
    main()
