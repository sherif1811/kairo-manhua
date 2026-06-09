import sys
import os
import re
import json
import argparse
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import cloudscraper
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_FILE = "scraped_mangas.json"

def parse_args():
    parser = argparse.ArgumentParser(description="سحب كتالوج المنهوا بالكامل من موقع LekManga")
    parser.add_argument("--cookie", help="قيمة ملف cf_clearance لتخطي جدار الحماية")
    parser.add_argument("--user-agent", help="قيمة الـ User-Agent الخاصة بمتصفحك المقترنة بالـ Cookie")
    parser.add_argument("--pages", type=int, default=3, help="عدد صفحات الكتالوج التي ترغب في سحبها (كل صفحة بها حوالي 18 إلى 20 منهوا)")
    parser.add_argument("--threads", type=int, default=8, help="عدد خيوط المعالجة المتوازية لتسريع تحميل فصول المنهوا الواحدة")
    parser.add_argument("--delay", type=float, default=2.0, help="فترة الانتظار بالثواني بين سحب كل منهوا وأخرى لتجنب الحظر")
    parser.add_argument("--force", action="store_true", help="إجبار السحب حتى لو كانت المنهوا مسحوبة مسبقاً")
    return parser.parse_args()

def scrape_chapter_pages(scraper, chap_url, cookie, ua):
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
        img_tags = soup.select('.reading-content img') or soup.select('.page-break img') or soup.select('.wp-manga-chapter-img')
        
        for img in img_tags:
            src = img.get('data-src') or img.get('data-lazy-src') or img.get('src')
            if src:
                src = src.strip()
                if "placeholder" not in src.lower() and src.startswith("http"):
                    images.append(src)
        return images
    except Exception:
        return None

def scrape_manga_detail(scraper, url, cookie, ua, threads):
    """سحب تفاصيل منهوا كاملة وفصولها"""
    headers = {}
    if cookie:
        headers['Cookie'] = f'cf_clearance={cookie}'
    if ua:
        headers['User-Agent'] = ua
    else:
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    r = scraper.get(url, headers=headers, timeout=15)
    if r.status_code != 200:
        return None, f"HTTP Error {r.status_code}"
        
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # 1. Title
    title = ""
    title_box = soup.select_one('.post-title h1') or soup.select_one('h1')
    if title_box:
        title = title_box.text.strip()
    else:
        return None, "Title not found"
    
    # 2. Cover Image
    cover = ""
    cover_box = soup.select_one('.summary_image img')
    if cover_box:
        cover = cover_box.get('data-src') or cover_box.get('data-lazy-src') or cover_box.get('src') or ""
        cover = cover.strip()
        
    # 3. Synopsis
    synopsis = ""
    syn_box = soup.select_one('.summary__content') or soup.select_one('.description-summary') or soup.select_one('.manga-excerpt')
    if syn_box:
        synopsis = syn_box.text.strip()
        
    # 4. Author & Alternative Title & Status
    alternative = ""
    author = "غير معروف"
    status = "مستمر"
    
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
        for el in chapter_elements:
            a = el.find('a')
            if a:
                chapters_raw.append((a.text.strip(), a['href']))
    else:
        manga_id_match = re.search(r'manga-id-(\d+)', r.text) or re.search(r'post_id\s*=\s*\"?(\d+)\"?', r.text) or re.search(r'id=\"wp-manga-bookmark-([^\"]+)\"', r.text)
        if not manga_id_match:
            manga_id_match = re.search(r'data-id=\"(\d+)\"', r.text)
            
        if manga_id_match:
            m_id = manga_id_match.group(1)
            ajax_url = 'https://lekmanga.site/wp-admin/admin-ajax.php'
            try:
                ajax_res = scraper.post(ajax_url, data={
                    'action': 'manga_get_chapters',
                    'manga': m_id
                }, headers=headers, timeout=15).text
                ajax_soup = BeautifulSoup(ajax_res, 'html.parser')
                ajax_chaps = ajax_soup.select('li.wp-manga-chapter')
                for el in ajax_chaps:
                    a = el.find('a')
                    if a:
                        chapters_raw.append((a.text.strip(), a['href']))
            except Exception:
                pass
            
    if not chapters_raw:
        return None, "No chapters found"
        
    # Process chapters in parallel
    chapters = []
    
    def process_chapter_task(idx, chap_name, chap_url):
        num_match = re.search(r'الفصل\s*([\d.]+)', chap_name) or re.search(r'chapter\s*([\d.]+)', chap_name, re.IGNORECASE) or re.search(r'([\d.]+)', chap_name)
        c_id = num_match.group(1) if num_match else str(idx + 1)
        
        images = scrape_chapter_pages(scraper, chap_url, cookie, ua)
        return {
            "id": c_id,
            "title": chap_name,
            "date": "2026-06-09",
            "images": images or []
        }

    with ThreadPoolExecutor(max_workers=threads) as executor:
        futures = {executor.submit(process_chapter_task, idx, name, url): idx for idx, (name, url) in enumerate(chapters_raw)}
        for future in as_completed(futures):
            try:
                res = future.result()
                if res and res["images"]:
                    chapters.append(res)
            except Exception:
                pass

    if not chapters:
        return None, "All chapters failed to download pages"
        
    chapters.sort(key=lambda x: float(x["id"]) if x["id"].replace('.','',1).isdigit() else 0, reverse=True)
    
    # Extract slug
    match = re.search(r'/manga/([^/]+)/', url)
    manga_slug = match.group(1) if match else str(time.time())
    manga_id = f"lek_{manga_slug}"

    manga_obj = {
        "id": manga_id,
        "title": title,
        "alternative": alternative or title,
        "author": author,
        "cover": cover or "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500",
        "banner": "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200",
        "rating": 4.9,
        "status": status,
        "type": "منهوا",
        "views": 1500 + len(chapters) * 10,
        "genres": genres,
        "synopsis": synopsis or "لا يوجد وصف لهذه المنهوا حالياً.",
        "chapters": chapters
    }
    return manga_obj, None

