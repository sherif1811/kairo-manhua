import re
import os
import glob

def perfect_decode(m):
    block = m.group(0)
    b = bytearray()
    for char in block:
        try:
            b.extend(char.encode('cp1252'))
        except UnicodeEncodeError:
            if ord(char) < 256:
                b.append(ord(char))
            else:
                return block
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return block

def fix_file(filepath):
    if not os.path.exists(filepath):
        return
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return
    
    fixed_content = re.sub(r'[^\x00-\x7F\u0600-\u06FF\u0750-\u077F]+', perfect_decode, content)
    
    if content != fixed_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Fixed {filepath}")

# Gather all files to fix
files_to_fix = ['app.js', 'index.html', 'flask_app.py', 'scraped_mangas.json']
if os.path.exists('mangas_data'):
    files_to_fix.extend(glob.glob('mangas_data/*.json'))

for f in files_to_fix:
    fix_file(f)

print("Language fixing complete!")
