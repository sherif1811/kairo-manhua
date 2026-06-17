import json
def main():
    data = json.load(open('scraped_mangas.json', encoding='utf-8'))
    with open('dump.txt', 'w', encoding='utf-8') as f:
        for m in data:
            title = m.get('title', '')
            syn = m.get('synopsis', '')
            genres = m.get('genres', [])
            f.write(f'=== {title} ===\n')
            f.write(f'Syn: {syn[:200]}...\n')
            f.write(f'Genres: {genres}\n\n')

if __name__ == "__main__":
    main()
