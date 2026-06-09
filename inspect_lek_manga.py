import cloudscraper
import re
from bs4 import BeautifulSoup

url = 'https://lekmanga.site/manga/absolute-sword-sense/'

try:
    print(f"Fetching manga page with cloudscraper: {url}")
    scraper = cloudscraper.create_scraper()
    html = scraper.get(url, timeout=15).text
    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Title
    title = ""
    title_box = soup.find('div', class_='post-title')
    if title_box:
        title = title_box.find('h1').text.strip()
    else:
        title_box = soup.find('h1')
        if title_box:
            title = title_box.text.strip()
    print("Title:", title)

    # 2. Cover Image
    cover = ""
    cover_box = soup.find('div', class_='summary_image')
    if cover_box:
        img = cover_box.find('img')
        if img:
            cover = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
    print("Cover:", cover)

    # 3. Synopsis
    synopsis = ""
    syn_box = soup.find('div', class_='summary__content')
    if syn_box:
        synopsis = syn_box.text.strip()
    else:
        syn_box = soup.find('div', class_='description-summary')
        if syn_box:
            synopsis = syn_box.text.strip()
    print("Synopsis:", synopsis[:150])

    # 4. Chapters list
    chapters = []
    chapter_elements = soup.find_all('li', class_='wp-manga-chapter')
    if chapter_elements:
        print(f"Found {len(chapter_elements)} chapters directly in HTML.")
        for el in chapter_elements[:5]:
            a = el.find('a')
            if a:
                chapters.append((a.text.strip(), a['href']))
    else:
        print("No chapters directly in HTML. Checking for AJAX manga ID...")
        # Check inside html content for post ID
        manga_id_match = re.search(r'manga-id-(\d+)', html) or re.search(r'post_id\s*=\s*\"?(\d+)\"?', html) or re.search(r'id=\"wp-manga-bookmark-([^\"]+)\"', html)
        if not manga_id_match:
            # Let's search inside data-id attributes
            manga_id_match = re.search(r'data-id=\"(\d+)\"', html)
        if manga_id_match:
            manga_id = manga_id_match.group(1)
            print("Found Manga ID:", manga_id)
            ajax_url = 'https://lekmanga.site/wp-admin/admin-ajax.php'
            try:
                ajax_res = scraper.post(ajax_url, data={
                    'action': 'manga_get_chapters',
                    'manga': manga_id
                }, timeout=10).text
                ajax_soup = BeautifulSoup(ajax_res, 'html.parser')
                ajax_chaps = ajax_soup.find_all('li', class_='wp-manga-chapter')
                print(f"Found {len(ajax_chaps)} chapters via AJAX.")
                for el in ajax_chaps[:5]:
                    a = el.find('a')
                    if a:
                        chapters.append((a.text.strip(), a['href']))
            except Exception as ajax_err:
                print("AJAX call failed:", ajax_err)
        else:
            print("Could not find Manga ID.")

    print("Sample chapters:")
    for chap in chapters[:5]:
        print(f" - {chap[0]}: {chap[1]}")

except Exception as e:
    print("Error:", e)