def main():
    args = parse_args()
    
    # Load existing database
    scraped_db = []
    scraped_ids = set()
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
                scraped_ids = {m["id"] for m in scraped_db}
                print(f"[+] تم تحميل قاعدة البيانات الحالية: بها {len(scraped_db)} منهوا مسحوبة.")
        except Exception:
            pass

    # Initialize scraper
    scraper = cloudscraper.create_scraper()
    headers = {}
    if args.cookie:
        headers['Cookie'] = f'cf_clearance={args.cookie}'
    if args.user_agent:
        headers['User-Agent'] = args.user_agent
    else:
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    # Discover Manga URLs from catalog pages
    manga_urls = []
    print(f"\n[*] جاري اكتشاف روابط المنهوا من صفحات الكتالوج (الصفحات: 1 إلى {args.pages})...")
    
    for p in range(1, args.pages + 1):
        catalog_url = f"https://lekmanga.site/manga/page/{p}/" if p > 1 else "https://lekmanga.site/manga/"
        print(f" -> جاري قراءة الكتالوج صفحة {p}: {catalog_url}")
        try:
            r = scraper.get(catalog_url, headers=headers, timeout=15)
            if r.status_code == 403:
                print("[-] خطأ 403: لقد تم حظرك بواسطة جدار الحماية Cloudflare. يرجى توفير الـ Cookie والـ User-Agent.")
                return
            elif r.status_code != 200:
                print(f"[-] فشل الاتصال بالكتالوج صفحة {p}: رمز الحالة {r.status_code}")
                continue
                
            soup = BeautifulSoup(r.text, 'html.parser')
            page_links = 0
            for a in soup.find_all('a', href=True):
                href = a['href']
                if 'lekmanga.site/manga/' in href:
                    parts = href.split('/manga/')
                    if len(parts) > 1:
                        slug = parts[1].split('/')[0]
                        m_url = f"https://lekmanga.site/manga/{slug}/"
                        if m_url not in manga_urls:
                            manga_urls.append(m_url)
                            page_links += 1
            print(f"    <- تم العثور على {page_links} منهوا جديدة في هذه الصفحة.")
        except Exception as e:
            print(f"[-] خطأ أثناء قراءة صفحة الكتالوج {p}: {e}")

    print(f"\n[+] إجمالي روابط المنهوا المكتشفة الفريدة: {len(manga_urls)}")
    
    # Sequence through discovered mangas
    scraped_count = 0
    skipped_count = 0
    
    for idx, m_url in enumerate(manga_urls):
        match = re.search(r'/manga/([^/]+)/', m_url)
        slug = match.group(1) if match else ""
        m_id = f"lek_{slug}"
        
        # Check if already scraped
        if m_id in scraped_ids and not args.force:
            print(f"[{idx+1}/{len(manga_urls)}] تخطي (تم سحبها مسبقاً): {slug}")
            skipped_count += 1
            continue
            
        print(f"\n[{idx+1}/{len(manga_urls)}] جاري سحب: {m_url}")
        
        # Add delay to respect rate-limiting
        if idx > 0:
            time.sleep(args.delay)
            
        manga_obj, err = scrape_manga_detail(scraper, m_url, args.cookie, args.user_agent, args.threads)
        
        if manga_obj:
            # Update database incrementally
            scraped_db = [m for m in scraped_db if m["id"] != manga_obj["id"]]
            scraped_db.append(manga_obj)
            scraped_ids.add(manga_obj["id"])
            
            try:
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(scraped_db, f, ensure_ascii=False, indent=2)
                scraped_count += 1
                print(f"[+] نجاح! تم سحب '{manga_obj['title']}' بنجاح وبها {len(manga_obj['chapters'])} فصل.")
            except Exception as save_err:
                print(f"[-] خطأ أثناء حفظ قاعدة البيانات: {save_err}")
        else:
            print(f"[-] فشل سحب المنهوا: {err}")
            
    print(f"\n========================================================")
    print(f"[+] تم الانتهاء من عملية السحب الشاملة بنجاح!")
    print(f"    - المنهوات التي تم سحبها حديثاً: {scraped_count}")
    print(f"    - المنهوات التي تم تخطيها: {skipped_count}")
    print(f"    - إجمالي المنهوات في موقعك الآن: {len(scraped_db)}")
    print(f"========================================================")

if __name__ == "__main__":
    main()
