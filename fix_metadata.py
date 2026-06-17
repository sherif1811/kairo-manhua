import json
import os
import sys
import logging

from scrapers.factory import get_scraper

def main():
    json_path = 'scraped_mangas.json'
    if not os.path.exists(json_path):
        print("scraped_mangas.json not found!")
        return

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return

    updated_count = 0
    for manga in data:
        url = manga.get('url')
        if not url:
            continue
            
        print(f"Fetching metadata for: {manga.get('title')}")
        try:
            scraper = get_scraper(url)
            meta = scraper.scrape_metadata(url)
            
            new_synopsis = meta.get('description', '')
            if new_synopsis and not isinstance(new_synopsis, str):
                new_synopsis = str(new_synopsis)
                
            new_genres = meta.get('genres', [])
            
            # Additional cleanup for Mangatime and Olympus genres just in case
            clean_genres = []
            for g in new_genres:
                if isinstance(g, dict):
                    clean_genres.append(g.get("name", ""))
                else:
                    clean_genres.append(str(g))
            
            clean_genres = [g for g in clean_genres if g]
            
            # Remove printing of Arabic to avoid Windows charmap errors
            manga['synopsis'] = new_synopsis
            manga['genres'] = clean_genres
            updated_count += 1
            
        except Exception as e:
            print(f"Error updating {manga.get('title')}: {e}")

    if updated_count > 0:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"\nSuccessfully updated {updated_count} mangas!")
    else:
        print("\nNo mangas were updated.")

if __name__ == "__main__":
    main()
