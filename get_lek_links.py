import urllib.request
import re
from bs4 import BeautifulSoup

url = 'https://lekmanga.site/'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

try:
    print("Fetching lekmanga.site homepage...")
    with urllib.request.urlopen(req, timeout=15) as response:
        html = response.read()
    soup = BeautifulSoup(html, 'html.parser')
    manga_links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        # Madara links look like https://lekmanga.site/manga/manga-slug/
        if 'lekmanga.site/manga/' in href:
            parts = href.split('/manga/')
            if len(parts) > 1 and parts[1].strip('/'):
                # clean url
                slug = parts[1].split('/')[0]
                manga_links.add(f"https://lekmanga.site/manga/{slug}/")
    
    print("Found Manga URLs:")
    for link in list(manga_links)[:10]:
        print(f" - {link}")
except Exception as e:
    print("Error fetching page:", e)
