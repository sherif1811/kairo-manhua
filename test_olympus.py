from bs4 import BeautifulSoup
import re

def main():
    with open('temp_olympus.html', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    # Description
    desc_el = soup.select_one('.summary__content') or soup.select_one('.post-content') or soup.select_one('.manga-excerpt')
    if desc_el:
        print('Summary:', desc_el.text.strip())
    else:
        meta = soup.select_one('meta[name="description"]')
        if meta:
            print('Meta Summary:', meta.get('content'))
        else:
            print('No summary found')
            
    # Genres
    genres = [a.text.strip() for a in soup.select('.genres-content a')]
    if not genres:
        genres = [a.text.strip() for a in soup.select('.mgen a')]
    print('Genres:', genres)
    
    # Try finding alternative genres
    alt_genres = [span.text.strip() for span in soup.select('div.flex.flex-wrap.gap-2 span')]
    if alt_genres:
        print('Alt Genres:', alt_genres)
        
    alt_desc = soup.select_one('div.text-sm.leading-relaxed.text-gray-300')
    if alt_desc:
        print('Alt Desc:', alt_desc.text.strip())

if __name__ == "__main__":
    main()
