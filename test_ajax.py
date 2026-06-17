from curl_cffi import requests
import re
from bs4 import BeautifulSoup

def main():
    r = requests.get('https://3asq.org/manga/kingdom-2/', impersonate='chrome110')
    html = r.text
    match = re.search(r'"manga_id":"(\d+)"', html)
    if not match:
        print("manga_id not found")
        return
    post_id = match.group(1)
    print("post_id:", post_id)
    
    r_ajax = requests.post('https://3asq.org/wp-admin/admin-ajax.php', 
                           data={'action': 'manga_get_chapters', 'manga': post_id}, 
                           impersonate='chrome110')
    soup = BeautifulSoup(r_ajax.text, 'html.parser')
    chapters = soup.select('li.wp-manga-chapter')
    print("AJAX chapters:", len(chapters))

if __name__ == "__main__":
    main()
