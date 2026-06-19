import sys
try: sys.stdout.reconfigure(encoding='utf-8')
except: pass
from curl_cffi import requests
from bs4 import BeautifulSoup
import re

url = 'https://mangatime.org/manga/blue-lock'
session = requests.Session(impersonate='chrome110')
res = session.get(url, allow_redirects=True)
soup = BeautifulSoup(res.text, 'html.parser')

print('Title:', soup.title.string)

post_id = None
rating = soup.select_one('.rating-post-id')
if rating:
    post_id = rating.get('value')
    print('Found rating-post-id:', post_id)

data_id = soup.select_one('#manga-chapters-holder')
if data_id and data_id.has_attr('data-id'):
    print('Found manga-chapters-holder data-id:', data_id['data-id'])

wp_manga = re.search(r'manga_id[\"\']?\s*[:=]\s*[\"\']?(\d+)', res.text)
if wp_manga:
    print('Found regex manga_id:', wp_manga.group(1))

wp_post = re.search(r'\"post_id\"[\"\']?\s*[:=]\s*[\"\']?(\d+)', res.text)
if wp_post:
    print('Found regex post_id:', wp_post.group(1))
