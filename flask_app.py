import subprocess
import os
import io
import sys
import re
import json
import hashlib
import math
import xml.etree.ElementTree as ET
import urllib.parse
import urllib.request
import sqlite3
import secrets
import time
import threading

# Reconfigure stdout/stderr to utf-8 for Windows console support
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Set working directory to project folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

DB_FILE = os.path.join(BASE_DIR, "kairo.db")

# Site name for watermark
SITE_NAME = None
def get_site_name():
    global SITE_NAME
    if SITE_NAME is not None:
        return SITE_NAME
    try:
        conn = sqlite3.connect(DB_FILE, timeout=5)
        c = conn.cursor()
        c.execute("SELECT value FROM system_settings WHERE key = 'site_name'")
        row = c.fetchone()
        conn.close()
        if row and row[0]:
            SITE_NAME = row[0]
            return SITE_NAME
    except Exception:
        pass
    SITE_NAME = "KAIRO / Ù…Ù†Ù‡ÙˆØ§"
    return SITE_NAME

from flask import Flask, request, jsonify, send_from_directory, send_file, redirect, make_response, Response, stream_with_context

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import functools
import image_processor

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

from routes.alternative_sources import alt_sources_bp
app.register_blueprint(alt_sources_bp)

PORT = 8000
CACHE_DIR = os.path.join(BASE_DIR, "image_cache")
DB_FILE = os.path.join(BASE_DIR, "kairo.db")

# ============================================================
# SEO / Crawler Middleware Helpers
# ============================================================
CRAWLER_PATTERN = re.compile(r'(googlebot|bingbot|facebookexternalhit|twitterbot|discordbot|slackbot|whatsapp|telegrambot|yandexbot|baiduspider|applebot|duckduckbot|semrushbot|ahrefsbot|dotbot)', re.IGNORECASE)

def is_crawler(user_agent):
    return bool(user_agent and CRAWLER_PATTERN.search(user_agent))

def load_scraped_mangas():
    path = os.path.join(BASE_DIR, 'scraped_mangas.json')
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def find_manga_for_seo(manga_id):
    scraped = load_scraped_mangas()
    for m in scraped:
        if str(m.get('id')) == str(manga_id):
            return m
    return None

def _escape_html(s):
    if not s:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')

def inject_seo_meta(html, title, description, image_url=''):
    title = title or 'KAIRO / Ù…Ù†Ù‡ÙˆØ§ - Ù…Ù†ØµØ© Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ø£ÙˆÙ„Ù‰'
    desc = description or 'Ù…Ù†ØµØ© KAIRO/Ù…Ù†Ù‡ÙˆØ§ - Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ ÙˆØ§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø§Ù„Ù…ÙØ¶Ù„Ø© Ù„Ø¯ÙŠÙƒ Ø¨Ø¬ÙˆØ¯Ø© Ø¹Ø§Ù„ÙŠØ© ÙˆØ¨Ø¯ÙˆÙ† Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ù…Ø²Ø¹Ø¬Ø©.'
    
    html = re.sub(r'<title>[^<]*</title>', '<title>' + _escape_html(title) + '</title>', html)
    html = re.sub(r'<meta name="description"[^>]*>', '<meta name="description" content="' + _escape_html(desc) + '">', html)
    
    og_tags = {
        'og:title': title,
        'og:description': desc,
        'og:image': image_url,
        'og:type': 'website',
        'twitter:card': 'summary_large_image',
        'twitter:title': title,
        'twitter:description': desc,
        'twitter:image': image_url
    }
    for prop, content in og_tags.items():
        if content:
            pattern = r'<meta[^>]*' + re.escape(prop) + r'[^>]*>'
            replacement = '<meta property="' + _escape_html(prop) + '" content="' + _escape_html(content) + '">'
            if re.search(pattern, html):
                html = re.sub(pattern, replacement, html)
            else:
                html = html.replace('</head>', replacement + '\n</head>')
    return html

def get_seo_for_path(path):
    clean = path
    manga_match = re.match(r'^/manga/([^/]+)', clean)
    reader_match = re.match(r'^/reader/([^/]+)/([^/]+)', clean)
    
    if reader_match:
        manga_id = reader_match.group(1)
        chapter_id = reader_match.group(2)
        manga = find_manga_for_seo(manga_id)
        if manga:
            chapters = manga.get('chapters', [])
            chapter_title = 'ÙØµÙ„ ' + chapter_id
            for ch in chapters:
                if str(ch.get('id')) == str(chapter_id):
                    chapter_title = ch.get('title', chapter_title)
                    break
            title = manga.get('title', '') + ' - ' + chapter_title + ' | KAIRO / Ù…Ù†Ù‡ÙˆØ§'
            desc = 'Ø§Ù‚Ø±Ø£ ' + manga.get('title', '') + ' ' + chapter_title + ' Ø¹Ù„Ù‰ KAIRO/Ù…Ù†Ù‡ÙˆØ§'
            cover = manga.get('cover', '')
            return title, desc, cover
    elif manga_match:
        manga_id = manga_match.group(1)
        manga = find_manga_for_seo(manga_id)
        if manga:
            title = manga.get('title', '') + ' | KAIRO / Ù…Ù†Ù‡ÙˆØ§'
            desc = (manga.get('synopsis', '') or '')[:200]
            cover = manga.get('cover', '')
            return title, desc, cover
    
    return None, None, None

def render_index_with_seo(path):
    index_path = os.path.join(BASE_DIR, 'index.html')
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
    except (IOError, OSError) as e:
        print(f"Error reading index.html: {e}")
        return 'index.html not found', 500
    user_agent = request.headers.get('User-Agent', '')
    if is_crawler(user_agent):
        seo_title, seo_desc, seo_img = get_seo_for_path(path)
        if seo_title:
            html = inject_seo_meta(html, seo_title, seo_desc, seo_img)
    return html

def generate_sitemap_xml():
    SITE_URL = 'https://kairo-manhua.com'
    urlset = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')

    def add_url(loc, priority='0.5', changefreq='weekly'):
        url_elem = ET.SubElement(urlset, 'url')
        loc_elem = ET.SubElement(url_elem, 'loc')
        loc_elem.text = SITE_URL + loc
        prio_elem = ET.SubElement(url_elem, 'priority')
        prio_elem.text = priority
        freq_elem = ET.SubElement(url_elem, 'changefreq')
        freq_elem.text = changefreq

    add_url('/', '1.0', 'daily')

    mangas = load_scraped_mangas()
    for m in mangas:
        manga_id = str(m.get('id', ''))
        if not manga_id:
            continue
        add_url('/manga/' + manga_id, '0.9', 'weekly')
        chapters = m.get('chapters', [])
        for ch in chapters:
            ch_id = str(ch.get('id', ''))
            if ch_id:
                add_url('/reader/' + manga_id + '/' + ch_id, '0.6', 'monthly')

    return ET.tostring(urlset, encoding='unicode', xml_declaration=True)

def ping_google_sitemap():
    SITEMAP_URL = 'https://kairomanha.pythonanywhere.com/sitemap.xml'
    ping_url = 'https://www.google.com/ping?sitemap=' + urllib.parse.quote(SITEMAP_URL, safe='')
    try:
        req = urllib.request.Request(ping_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            print("[Google Ping] Sitemap submitted successfully, status:", resp.status)
    except Exception as e:
        print("[Google Ping] Failed to ping Google:", e)

# Create cache directory if it doesn't exist
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# ============================================================
# Database Init
# ============================================================
def init_db():
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
                        email TEXT PRIMARY KEY,
                        password_hash TEXT,
                        role TEXT DEFAULT 'user',
                        points INTEGER DEFAULT 20,
                        level INTEGER DEFAULT 1,
                        username TEXT DEFAULT ''
                     )''')
        try:
            c.execute('ALTER TABLE users ADD COLUMN username TEXT DEFAULT \'\'')
        except sqlite3.OperationalError:
            pass
        c.execute('''CREATE TABLE IF NOT EXISTS sessions (
                        token TEXT PRIMARY KEY,
                        email TEXT,
                        expires_at REAL
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS user_settings (
                        email TEXT PRIMARY KEY,
                        settings_json TEXT
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS reading_progress (
                        email TEXT,
                        manga_id TEXT,
                        chapter_id TEXT,
                        page INTEGER,
                        updated_at REAL,
                        PRIMARY KEY (email, manga_id)
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS suggestions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT,
                        type TEXT,
                        content TEXT,
                        created_at REAL
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS manga_reviews (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        manga_id TEXT,
                        email TEXT,
                        rating INTEGER,
                        review_text TEXT,
                        created_at REAL,
                        UNIQUE(manga_id, email)
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS chapter_comments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        manga_id TEXT,
                        chapter_id TEXT,
                        email TEXT,
                        comment_text TEXT,
                        created_at REAL,
                        badge TEXT DEFAULT ''
                     )''')
        try:
            c.execute("ALTER TABLE chapter_comments ADD COLUMN badge TEXT DEFAULT ''")
        except:
            pass
        # Fix existing users that were wrongly set to admin
        c.execute("UPDATE users SET role = 'user' WHERE role = 'admin' AND email != 'sherifahmed2686@gmail.com'")
        c.execute('''CREATE TABLE IF NOT EXISTS site_stats (
                        key TEXT PRIMARY KEY,
                        value INTEGER DEFAULT 0
                     )''')
        c.execute("INSERT OR IGNORE INTO site_stats VALUES ('visits', 0)")
        c.execute('''CREATE TABLE IF NOT EXISTS system_settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                     )''')
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('google_client_id', '')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('facebook_app_id', '')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('smtp_host', 'smtp.gmail.com')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('smtp_port', '587')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('smtp_user', '')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('smtp_pass', '')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('smtp_sender', 'KAIRO/Ù…Ù†Ù‡ÙˆØ§ <noreply@kairo-manhua.com>')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('watermark_enabled', 'false')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('watermark_text', 'KAIRO / Ù…Ù†Ù‡ÙˆØ§')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('watermark_opacity', '25')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('watermark_font_size', '32')")
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('watermark_position', 'bottom-right')")
        
        c.execute('''CREATE TABLE IF NOT EXISTS password_resets (
                        email TEXT,
                        token TEXT PRIMARY KEY,
                        expires_at REAL
                     )''')
                     
        try:
            c.execute("ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'email'")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 20")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1")
        except sqlite3.OperationalError:
            pass
        c.execute('''CREATE TABLE IF NOT EXISTS reader_points_log (
                        email TEXT,
                        manga_id TEXT,
                        chapter_id TEXT,
                        earned_at REAL,
                        PRIMARY KEY (email, manga_id, chapter_id)
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS notifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT,
                        type TEXT,
                        title TEXT,
                        message TEXT,
                        manga_id TEXT,
                        chapter_id TEXT,
                        actor_email TEXT DEFAULT '',
                        is_read INTEGER DEFAULT 0,
                        created_at REAL
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS follows (
                        follower_email TEXT,
                        following_email TEXT,
                        created_at REAL,
                        PRIMARY KEY (follower_email, following_email)
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS user_lists (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT,
                        name TEXT,
                        description TEXT DEFAULT '',
                        is_public INTEGER DEFAULT 1,
                        created_at REAL
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS user_list_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        list_id INTEGER,
                        manga_id TEXT,
                        manga_title TEXT,
                        manga_cover TEXT,
                        added_at REAL
                     )''')
        try:
            c.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE users ADD COLUMN streak_days INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE users ADD COLUMN last_read_date TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE notifications ADD COLUMN actor_email TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE users ADD COLUMN last_claim_date TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        conn.commit()
    finally:
        conn.close()

init_db()

# ============================================================
# Helpers
# ============================================================
from werkzeug.security import generate_password_hash, check_password_hash

def hash_password(password):
    return generate_password_hash(password)

def verify_password(password, stored_hash):
    if not stored_hash:
        return False
    # Check if it's werkzeug hash format
    if stored_hash.startswith('scrypt:') or stored_hash.startswith('pbkdf2:'):
        return check_password_hash(stored_hash, password)
    # Check if it's the custom pbkdf2 format
    if ':' in stored_hash:
        import hashlib
        try:
            salt, dk_hex = stored_hash.split(':', 1)
            dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
            return dk.hex() == dk_hex
        except: pass
    # Check if it's the very old sha256 format
    import hashlib
    return stored_hash == hashlib.sha256((password + 'kairo_salt_123!').encode('utf-8')).hexdigest()

ALLOWED_RESET_HOSTS = {'kairo-manhua.com', 'localhost:8000', 'localhost'}

def validate_reset_host(host):
    return host in ALLOWED_RESET_HOSTS

def points_needed_for_level(level):
    return 50 * level * (level + 1)

def calculate_level(points):
    if points <= 0:
        return 1
    n = math.floor((-1 + math.sqrt(1 + 4 * points / 50)) / 2)
    return max(1, n)

def get_rank_name(level):
    if level <= 5:
        return 'Ù…Ø¨ØªØ¯Ø¦'
    elif level <= 15:
        return 'Ù‚Ø§Ø±Ø¦ Ù†Ù‡Ù…'
    elif level <= 30:
        return 'Ù‚Ø§Ø±Ø¦ Ù…Ù…ØªØ§Ø²'
    elif level <= 50:
        return 'Ù†Ø§Ù‚Ø¯ Ø£Ø¯Ø¨ÙŠ'
    elif level <= 70:
        return 'Ø®Ø¨ÙŠØ± Ù…Ù†Ù‡ÙˆØ§'
    elif level <= 99:
        return 'Ù‚Ø§Ø±Ø¦ Ø£Ø³Ø·ÙˆØ±ÙŠ'
    elif level <= 149:
        return 'Ù…Ù„Ùƒ Ø§Ù„ØªØ±ÙÙŠÙ‡'
    elif level <= 199:
        return 'Ø¹Ù…Ù„Ø§Ù‚ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©'
    elif level <= 299:
        return 'Ø£Ø³Ø·ÙˆØ±Ø© Ø­ÙŠØ©'
    else:
        return 'Ù…Ø¯ÙŠØ± Ø§Ù„Ù…Ø´Ø±ÙˆØ¹'

def award_reading_points(email, manga_id, chapter_id):
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        user = c.fetchone()
        if not user:
            return None
        current_points, current_level = user
        
        c.execute('SELECT 1 FROM reader_points_log WHERE email = ? AND manga_id = ? AND chapter_id = ?',
                  (email, manga_id, chapter_id))
        if c.fetchone():
            return {'points': current_points, 'level': current_level, 'new_points': 0, 'leveled_up': False}
        
        new_points = current_points + 1
        new_level = calculate_level(new_points)
        leveled_up = new_level > current_level
        
        c.execute('UPDATE users SET points = ?, level = ? WHERE email = ?', (new_points, new_level, email))
        c.execute('INSERT OR IGNORE INTO reader_points_log VALUES (?, ?, ?, ?)',
                  (email, manga_id, chapter_id, time.time()))
        conn.commit()
        
        return {
            'points': new_points,
            'level': new_level,
            'new_points': 1,
            'leveled_up': leveled_up,
            'rank_name': get_rank_name(new_level)
        }
    finally:
        conn.close()

def send_reset_email(email, token, host):
    import smtplib
    from email.mime.text import MIMEText
    
    if not validate_reset_host(host):
        host = 'kairo-manhua.com'
    
    conn = sqlite3.connect(DB_FILE, timeout=30)
    smtp_host = 'localhost'
    smtp_port = 587
    smtp_user = ''
    smtp_pass = ''
    smtp_sender = 'noreply@kairo-manhua.com'
    try:
        c = conn.cursor()
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_host',))
        r = c.fetchone()
        if r: smtp_host = r[0]
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_port',))
        r = c.fetchone()
        if r: smtp_port = int(r[0] or 587)
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_user',))
        r = c.fetchone()
        if r: smtp_user = r[0]
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_pass',))
        r = c.fetchone()
        if r: smtp_pass = r[0]
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_sender',))
        r = c.fetchone()
        if r: smtp_sender = r[0]
    finally:
        conn.close()
    
    reset_link = f"http://{host}/#/reset-password?token={token}"
    
    # Check if SMTP details are configured
    if not smtp_user or not smtp_pass:
        raise ValueError("Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø®Ø§Ø¯Ù… SMTP ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©. ÙŠØ±Ø¬Ù‰ ØªÙ‡ÙŠØ¦Ø© SMTP ÙÙŠ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ….")

    msg_body = f"""Ø£Ù‡Ù„Ø§Ù‹ Ø¨ÙƒØŒ

Ù„Ù‚Ø¯ ØªÙ„Ù‚ÙŠÙ†Ø§ Ø·Ù„Ø¨Ø§Ù‹ Ù„Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù„Ø­Ø³Ø§Ø¨Ùƒ ÙÙŠ Ù…Ù†ØµØ© KAIRO/Ù…Ù†Ù‡ÙˆØ§.

ÙŠÙ…ÙƒÙ†Ùƒ Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø§Ù„Ø±Ø§Ø¨Ø· Ø§Ù„ØªØ§Ù„ÙŠ:
{reset_link}

Ø¥Ø°Ø§ Ù„Ù… ØªØ·Ù„Ø¨ Ù‡Ø°Ø§ Ø§Ù„ØªØºÙŠÙŠØ±ØŒ ÙŠØ±Ø¬Ù‰ ØªØ¬Ø§Ù‡Ù„ Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ. Ø§Ù„Ø±Ø§Ø¨Ø· ØµØ§Ù„Ø­ Ù„Ù…Ø¯Ø© 15 Ø¯Ù‚ÙŠÙ‚Ø©.

Ø´ÙƒØ±Ø§Ù‹ Ù„ÙƒØŒ
Ø¥Ø¯Ø§Ø±Ø© KAIRO/Ù…Ù†Ù‡ÙˆØ§
"""
    
    mime_msg = MIMEText(msg_body, 'plain', 'utf-8')
    mime_msg['Subject'] = 'Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± - KAIRO/Ù…Ù†Ù‡ÙˆØ§'
    mime_msg['From'] = smtp_sender
    mime_msg['To'] = email

    # Send message using SMTP
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_sender, [email], mime_msg.as_string())


def get_session_user():
    token = None
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
    if not token:
        cookie_header = request.headers.get('Cookie', '')
        for p in cookie_header.split(';'):
            p = p.strip()
            if p.startswith('session_token='):
                token = p[len('session_token='):].strip()
                break
    if not token:
        return None
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, expires_at FROM sessions WHERE token = ?', (token,))
        row = c.fetchone()
        if not row:
            return None
        email, expires_at = row
        if expires_at < time.time():
            c.execute('DELETE FROM sessions WHERE token = ?', (token,))
            conn.commit()
            return None
        c.execute('SELECT role, points, level, username FROM users WHERE email = ?', (email,))
        role_row = c.fetchone()
        role = role_row[0] if role_row else 'user'
        points = role_row[1] if role_row else 20
        level = role_row[2] if role_row else 1
        username = role_row[3] if role_row and role_row[3] else email.split('@')[0]
    finally:
        conn.close()
    return {'email': email, 'role': role, 'token': token, 'points': points, 'level': level, 'username': username}

def require_admin(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = get_session_user()
        if not user or user.get('role') != 'admin':
            return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·"}), 403
        return f(*args, **kwargs)
    return decorated

def create_notification(email, type, title, message, manga_id='', chapter_id=''):
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT INTO notifications (email, type, title, message, manga_id, chapter_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
                  (email, type, title, message, str(manga_id), str(chapter_id), time.time()))
        conn.commit()
    finally:
        conn.close()

# ============================================================
# CORS preflight
# ============================================================
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.route('/api/<path:path>', methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def options_handler(path=''):
    return jsonify({}), 200

# ============================================================
# Static Files
# ============================================================
@app.route('/sitemap.xml')
def sitemap_xml():
    xml_str = generate_sitemap_xml()
    return app.response_class(response=xml_str, status=200, mimetype='application/xml')

@app.route('/')
def index():
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        try:
            c = conn.cursor()
            c.execute("UPDATE site_stats SET value = value + 1 WHERE key = 'visits'")
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        print("Error incrementing visits:", e)
    html = render_index_with_seo('/')
    if isinstance(html, tuple):
        return html
    return html

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(BASE_DIR, 'icon-192.svg')

ALLOWED_STATIC_EXTENSIONS = {
    '.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.ico', '.webp', '.woff', '.woff2', '.ttf', '.xml', '.txt', '.webmanifest',
    '.map', '.md', '.yaml', '.yml',
}

@app.route('/<path:filename>')
def static_files(filename):
    # Ù…Ù†Ø¹ path traversal
    normalized = os.path.normpath('/' + filename).lstrip('/')
    if normalized.startswith('..') or normalized.startswith('/'):
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403

    file_ext = os.path.splitext(normalized)[1].lower()
    file_path = os.path.join(BASE_DIR, normalized)

    if file_ext:
        # Ø·Ù„Ø¨ Ù…Ù„Ù Ø¨Ø§Ù…ØªØ¯Ø§Ø¯ â€” Ù†Ø³Ù…Ø­ ÙÙ‚Ø· Ø¨Ø§Ù„Ø§Ù…ØªØ¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø³Ù…ÙˆØ­Ø©
        if file_ext not in ALLOWED_STATIC_EXTENSIONS:
            return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
        if os.path.isfile(file_path):
            return send_from_directory(BASE_DIR, normalized)
        return jsonify({"error": "Ù…Ù„Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯"}), 404

    # SPA fallback: serve index.html for clean URLs (e.g. /manga/1, /reader/1/2)
    html = render_index_with_seo('/' + filename)
    if isinstance(html, tuple):
        return html
    return html

# ============================================================
# AUTH ENDPOINTS
# ============================================================
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE email = ?', (email,))
        if c.fetchone():
            return jsonify({"error": "Ù‡Ø°Ø§ Ø§Ù„Ø¥ÙŠÙ…ÙŠÙ„ Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ù„ÙØ¹Ù„"}), 400
        role = 'user'
        password_hash = hash_password(password)
        default_username = email.split('@')[0]
        c.execute('INSERT INTO users (email, password_hash, role, username, provider, points, level) VALUES (?, ?, ?, ?, ?, 20, 1)', (email, password_hash, role, default_username, 'email'))
        conn.commit()

        token = secrets.token_hex(32)
        expires_at = time.time() + 86400 * 30
        c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
        conn.commit()

        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        pu = c.fetchone()
        points = pu[0] if pu else 20
        level = pu[1] if pu else 1
    finally:
        conn.close()
    return jsonify({
        "status": "success",
        "message": "ØªÙ… Ø§Ù„ØªØ³Ø¬ÙŠÙ„ Ø¨Ù†Ø¬Ø§Ø­",
        "username": default_username,
        "token": token,
        "email": email,
        "role": role,
        "points": points,
        "level": level
    }), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT password_hash, role, username FROM users WHERE email = ?', (email,))
        row = c.fetchone()
        if not row or not verify_password(password, row[0]):
            return jsonify({"error": "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø£Ùˆ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± ØµØ­ÙŠØ­Ø©"}), 401
        
        stored_hash = row[0]
        if not (stored_hash.startswith('scrypt:') or stored_hash.startswith('pbkdf2:')):
            new_hash = hash_password(password)
            c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (new_hash, email))
            conn.commit()
        
        role = row[1]
        username = row[2] if row[2] else email.split('@')[0]
        token = secrets.token_hex(32)
        expires_at = time.time() + 86400 * 30
        c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
        conn.commit()
        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        pu = c.fetchone()
        points = pu[0] if pu else 20
        level = pu[1] if pu else 1
    finally:
        conn.close()
    return jsonify({"status": "success", "token": token, "email": email, "role": role, "points": points, "level": level, "username": username}), 200

@app.route('/api/logout', methods=['POST'])
def logout():
    user = get_session_user()
    if user:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        try:
            c = conn.cursor()
            c.execute('DELETE FROM sessions WHERE token = ?', (user['token'],))
            conn.commit()
        finally:
            conn.close()
    return jsonify({"status": "success"}), 200

# ============================================================
# SOCIAL AUTH (GOOGLE & FACEBOOK OAUTH)
# ============================================================
def verify_google_token(credential=None, access_token=None):
    try:
        if credential:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(credential)}"
        elif access_token:
            url = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={urllib.parse.quote(access_token)}"
        else:
            return None
        
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            if credential and 'aud' in data:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute("SELECT value FROM system_settings WHERE key='google_client_id'")
                    row = c.fetchone()
                    expected_aud = row[0] if row else ''
                finally:
                    conn.close()
                if expected_aud and data['aud'] != expected_aud:
                    print(f"Google token aud mismatch: {data.get('aud')} != {expected_aud}")
                    return None
            
            return data
    except Exception as e:
        print("Google token verification error:", e)
        return None

def verify_facebook_token(access_token):
    try:
        url = f"https://graph.facebook.com/me?fields=email,name&access_token={urllib.parse.quote(access_token)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data
    except Exception as e:
        print("Facebook token verification error:", e)
        return None

@app.route('/api/auth/google', methods=['POST'])
def auth_google():
    data = request.get_json() or {}
    credential = data.get('credential')
    access_token = data.get('access_token')
    
    if not credential and not access_token:
        return jsonify({"error": "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙˆØ«ÙŠÙ‚ Ù…ÙÙ‚ÙˆØ¯Ø©"}), 400
        
    user_info = verify_google_token(credential=credential, access_token=access_token)
    if not user_info:
        return jsonify({"error": "ÙØ´Ù„ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø­Ø³Ø§Ø¨ Google"}), 401
        
    email = (user_info.get('email') or '').strip().lower()
    if not email:
        return jsonify({"error": "ÙØ´Ù„ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù…Ù† Ø­Ø³Ø§Ø¨ Google"}), 400
        
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, role, username FROM users WHERE email = ?', (email,))
        row = c.fetchone()
        
        if not row:
            random_pass = secrets.token_hex(16)
            password_hash = hash_password(random_pass)
            role = 'admin' if email == 'sherifahmed2686@gmail.com' else 'user'
            default_username = email.split('@')[0]
            c.execute('INSERT INTO users (email, password_hash, role, username, provider, points, level) VALUES (?, ?, ?, ?, ?, 20, 1)', (email, password_hash, role, default_username, 'google'))
            conn.commit()
            user_role = role
            username = default_username
        else:
            user_role = row[1]
            username = row[2] if row[2] else email.split('@')[0]
            if email == 'sherifahmed2686@gmail.com' and user_role != 'admin':
                c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
                conn.commit()
                user_role = 'admin'
                
        token = secrets.token_hex(32)
        expires_at = time.time() + 86400 * 30
        c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
        conn.commit()
        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        pu = c.fetchone()
        points = pu[0] if pu else 20
        level = pu[1] if pu else 1
    finally:
        conn.close()
    
    return jsonify({"status": "success", "token": token, "email": email, "role": user_role, "points": points, "level": level, "username": username}), 200

@app.route('/api/auth/facebook', methods=['POST'])
def auth_facebook():
    data = request.get_json() or {}
    access_token = data.get('access_token')
    
    if not access_token:
        return jsonify({"error": "ØªÙˆÙƒÙ† Ø§Ù„ÙÙŠØ³Ø¨ÙˆÙƒ Ù…ÙÙ‚ÙˆØ¯"}), 400
        
    user_info = verify_facebook_token(access_token)
    if not user_info:
        return jsonify({"error": "ÙØ´Ù„ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø­Ø³Ø§Ø¨ Facebook"}), 401
        
    email = (user_info.get('email') or '').strip().lower()
    # Ø¥Ø°Ø§ Ù„Ù… ÙŠÙƒÙ† Ø§Ù„Ø­Ø³Ø§Ø¨ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø¨Ø±ÙŠØ¯ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù…ÙØ¹Ù„ (Ù†Ø§Ø¯Ø± Ø§Ù„Ø­Ø¯ÙˆØ«)ØŒ Ù†Ø³ØªØ®Ø¯Ù… Ù…Ø¹Ø±Ù Ø§Ù„ÙÙŠØ³Ø¨ÙˆÙƒ Ù„ØªÙˆÙ„ÙŠØ¯ Ø¨Ø±ÙŠØ¯ ÙˆÙ‡Ù…ÙŠ ÙØ±ÙŠØ¯
    if not email:
        fb_id = user_info.get('id')
        if fb_id:
            email = f"fb_{fb_id}@kairo-facebook.com"
        else:
            return jsonify({"error": "ÙØ´Ù„ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨ Ù…Ù† Facebook"}), 400
            
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, role, username FROM users WHERE email = ?', (email,))
        row = c.fetchone()
        
        if not row:
            random_pass = secrets.token_hex(16)
            password_hash = hash_password(random_pass)
            role = 'admin' if email == 'sherifahmed2686@gmail.com' else 'user'
            default_username = email.split('@')[0]
            c.execute('INSERT INTO users (email, password_hash, role, username, provider, points, level) VALUES (?, ?, ?, ?, ?, 20, 1)', (email, password_hash, role, default_username, 'facebook'))
            conn.commit()
            user_role = role
            username = default_username
        else:
            user_role = row[1]
            username = row[2] if row[2] else email.split('@')[0]
            if email == 'sherifahmed2686@gmail.com' and user_role != 'admin':
                c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
                conn.commit()
                user_role = 'admin'
                
        token = secrets.token_hex(32)
        expires_at = time.time() + 86400 * 30
        c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
        conn.commit()
        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        pu = c.fetchone()
        points = pu[0] if pu else 20
        level = pu[1] if pu else 1
    finally:
        conn.close()
    
    return jsonify({"status": "success", "token": token, "email": email, "role": user_role, "points": points, "level": level, "username": username}), 200

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·"}), 403
    
    from_ts = request.args.get('from')
    to_ts = request.args.get('to')
    try:
        from_ts = float(from_ts) if from_ts else None
    except (ValueError, TypeError):
        from_ts = None
    try:
        to_ts = float(to_ts) if to_ts else None
    except (ValueError, TypeError):
        to_ts = None
        
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        
        # Visits
        c.execute("SELECT value FROM site_stats WHERE key = 'visits'")
        visits_row = c.fetchone()
        visits = visits_row[0] if visits_row else 0
        
        # User counts by provider
        c.execute("SELECT provider, COUNT(*) FROM users GROUP BY provider")
        rows = c.fetchall()
        
        stats = {
            "visits": visits,
            "total_users": 0,
            "email": 0,
            "google": 0,
            "facebook": 0
        }
        
        for provider, count in rows:
            if provider in stats:
                stats[provider] = count
                
        # Calculate total users
        c.execute("SELECT COUNT(*) FROM users")
        stats["total_users"] = c.fetchone()[0]
        
        # Filtered suggestion count if date range provided
        if from_ts and to_ts:
            c.execute("SELECT COUNT(*) FROM suggestions WHERE created_at >= ? AND created_at <= ?", (float(from_ts), float(to_ts)))
            stats["suggestions_in_range"] = c.fetchone()[0]
        else:
            c.execute("SELECT COUNT(*) FROM suggestions")
            stats["total_suggestions"] = c.fetchone()[0]
        
    finally:
        conn.close()
    return jsonify(stats), 200

@app.route('/api/admin/stats/export', methods=['GET'])
def get_admin_stats_export():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·"}), 403
    
    fmt = request.args.get('format', 'json')
    export_data = {}
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute("SELECT email, role, provider FROM users")
        export_data['users'] = [{"email": r[0], "role": r[1], "provider": r[2]} for r in c.fetchall()]
        c.execute("SELECT email, type, content, created_at FROM suggestions ORDER BY created_at DESC")
        export_data['suggestions'] = [{"email": r[0], "type": r[1], "content": r[2], "created_at": r[3]} for r in c.fetchall()]
        c.execute("SELECT key, value FROM site_stats")
        export_data['site_stats'] = {r[0]: r[1] for r in c.fetchall()}
    finally:
        conn.close()
    
    if fmt == 'csv':
        import io, csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Table', 'Field', 'Value'])
        for table, items in export_data.items():
            if isinstance(items, list):
                for item in items:
                    writer.writerow([table, str(item), ''])
            else:
                for k, v in items.items():
                    writer.writerow([table, k, v])
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        response.headers['Content-Disposition'] = 'attachment; filename=kairo_stats_export.csv'
        return response
    else:
        response = make_response(json.dumps(export_data, ensure_ascii=False))
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = 'attachment; filename=kairo_stats_export.json'
        return response

# ============================================================
# GAMIFICATION
# ============================================================
@app.route('/api/user/profile', methods=['GET'])
def user_profile():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT points, level, username FROM users WHERE email = ?', (user['email'],))
        row = c.fetchone()
        points = row[0] if row else 20
        level = row[1] if row else 1
        username = row[2] if row else ''
    finally:
        conn.close()
    rank_name = get_rank_name(level)
    points_current = points_needed_for_level(level - 1) if level > 1 else 0
    points_next = points_needed_for_level(level)
    progress = ((points - points_current) / (points_next - points_current)) * 100 if points_next > points_current else 100
    return jsonify({
        "points": points,
        "level": level,
        "username": username,
        "rank_name": rank_name,
        "progress": round(progress, 1),
        "points_to_next": points_next - points
    }), 200

# ============================================================
# SETTINGS
# ============================================================
@app.route('/api/get_settings', methods=['GET'])
def get_settings():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT settings_json FROM user_settings WHERE email = ?', (user['email'],))
        row = c.fetchone()
    finally:
        conn.close()
    settings_json = row[0] if row else "{}"
    return app.response_class(response=settings_json, status=200, mimetype='application/json')

@app.route('/api/sync_settings', methods=['POST'])
def sync_settings():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    data = request.get_json() or {}
    settings = data.get('settings', {})
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO user_settings VALUES (?, ?)', (user['email'], json.dumps(settings)))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success"}), 200

@app.route('/api/user/reading-progress', methods=['POST'])
def reading_progress():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    data = request.get_json() or {}
    manga_id = (data.get('manga_id') or '').strip()
    chapter_id = (data.get('chapter_id') or '').strip()
    page = data.get('page', 1)
    
    if not manga_id or not chapter_id:
        return jsonify({"error": "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©"}), 400
    
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO reading_progress (email, manga_id, chapter_id, page, updated_at) VALUES (?, ?, ?, ?, ?)',
                  (user['email'], manga_id, chapter_id, page, time.time()))
        conn.commit()
    finally:
        conn.close()
    
    result = award_reading_points(user['email'], manga_id, chapter_id)
    if result is None:
        result = {'points': 0, 'level': 1, 'new_points': 0, 'leveled_up': False}
    
    return jsonify({
        "status": "success",
        "points": result['points'],
        "level": result['level'],
        "new_points": result['new_points'],
        "leveled_up": result['leveled_up'],
        "rank_name": result.get('rank_name', get_rank_name(result['level']))
    }), 200

@app.route('/api/config', methods=['GET'])
def get_public_config():
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        try:
            c = conn.cursor()
            c.execute("SELECT key, value FROM system_settings WHERE key IN ('google_client_id', 'facebook_app_id', 'chapter_notice', 'chapter_notice_enabled')")
            rows = c.fetchall()
        finally:
            conn.close()
        config = {row[0]: row[1] for row in rows}
        return jsonify(config), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/config', methods=['GET'])
def get_admin_config():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠÙ† ÙÙ‚Ø·"}), 403
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        try:
            c = conn.cursor()
            c.execute('SELECT key, value FROM system_settings')
            rows = c.fetchall()
        finally:
            conn.close()
        config = {row[0]: row[1] for row in rows}
        return jsonify(config), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/config', methods=['POST'])
def save_admin_config():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠÙ† ÙÙ‚Ø·"}), 403
    data = request.get_json() or {}
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        try:
            c = conn.cursor()
            for key, val in data.items():
                c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', (key, str(val)))
            conn.commit()
        finally:
            conn.close()
        return jsonify({"status": "success", "message": "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ"}), 400
    
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE email = ?', (email,))
        if not c.fetchone():
            return jsonify({"status": "success", "message": "Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù…Ø³Ø¬Ù„Ø§Ù‹ØŒ Ø³ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±."}), 200
            
        token = secrets.token_hex(32)
        expires_at = time.time() + 900 # 15 minutes
        c.execute('INSERT OR REPLACE INTO password_resets VALUES (?, ?, ?)', (email, token, expires_at))
        conn.commit()
    finally:
        conn.close()
    
    host = request.headers.get('Host', 'localhost:8000')
    if not validate_reset_host(host):
        host = 'kairo-manhua.com'
    
    try:
        send_reset_email(email, token, host)
        return jsonify({"status": "success", "message": "Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù…Ø³Ø¬Ù„Ø§Ù‹ØŒ Ø³ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±."}), 200
    except Exception as ex:
        print(f"SMTP sending failed: {ex}")
        reset_link = f"http://{host}/#/reset-password?token={token}"
        print(f"[BACKUP reset link] For {email}: {reset_link}")
        
        err_str = str(ex)
        if "Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø®Ø§Ø¯Ù… SMTP" in err_str:
            return jsonify({"error": err_str}), 400
        else:
            return jsonify({
                "status": "success",
                "message": "ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø±Ø§Ø¨Ø· Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±. Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„Ø±Ø§Ø¨Ø· Ø£Ø¯Ù†Ø§Ù‡:",
                "reset_link": reset_link
            }), 200

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    new_password = data.get('password', '')
    
    if not email or not new_password:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"}), 400
        
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE email = ?', (email,))
        row = c.fetchone()
        
        if not row:
            return jsonify({"error": "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ ØºÙŠØ± Ù…Ø³Ø¬Ù„"}), 404
            
        password_hash = hash_password(new_password)
        c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (password_hash, email))
        conn.commit()
    finally:
        conn.close()
    
    return jsonify({"status": "success", "message": "ØªÙ… ØªØ­Ø¯ÙŠØ« ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ù†Ø¬Ø§Ø­"}), 200

@app.route('/api/auth/change-username', methods=['POST'])
def change_username():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØªÙˆÙƒÙ† ØºÙŠØ± ØµØ§Ù„Ø­"}), 401
    data = request.get_json() or {}
    new_username = data.get('username', '').strip()
    if not new_username:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…"}), 400
    if len(new_username) < 2:
        return jsonify({"error": "Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø­Ø±ÙÙŠÙ† Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE username = ? AND email != ?', (new_username, user['email']))
        if c.fetchone():
            return jsonify({"error": "Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ø§Ù„ÙØ¹Ù„"}), 409
        c.execute('UPDATE users SET username = ? WHERE email = ?', (new_username, user['email']))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ù†Ø¬Ø§Ø­", "username": new_username}), 200

@app.route('/api/auth/change-password', methods=['POST'])
def change_password():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØªÙˆÙƒÙ† ØºÙŠØ± ØµØ§Ù„Ø­"}), 401
    data = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    if not current_password or not new_password:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ø¬Ø¯ÙŠØ¯Ø©"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† 6 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT password_hash FROM users WHERE email = ?', (user['email'],))
        row = c.fetchone()
        if not row or not verify_password(current_password, row[0]):
            return jsonify({"error": "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ© ØºÙŠØ± ØµØ­ÙŠØ­Ø©"}), 403
        password_hash = hash_password(new_password)
        c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (password_hash, user['email']))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "ØªÙ… ØªØºÙŠÙŠØ± ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø¨Ù†Ø¬Ø§Ø­"}), 200

# ============================================================
# SOCIAL / COMMUNITY FEATURES
# ============================================================

@app.route('/api/user/search', methods=['GET'])
def user_search():
    q = request.args.get('q', '').strip()
    if len(q) < 1:
        return jsonify([]), 200
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT username, email, points, level FROM users WHERE username LIKE ? AND role != 'admin' LIMIT 8", (f'%{q}%',))
        rows = c.fetchall()
        results = []
        for username, email, points, level in rows:
            results.append({
                "username": username,
                "email": email,
                "points": points,
                "level": level,
                "rank": get_rank_name(level),
                "avatar": "",
            })
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/profile/<username>', methods=['GET'])
def public_profile(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email, username, points, level, avatar_url, bio FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify({"error": "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯"}), 404
        email, uname, points, level, avatar_url, bio = row
        current_user = get_session_user()
        is_owner = current_user and current_user['email'] == email
        
        c.execute("SELECT COUNT(*) FROM follows WHERE following_email = ?", (email,))
        followers_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM follows WHERE follower_email = ?", (email,))
        following_count = c.fetchone()[0]
        
        is_following = False
        if current_user:
            c.execute("SELECT 1 FROM follows WHERE follower_email = ? AND following_email = ?", (current_user['email'], email))
            is_following = c.fetchone() is not None
        
        # Get reading stats
        c.execute("SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = ?", (email,))
        chapters_read = c.fetchone()[0]
        
        # Get streak
        c.execute("SELECT streak_days, last_read_date FROM users WHERE email = ?", (email,))
        streak_row = c.fetchone()
        streak_days = streak_row[0] if streak_row else 0
    finally:
        conn.close()
    
    return jsonify({
        "username": uname,
        "email": email,
        "points": points,
        "level": level,
        "rank": get_rank_name(level),
        "avatar": avatar_url or "",
        "bio": bio or "",
        "followers": followers_count,
        "following": following_count,
        "is_following": is_following,
        "is_owner": is_owner,
        "chapters_read": chapters_read,
        "streak_days": streak_days,
        "xp_for_current": points_needed_for_level(level - 1) if level > 1 else 0,
        "xp_for_next": points_needed_for_level(level),
    }), 200

@app.route('/api/profile/<username>/activity', methods=['GET'])
def profile_activity(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify([]), 200
        email = row[0]
        c.execute("""SELECT r.manga_id, r.chapter_id, r.earned_at, m.title, m.cover_url AS cover
                     FROM reader_points_log r
                     LEFT JOIN manga m ON r.manga_id = m.id
                     WHERE r.email = ? ORDER BY r.earned_at DESC LIMIT 20""", (email,))
        rows = c.fetchall()
        activities = []
        for manga_id, chapter_id, earned_at, title, cover in rows:
            activities.append({
                "manga_id": manga_id,
                "chapter_id": chapter_id,
                "title": title or manga_id,
                "cover": cover or "",
                "time": earned_at,
            })
    finally:
        conn.close()
    return jsonify(activities), 200

@app.route('/api/profile/<username>/library', methods=['GET'])
def profile_library(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify([]), 200
        email = row[0]
        c.execute("SELECT settings_json FROM user_settings WHERE email = ?", (email,))
        row = c.fetchone()
        settings = {}
        if row and row[0]:
            try: settings = json.loads(row[0])
            except: pass
        manga_ids = set()
        for key in ['bookmarks', 'history']:
            items = settings.get(key, [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        mid = item.get('id') or item.get('manga_id')
                        if mid: manga_ids.add(mid)
                    elif isinstance(item, str):
                        manga_ids.add(item)
        results = []
        for mid in manga_ids:
            c.execute("SELECT title, cover_url AS cover FROM manga WHERE id = ?", (mid,))
            mr = c.fetchone()
            if mr:
                results.append({"manga_id": mid, "title": mr[0], "cover": mr[1]})
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/profile/<username>/reviews', methods=['GET'])
def profile_reviews(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify([]), 200
        email = row[0]
        c.execute("""SELECT r.manga_id, r.rating, r.review_text, r.created_at, m.title, m.cover_url AS cover
                     FROM manga_reviews r LEFT JOIN manga m ON r.manga_id = m.id
                     WHERE r.email = ? ORDER BY r.created_at DESC LIMIT 20""", (email,))
        rows = c.fetchall()
        results = []
        for manga_id, rating, review_text, created_at, title, cover in rows:
            results.append({"manga_id": manga_id, "title": title or manga_id, "cover": cover or "", "rating": rating, "review": review_text or "", "time": created_at})
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/profile/<username>/lists', methods=['GET'])
def profile_lists(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify([]), 200
        email = row[0]
        current_user = get_session_user()
        if current_user and current_user['email'] == email:
            c.execute("SELECT id, name, description, created_at FROM user_lists WHERE email = ? ORDER BY created_at DESC", (email,))
        else:
            c.execute("SELECT id, name, description, created_at FROM user_lists WHERE email = ? AND is_public = 1 ORDER BY created_at DESC", (email,))
        rows = c.fetchall()
        results = []
        for lid, name, desc, created_at in rows:
            c.execute("SELECT COUNT(*) FROM user_list_items WHERE list_id = ?", (lid,))
            count = c.fetchone()[0]
            results.append({"id": lid, "name": name, "description": desc or "", "count": count, "created_at": created_at})
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/user/lists', methods=['POST'])
def create_list():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("INSERT INTO user_lists (email, name, description, is_public, created_at) VALUES (?, ?, ?, ?, ?)",
                  (user['email'], name, data.get('description', ''), 1 if data.get('is_public', True) else 0, time.time()))
        conn.commit()
        list_id = c.lastrowid
    finally:
        conn.close()
    return jsonify({"success": True, "list_id": list_id, "name": name}), 201

@app.route('/api/user/lists/<int:list_id>/items', methods=['POST'])
def add_list_item(list_id):
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    data = request.get_json() or {}
    manga_id = data.get('manga_id', '')
    manga_title = data.get('manga_title', '')
    manga_cover = data.get('manga_cover', '')
    if not manga_id:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø±Ø³Ø§Ù„ Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ø§Ù†Ø¬Ø§"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM user_lists WHERE id = ?", (list_id,))
        row = c.fetchone()
        if not row or row[0] != user['email']:
            return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
        c.execute("INSERT OR IGNORE INTO user_list_items (list_id, manga_id, manga_title, manga_cover, added_at) VALUES (?, ?, ?, ?, ?)",
                  (list_id, manga_id, manga_title, manga_cover, time.time()))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True}), 201

@app.route('/api/user/lists/<int:list_id>', methods=['GET'])
def get_list(list_id):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email, name, description, is_public FROM user_lists WHERE id = ?", (list_id,))
        row = c.fetchone()
        if not row:
            return jsonify({"error": "Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©"}), 404
        email, name, desc, is_public = row
        c.execute("SELECT manga_id, manga_title, manga_cover, added_at FROM user_list_items WHERE list_id = ? ORDER BY added_at DESC", (list_id,))
        items = [{"manga_id": i[0], "title": i[1], "cover": i[2], "added_at": i[3]} for i in c.fetchall()]
    finally:
        conn.close()
    return jsonify({"name": name, "description": desc or "", "items": items}), 200

@app.route('/api/user/lists/<int:list_id>', methods=['DELETE'])
def delete_list(list_id):
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM user_lists WHERE id = ?", (list_id,))
        row = c.fetchone()
        if not row or row[0] != user['email']:
            return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
        c.execute("DELETE FROM user_list_items WHERE list_id = ?", (list_id,))
        c.execute("DELETE FROM user_lists WHERE id = ?", (list_id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True}), 200

@app.route('/api/user/lists/<int:list_id>/items/<path:manga_id>', methods=['DELETE'])
def remove_list_item(list_id, manga_id):
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM user_lists WHERE id = ?", (list_id,))
        row = c.fetchone()
        if not row or row[0] != user['email']:
            return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
        c.execute("DELETE FROM user_list_items WHERE list_id = ? AND manga_id = ?", (list_id, manga_id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True}), 200

@app.route('/api/follow/<username>', methods=['POST'])
def toggle_follow(username):
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify({"error": "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯"}), 404
        target_email = row[0]
        if target_email == user['email']:
            return jsonify({"error": "Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ Ù…ØªØ§Ø¨Ø¹Ø© Ù†ÙØ³Ùƒ"}), 400
        c.execute("SELECT 1 FROM follows WHERE follower_email = ? AND following_email = ?", (user['email'], target_email))
        if c.fetchone():
            c.execute("DELETE FROM follows WHERE follower_email = ? AND following_email = ?", (user['email'], target_email))
            conn.commit()
            return jsonify({"following": False, "message": "ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©"}), 200
        else:
            c.execute("INSERT INTO follows (follower_email, following_email, created_at) VALUES (?, ?, ?)", (user['email'], target_email, time.time()))
            c.execute("INSERT INTO notifications (email, type, title, message, actor_email, created_at) VALUES (?, 'follow', ?, ?, ?, ?)",
                      (target_email, 'Ù…ØªØ§Ø¨Ø¹Ø© Ø¬Ø¯ÙŠØ¯Ø©', f'{user.get("username", "Ø´Ø®Øµ")} Ø¨Ø¯Ø£ Ù…ØªØ§Ø¨Ø¹ØªÙƒ', user['email'], time.time()))
            conn.commit()
            return jsonify({"following": True, "message": "ØªÙ…Øª Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©"}), 200
    finally:
        conn.close()

@app.route('/api/follow/<username>/status', methods=['GET'])
def follow_status(username):
    user = get_session_user()
    if not user:
        return jsonify({"is_following": False}), 200
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify({"is_following": False}), 200
        c.execute("SELECT 1 FROM follows WHERE follower_email = ? AND following_email = ?", (user['email'], row[0]))
        is_following = c.fetchone() is not None
    finally:
        conn.close()
    return jsonify({"is_following": is_following}), 200

@app.route('/api/follow/<username>/followers', methods=['GET'])
def get_followers(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify([]), 200
        email = row[0]
        c.execute("""SELECT u.username, u.points, u.level FROM follows f
                     JOIN users u ON f.follower_email = u.email
                     WHERE f.following_email = ? ORDER BY f.created_at DESC LIMIT 50""", (email,))
        results = [{"username": r[0], "points": r[1], "level": r[2], "rank": get_rank_name(r[2])} for r in c.fetchall()]
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/follow/<username>/following', methods=['GET'])
def get_following(username):
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT email FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return jsonify([]), 200
        email = row[0]
        c.execute("""SELECT u.username, u.points, u.level FROM follows f
                     JOIN users u ON f.following_email = u.email
                     WHERE f.follower_email = ? ORDER BY f.created_at DESC LIMIT 50""", (email,))
        results = [{"username": r[0], "points": r[1], "level": r[2], "rank": get_rank_name(r[2])} for r in c.fetchall()]
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("""
            SELECT username, points, level,
                   (SELECT COUNT(DISTINCT manga_id) FROM reader_points_log WHERE email = u.email) as chapters_read,
                   (SELECT COUNT(*) FROM follows WHERE following_email = u.email) as followers
            FROM users u WHERE role != 'admin' ORDER BY points DESC LIMIT 100
        """)
        rows = c.fetchall()
        results = []
        for i, (username, points, level, chapters_read, followers) in enumerate(rows, 1):
            results.append({"rank": i, "username": username, "points": points, "level": level, "rank_name": get_rank_name(level), "chapters_read": chapters_read, "followers": followers})
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    user = get_session_user()
    if not user:
        return jsonify([]), 200
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("""
            SELECT n.id, n.type, n.title, n.message, n.manga_id, n.chapter_id, n.is_read, n.created_at, n.actor_email,
                   (SELECT username FROM users WHERE email = n.actor_email) as actor_username
            FROM notifications n WHERE n.email = ? ORDER BY n.created_at DESC LIMIT 50
        """, (user['email'],))
        rows = c.fetchall()
        results = []
        for rid, ntype, title, message, manga_id, chapter_id, is_read, created_at, actor_email, actor_username in rows:
            results.append({
                "id": rid, "type": ntype, "title": title, "message": message,
                "manga_id": manga_id, "chapter_id": chapter_id, "is_read": bool(is_read),
                "time": created_at, "actor_username": actor_username or ""
            })
    finally:
        conn.close()
    return jsonify(results), 200

@app.route('/api/notifications/unread-count', methods=['GET'])
def unread_notifications_count():
    user = get_session_user()
    if not user:
        return jsonify({"count": 0}), 200
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM notifications WHERE email = ? AND is_read = 0", (user['email'],))
        count = c.fetchone()[0]
    finally:
        conn.close()
    return jsonify({"count": count}), 200

@app.route('/api/notifications/mark-read', methods=['POST'])
def mark_notification_read():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    data = request.get_json() or {}
    notification_id = data.get('id')
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        if notification_id:
            c.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND email = ?", (notification_id, user['email']))
        else:
            c.execute("UPDATE notifications SET is_read = 1 WHERE email = ?", (user['email'],))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True}), 200

# ============================================================
# DAILY REWARDS / STREAK SYSTEM
# ============================================================

REWARD_TABLE = {1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 40}

def get_today_str():
    return time.strftime("%Y-%m-%d")

def get_yesterday_str():
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() - 86400))

@app.route('/api/rewards/status', methods=['GET'])
def rewards_status():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT streak_days, last_claim_date FROM users WHERE email = ?", (user['email'],))
        row = c.fetchone()
        streak = row[0] if row else 0
        last_claim = row[1] if row else ""
        today = get_today_str()
        
        can_claim = False
        current_day = 1
        if last_claim == today:
            can_claim = False
            current_day = streak % 7
            if current_day == 0: current_day = 7
        else:
            can_claim = True
            yesterday = get_yesterday_str()
            if last_claim == yesterday:
                new_streak = min(streak + 1, 7)
                current_day = new_streak
            else:
                current_day = 1
                streak = 0
        
        rewards_list = []
        for day, pts in REWARD_TABLE.items():
            rewards_list.append({"day": day, "points": pts, "is_week_bonus": day == 7})
    finally:
        conn.close()
    
    return jsonify({
        "can_claim": can_claim,
        "current_streak": streak,
        "current_day": current_day,
        "last_claim_date": last_claim,
        "today": today,
        "rewards": rewards_list
    }), 200

@app.route('/api/rewards/claim_daily', methods=['POST'])
def claim_daily():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    conn = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c = conn.cursor()
        c.execute("SELECT streak_days, last_claim_date, points, level FROM users WHERE email = ?", (user['email'],))
        row = c.fetchone()
        if not row:
            return jsonify({"error": "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯"}), 404
        streak, last_claim, current_points, current_level = row
        today = get_today_str()
        yesterday = get_yesterday_str()
        
        if last_claim == today:
            return jsonify({"error": "Ù„Ù‚Ø¯ Ø­ØµÙ„Øª Ø¹Ù„Ù‰ Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„ÙŠÙˆÙ… Ø¨Ø§Ù„ÙØ¹Ù„"}), 400
        
        new_streak = min(streak + 1, 7) if last_claim == yesterday else 1
        reward_points = REWARD_TABLE[new_streak]
        new_points = current_points + reward_points
        new_level = calculate_level(new_points)
        
        c.execute("UPDATE users SET streak_days = ?, last_claim_date = ?, points = ?, level = ? WHERE email = ?",
                  (new_streak, today, new_points, new_level, user['email']))
        conn.commit()
    finally:
        conn.close()
    
    conn2 = sqlite3.connect(DB_FILE, timeout=10)
    try:
        c2 = conn2.cursor()
        c2.execute("INSERT INTO reader_points_log (manga_id, chapter_id, email, earned_at, xp_change) VALUES (?, ?, ?, ?, ?)",
                   ("daily_reward", f"day_{new_streak}", user['email'], time.time(), reward_points))
        conn2.commit()
    finally:
        conn2.close()
    
    return jsonify({
        "success": True,
        "streak": new_streak,
        "day": new_streak,
        "reward_points": reward_points,
        "total_points": new_points,
        "level": new_level,
        "message": f"Ù…Ø¨Ø±ÙˆÙƒ! Ø­ØµÙ„Øª Ø¹Ù„Ù‰ {reward_points} Ù†Ù‚Ø·Ø©!"
    }), 200

# ============================================================
# MANGA DATA
# ============================================================
@app.route('/api/save_manga', methods=['POST'])
def save_manga():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† Ø§Ù„Ù…Ø¯ÙŠØ± Ù„Ù„Ù‚ÙŠØ§Ù… Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„"}), 403
    manga_data = request.get_json() or {}
    manga_id = manga_data.get("id")
    if not manga_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù…ÙÙ‚ÙˆØ¯"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    
    old_chapter_ids = set()
    new_chapter_ids = set()
    manga_title = manga_data.get('title', '')
    
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
            old_manga = next((m for m in scraped_db if str(m.get("id")) == str(manga_id)), None)
            if old_manga and old_manga.get('chapters'):
                old_chapter_ids = set(str(ch.get('id')) for ch in old_manga['chapters'])
        except Exception:
            scraped_db = []
    else:
        scraped_db = []
    
    scraped_db = [m for m in scraped_db if str(m.get("id")) != str(manga_id)]
    scraped_db.append(manga_data)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)
    
    if manga_data.get('chapters'):
        new_chapter_ids = set(str(ch.get('id')) for ch in manga_data['chapters'])
        added = new_chapter_ids - old_chapter_ids
        if added:
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, settings_json FROM user_settings')
                    rows = c.fetchall()
                    for email, settings_json in rows:
                        if not settings_json:
                            continue
                        try:
                            settings = json.loads(settings_json)
                        except (json.JSONDecodeError, TypeError):
                            continue
                        bookmarks = settings.get('bookmarks', {})
                        status = bookmarks.get(str(manga_id))
                        if status in ('reading', 'plan'):
                            for ch_id in sorted(added, key=float):
                                create_notification(
                                    email=email,
                                    type='new_chapter',
                                    title='ÙØµÙ„ Ø¬Ø¯ÙŠØ¯',
                                    message=f'ØªÙ… Ø¥Ø¶Ø§ÙØ© ÙØµÙ„ Ø¬Ø¯ÙŠØ¯ ({ch_id}) Ù„Ù€ {manga_title}',
                                    manga_id=manga_id,
                                    chapter_id=ch_id
                                )
                finally:
                    conn.close()
            except Exception as e:
                print(f"Notification creation error: {e}")
    
    import threading
    threading.Thread(target=ping_google_sitemap, daemon=True).start()
    return jsonify({"status": "success", "title": manga_data.get("title")}), 200

@app.route('/api/chapter/<manga_id>', methods=['POST'])
def add_chapter(manga_id):
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
    data = request.get_json() or {}
    chapter_id = str(data.get('id', ''))
    chapter_title = data.get('title', '')
    chapter_date = data.get('date', '')
    chapter_images = data.get('images', [])
    if not chapter_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù Ø§Ù„ÙØµÙ„ Ù…Ø·Ù„ÙˆØ¨"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    scraped_db = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            pass
    manga_idx = next((i for i, m in enumerate(scraped_db) if str(m.get('id')) == str(manga_id)), None)
    if manga_idx is None:
        return jsonify({"error": "Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©"}), 404
    manga = scraped_db[manga_idx]
    old_chapter_ids = set(str(ch.get('id')) for ch in (manga.get('chapters') or []))
    new_chapter = {
        'id': chapter_id,
        'title': chapter_title or f'Ø§Ù„ÙØµÙ„ {chapter_id}',
        'date': chapter_date or time.strftime('%Y-%m-%d'),
        'images': chapter_images
    }
    manga['chapters'] = [ch for ch in (manga.get('chapters') or []) if str(ch.get('id')) != chapter_id]
    manga['chapters'].append(new_chapter)
    manga['chapters'].sort(key=lambda ch: float(ch.get('id', 0)), reverse=True)
    scraped_db[manga_idx] = manga
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)
    manga_title = manga.get('title', '')
    if chapter_id not in old_chapter_ids:
        try:
            conn = sqlite3.connect(DB_FILE, timeout=30)
            try:
                c = conn.cursor()
                c.execute('SELECT email, settings_json FROM user_settings')
                rows = c.fetchall()
                for email, settings_json in rows:
                    if not settings_json:
                        continue
                    try:
                        settings = json.loads(settings_json)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    bookmarks = settings.get('bookmarks', {})
                    status = bookmarks.get(str(manga_id))
                    if status in ('reading', 'plan'):
                        create_notification(
                            email=email,
                            type='new_chapter',
                            title='ÙØµÙ„ Ø¬Ø¯ÙŠØ¯',
                            message=f'ØªÙ… Ø¥Ø¶Ø§ÙØ© ÙØµÙ„ Ø¬Ø¯ÙŠØ¯ ({chapter_id}) Ù„Ù€ {manga_title}',
                            manga_id=manga_id,
                            chapter_id=chapter_id
                        )
            finally:
                conn.close()
        except Exception as e:
            print(f"Notification creation error: {e}")
    import threading
    threading.Thread(target=ping_google_sitemap, daemon=True).start()
    return jsonify({"status": "success", "message": f"ØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙØµÙ„ {chapter_id}"}), 200

@app.route('/api/delete_manga', methods=['POST'])
def delete_manga():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ ÙŠØ¬Ø¨ Ø£Ù† ØªÙƒÙˆÙ† Ø§Ù„Ù…Ø¯ÙŠØ± Ù„Ù„Ù‚ÙŠØ§Ù… Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø¹Ù…Ù„"}), 403
    data = request.get_json() or {}
    manga_id = data.get("id")
    if not manga_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù…ÙÙ‚ÙˆØ¯"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    scraped_db = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            pass
    scraped_db = [m for m in scraped_db if str(m.get("id")) != str(manga_id)]
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)

    # Also delete from SQLite database
    try:
        c = get_db().cursor()
        c.execute("DELETE FROM chapters WHERE manga_id = ?", (manga_id,))
        c.execute("DELETE FROM manga WHERE id = ?", (manga_id,))
        get_db().commit()
    except Exception:
        pass

    # Delete drafts directory if exists
    draft_dir = os.path.join(BASE_DIR, "static", "drafts", manga_id)
    if os.path.exists(draft_dir):
        import shutil
        shutil.rmtree(draft_dir, ignore_errors=True)

    import threading
    threading.Thread(target=ping_google_sitemap, daemon=True).start()
    return jsonify({"status": "success", "message": "ØªÙ… Ø­Ø°Ù Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ø¨Ù†Ø¬Ø§Ø­"}), 200


@app.route('/api/admin/update-cover', methods=['POST'])
def admin_update_cover():
    user = get_session_user()
    if not user or user.get('role') != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
    data = request.get_json() or {}
    manga_id = data.get("id")
    cover_url = data.get("cover", "").strip()
    if not manga_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù…ÙÙ‚ÙˆØ¯"}), 400

    json_path = os.path.join(BASE_DIR, "scraped_mangas.json")
    scraped_db = []
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            scraped_db = []

    manga = next((m for m in scraped_db if str(m.get("id")) == str(manga_id)), None)
    if not manga:
        return jsonify({"error": "Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©"}), 404
    manga["cover"] = cover_url

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)

    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        c = conn.cursor()
        c.execute("UPDATE manga SET cover_url = ?, updated_at = ? WHERE id = ?", (cover_url, time.time(), manga_id))
        conn.commit()
        conn.close()
    except Exception:
        pass

    import threading
    threading.Thread(target=ping_google_sitemap, daemon=True).start()
    return jsonify({"status": "success", "message": "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„ØºÙ„Ø§Ù  Ø¨Ù†Ø¬Ø§Ø­", "cover": cover_url}), 200


@app.route('/api/admin/update-genres', methods=['POST'])
def admin_update_genres():
    user = get_session_user()
    if not user or user.get('role') != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403
    data = request.get_json() or {}
    manga_id = data.get("id")
    genres_raw = data.get("genres", "").strip()
    if not manga_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù  Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù…Ù Ù‚ÙˆØ¯"}), 400

    genres_list = [g.strip() for g in genres_raw.replace("ØŒ", ",").split(",") if g.strip()]
    genres_str = ", ".join(genres_list)

    json_path = os.path.join(BASE_DIR, "scraped_mangas.json")
    scraped_db = []
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            scraped_db = []

    manga = next((m for m in scraped_db if str(m.get("id")) == str(manga_id)), None)
    if not manga:
        return jsonify({"error": "Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©"}), 404
    manga["genres"] = genres_list if isinstance(manga.get("genres"), list) else genres_str

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)

    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        c = conn.cursor()
        c.execute("UPDATE manga SET genres = ?, updated_at = ? WHERE id = ?", (genres_str, time.time(), manga_id))
        conn.commit()
        conn.close()
    except Exception:
        pass

    return jsonify({"status": "success", "message": "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª Ø¨Ù†Ø¬Ø§Ø­"}), 200


# ============================================================
# SUGGESTIONS
# ============================================================
@app.route('/api/suggestions', methods=['GET'])
def get_suggestions():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·"}), 403
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, type, content, created_at FROM suggestions ORDER BY created_at DESC')
        rows = c.fetchall()
    finally:
        conn.close()
    results = [{"email": r[0], "type": r[1], "content": r[2], "created_at": r[3]} for r in rows]
    return jsonify(results), 200

@app.route('/api/manga/<manga_id>/chapters', methods=['GET'])
def get_completed_chapters(manga_id):
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, title, number, source_url as url, created_at FROM chapters WHERE manga_id = ? AND status = 'completed' ORDER BY number DESC", (manga_id,))
        rows = c.fetchall()
        conn.close()
        chapters = [{"id": r["id"], "title": r["title"], "number": r["number"], "url": r["url"], "created_at": r["created_at"]} for r in rows]
        return jsonify({"success": True, "chapters": chapters})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/suggestions', methods=['POST'])
def post_suggestion():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    data = request.get_json() or {}
    sug_type = data.get('type', 'suggestion').strip()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ ÙƒØªØ§Ø¨Ø© Ù†Øµ Ø§Ù„Ø±Ø³Ø§Ù„Ø©"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT INTO suggestions (email, type, content, created_at) VALUES (?, ?, ?, ?)',
                  (user['email'], sug_type, content, time.time()))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„ØªÙƒ Ø¨Ù†Ø¬Ø§Ø­"}), 200

# ============================================================
# REVIEWS
# ============================================================
@app.route('/api/manga_reviews', methods=['GET'])
def get_manga_reviews():
    manga_id = request.args.get('manga_id')
    if not manga_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ Ù…Ø·Ù„ÙˆØ¨"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, rating, review_text, created_at FROM manga_reviews WHERE manga_id = ? ORDER BY created_at DESC', (manga_id,))
        rows = c.fetchall()
    finally:
        conn.close()
    results = [{"email": r[0], "rating": r[1], "review_text": r[2], "created_at": r[3]} for r in rows]
    return jsonify(results), 200

@app.route('/api/manga_reviews', methods=['POST'])
def post_manga_review():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    data = request.get_json() or {}
    manga_id = data.get('manga_id', '').strip()
    try:
        rating = int(data.get('rating', 10))
    except (ValueError, TypeError):
        rating = 10
    review_text = data.get('review_text', '').strip()
    if not manga_id or rating < 1 or rating > 10:
        return jsonify({"error": "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ØºÙŠØ± ØµØ§Ù„Ø­Ø©"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO manga_reviews (manga_id, email, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?)',
                  (manga_id, user['email'], rating, review_text, time.time()))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "ØªÙ… Ø­ÙØ¸ ØªÙ‚ÙŠÙŠÙ…Ùƒ ÙˆÙ…Ø±Ø§Ø¬Ø¹ØªÙƒ Ø¨Ù†Ø¬Ø§Ø­"}), 200

# ============================================================
# COMMENTS
# ============================================================
@app.route('/api/chapter_comments', methods=['GET'])
def get_chapter_comments():
    manga_id = request.args.get('manga_id')
    chapter_id = request.args.get('chapter_id')
    if not manga_id or not chapter_id:
        return jsonify({"error": "Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†Ù‡ÙˆØ§ ÙˆØ§Ù„ÙØµÙ„ Ù…Ø·Ù„ÙˆØ¨Ø§Ù†"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, comment_text, created_at, badge FROM chapter_comments WHERE manga_id = ? AND chapter_id = ? ORDER BY created_at ASC', (manga_id, chapter_id))
        rows = c.fetchall()
    finally:
        conn.close()
    results = [{"email": r[0], "comment_text": r[1], "created_at": r[2], "badge": r[3] or ''} for r in rows]
    return jsonify(results), 200

@app.route('/api/chapter_comments', methods=['POST'])
def post_chapter_comment():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ø§Ù„Ø±Ø¬Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„"}), 401
    data = request.get_json() or {}
    manga_id = data.get('manga_id', '').strip()
    chapter_id = data.get('chapter_id', '').strip()
    comment_text = data.get('comment_text', '').strip()
    if not manga_id or not chapter_id or not comment_text:
        return jsonify({"error": "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT COUNT(*) FROM chapter_comments WHERE manga_id = ? AND chapter_id = ?',
                  (manga_id, chapter_id))
        count = c.fetchone()[0]
        badges = {0: 'gold', 1: 'bronze', 2: 'silver'}
        badge = badges.get(count, '')
        c.execute('INSERT INTO chapter_comments (manga_id, chapter_id, email, comment_text, created_at, badge) VALUES (?, ?, ?, ?, ?, ?)',
                  (manga_id, chapter_id, user['email'], comment_text, time.time(), badge))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "ØªÙ… Ù†Ø´Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ Ø¨Ù†Ø¬Ø§Ø­", "badge": badge}), 200

# ============================================================
# AUTO COVER (AniList Search)
# ============================================================
@app.route('/api/auto_cover')
def auto_cover():
    title = request.args.get('title')
    if not title:
        return jsonify({"error": "Missing 'title' parameter"}), 400
    try:
        anilist_query = json.dumps({
            "query": "query ($search: String) { Media (search: $search, type: MANGA) { id title { romaji english } coverImage { extraLarge large } bannerImage } }",
            "variables": {"search": title}
        })
        req = urllib.request.Request(
            'https://graphql.anilist.co',
            data=anilist_query.encode('utf-8'),
            headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Kairo/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        media = result.get('data', {}).get('Media')
        if media:
            return jsonify({
                "found": True,
                "cover": media.get('coverImage', {}).get('extraLarge') or media.get('coverImage', {}).get('large', ''),
                "banner": media.get('bannerImage', ''),
                "title_en": (media.get('title', {}) or {}).get('english', ''),
                "title_romaji": (media.get('title', {}) or {}).get('romaji', '')
            })
        else:
            return jsonify({"found": False})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================
# IMAGE PROXY â€” persistent Playwright browser for Cloudflare bypass
# ============================================================
ALLOWED_IMAGE_DOMAINS = {
    'lekmanga.site', 'lek-manga.com', 'cdn.lekmanga.site',
    'mangazuki.site', 'img.mangazuki.com',
    'comick.io', 'uploads.comick.io',
    'manga-zukui.com',
    'olympustaff.com', 'cdn.olympustaff.com',
    'imgsrv4.com',
    'mgeko.cc', 'www.mgeko.cc',
    'uploads.mangadex.org', 'mangadex.org',
    'mangatime.org', 'www.mangatime.org',
    'hijala.com',
}

# Persistent Playwright browser for proxy-image (avoids Cloudflare re-challenge)
_playwright = None
_pw_browser = None
_pw_lock = threading.Lock()

def _get_pw_browser():
    global _playwright, _pw_browser
    if _pw_browser is None:
        with _pw_lock:
            if _pw_browser is None:  # Double-checked locking
                from playwright.sync_api import sync_playwright
                _playwright = sync_playwright()
                _playwright.__enter__()
                _pw_browser = _playwright.chromium.launch(headless=True)
                import atexit
                atexit.register(_close_pw_browser)
    return _pw_browser

def _close_pw_browser():
    global _playwright, _pw_browser
    if _pw_browser:
        try:
            _pw_browser.close()
        except Exception:
            pass
        _pw_browser = None
    if _playwright:
        try:
            _playwright.__exit__(None, None, None)
        except Exception:
            pass
        _playwright = None

def _pw_fetch_image(image_url, timeout=30000):
    """Fetch a single image using the persistent Playwright browser (passes Cloudflare)"""
    try:
        browser = _get_pw_browser()
        page = browser.new_page()
        try:
            resp = page.goto(image_url, wait_until='load', timeout=timeout)
            if resp and resp.ok:
                data = resp.body()
                page.close()
                return data
            page.close()
            return None
        except Exception:
            page.close()
            return None
    except Exception:
        return None

# ============================================================
# Smart image preloader â€” progressive chapter caching
# ============================================================
PRELOAD_SEMAPHORE = threading.Semaphore(3)
_preload_cache = {}
_preload_cache_lock = threading.Lock()

def _is_preloaded(manga_id, chapter_id):
    with _preload_cache_lock:
        return _preload_cache.get(f"{manga_id}_{chapter_id}", False)

def _mark_preloaded(manga_id, chapter_id):
    with _preload_cache_lock:
        _preload_cache[f"{manga_id}_{chapter_id}"] = True

def preload_chapter_images_bg(manga_id, chapter_id, quality=90):
    """Download all images of a chapter into cache, with rate limiting"""
    key = f"{manga_id}_{chapter_id}"
    if _is_preloaded(manga_id, chapter_id):
        return
    import json
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            scraped_db = json.load(f)
    except Exception:
        return
    manga = next((m for m in scraped_db if str(m.get('id')) == str(manga_id)), None)
    if not manga:
        return
    chapter = next((ch for ch in (manga.get('chapters') or []) if str(ch.get('id')) == str(chapter_id)), None)
    if not chapter:
        return
    images = chapter.get('images', [])
    if not images:
        return
    _mark_preloaded(manga_id, chapter_id)
    for url in images:
        PRELOAD_SEMAPHORE.acquire()
        try:
            url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
            cache_jpeg = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
            if os.path.exists(cache_jpeg):
                continue
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                img_data = resp.read()
            if PIL_AVAILABLE:
                try:
                    img = Image.open(io.BytesIO(img_data))
                    img = _apply_watermark(img)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    webp_q = int(quality * 0.85)
                    img.save(cache_jpeg, "JPEG", quality=quality)
                    cache_webp = os.path.join(CACHE_DIR, f"{url_hash}.webp")
                    try:
                        img.save(cache_webp, "WEBP", quality=webp_q)
                    except Exception:
                        pass
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            PRELOAD_SEMAPHORE.release()
            time.sleep(0.5)  # Ù†ØµÙ Ø«Ø§Ù†ÙŠØ© Ø¨ÙŠÙ† Ø§Ù„ØµÙˆØ± â€” ÙŠÙ…Ù†Ø¹ Ø­Ø¸Ø± Ø§Ù„Ù…ØµØ¯Ø±

def preload_first_chapters(manga_id, count=5):
    """Preload first N chapters of a manga in background"""
    import json
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            scraped_db = json.load(f)
    except Exception:
        return
    manga = next((m for m in scraped_db if str(m.get('id')) == str(manga_id)), None)
    if not manga or not manga.get('chapters'):
        return
    chapters = manga['chapters']
    # Sort chapters by numeric id ascending
    chapters_sorted = sorted(chapters, key=lambda ch: float(ch.get('id', '0')))
    for ch in chapters_sorted[:count]:
        if _is_preloaded(manga_id, ch.get('id')):
            continue
        t = threading.Thread(target=preload_chapter_images_bg, args=(manga_id, ch.get('id')), daemon=True)
        t.start()

@app.route('/api/preload-chapter', methods=['POST'])
def api_preload_chapter():
    """API: preload a specific chapter's images in background"""
    data = request.get_json(silent=True) or {}
    manga_id = str(data.get('manga_id', '')).strip()
    chapter_id = str(data.get('chapter_id', '')).strip()
    if not manga_id or not chapter_id:
        return jsonify({"error": "manga_id and chapter_id required"}), 400
    thread = threading.Thread(target=preload_chapter_images_bg, args=(manga_id, chapter_id), daemon=True)
    thread.start()
    return jsonify({"status": "preloading", "manga_id": manga_id, "chapter_id": chapter_id})

@app.route('/proxy-image')
def proxy_image():
    image_url = request.args.get('url')
    quality = request.args.get('q', '90')
    try:
        quality = max(10, min(100, int(quality)))
    except (ValueError, TypeError):
        quality = 90
    if not image_url:
        return jsonify({"error": "Missing url parameter"}), 400

    # Ù…Ù†Ø¹ SSRF â€” Ø§Ù„Ø³Ù…Ø§Ø­ ÙÙ‚Ø· Ø¨Ù†Ø·Ø§Ù‚Ø§Øª Ø§Ù„ØµÙˆØ± Ø§Ù„Ù…Ø¹Ø±ÙˆÙØ©
    try:
        parsed = urllib.parse.urlparse(image_url)
        if parsed.hostname not in ALLOWED_IMAGE_DOMAINS:
            return jsonify({"error": "Ù…ØµØ¯Ø± Ø§Ù„ØµÙˆØ±Ø© ØºÙŠØ± Ù…Ø³Ù…ÙˆØ­ Ø¨Ù‡"}), 403
    except Exception:
        return jsonify({"error": "Ø±Ø§Ø¨Ø· ØºÙŠØ± ØµØ§Ù„Ø­"}), 400

    if not re.search(r'\.(jpg|jpeg|png|webp)(\?|$)', image_url, re.I):
        return jsonify({"error": "Ø§Ù„Ø±Ø§Ø¨Ø· Ù„Ø§ ÙŠØ´ÙŠØ± Ø¥Ù„Ù‰ ØµÙˆØ±Ø©"}), 400

    url_hash = hashlib.md5(f"{image_url}:q={quality}".encode('utf-8')).hexdigest()
    cache_jpeg = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
    cache_webp = os.path.join(CACHE_DIR, f"{url_hash}.webp")

    accept = request.headers.get('Accept', '')
    wants_webp = 'image/webp' in accept

    if wants_webp and os.path.exists(cache_webp):
        return send_file(cache_webp, mimetype='image/webp', max_age=86400)
    if os.path.exists(cache_jpeg):
        return send_file(cache_jpeg, mimetype='image/jpeg', max_age=86400)

    # Try cloudscraper first (fastest)
    img_data = None
    try:
        import cloudscraper
        cs = cloudscraper.create_scraper()
        resp = cs.get(image_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}, timeout=15)
        if resp.status_code == 200:
            img_data = resp.content
    except Exception:
        pass

    # Fallback: try plain urllib
    if img_data is None:
        try:
            req = urllib.request.Request(
                image_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                img_data = response.read()
        except Exception:
            pass

    # Last resort: use persistent Playwright browser (handles Cloudflare JS challenges)
    if img_data is None:
        img_data = _pw_fetch_image(image_url)

    if img_data is None:
        return jsonify({"error": "ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙˆØ±Ø©"}), 502

    # Detect original MIME type from URL extension or magic bytes
    orig_mime = 'image/jpeg'
    ext_match = re.search(r'\.(png|webp|jpg|jpeg)(\?|$)', image_url, re.I)
    if ext_match:
        ext = ext_match.group(1).lower()
        if ext == 'png': orig_mime = 'image/png'
        elif ext == 'webp': orig_mime = 'image/webp'
        elif ext in ('jpg', 'jpeg'): orig_mime = 'image/jpeg'
    else:
        if img_data[:4] == b'\x89PNG': orig_mime = 'image/png'
        elif img_data[:4] == b'RIFF': orig_mime = 'image/webp'

    wm_config = _get_watermark_config()
    wm_enabled = wm_config.get('watermark_enabled', 'false').lower() == 'true'

    # Serve original bytes unless Kairo watermark is enabled
    if not wm_enabled:
        return send_file(io.BytesIO(img_data), mimetype=orig_mime, max_age=86400)

    # Only re-encode when Kairo watermark is active
    if PIL_AVAILABLE:
        try:
            img = Image.open(io.BytesIO(img_data))
            # Try to remove olympustaff watermarks too
            try:
                wm_removed = image_processor.process_image_watermark(img)
                if wm_removed > 0:
                    print(f"[proxy-image] Removed {wm_removed} olympustaff watermark(s)")
            except Exception:
                pass
            img = _apply_watermark(img)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            webp_q = int(quality * 0.85)
            img.save(cache_jpeg, "JPEG", quality=quality)
            try:
                img.save(cache_webp, "WEBP", quality=webp_q)
            except Exception:
                pass
            if wants_webp and os.path.exists(cache_webp):
                return send_file(cache_webp, mimetype='image/webp', max_age=86400)
            return send_file(cache_jpeg, mimetype='image/jpeg', max_age=86400)
        except Exception:
            pass

    return send_file(io.BytesIO(img_data), mimetype=orig_mime)


@app.route('/api/admin/auto-translate', methods=['POST'])
def auto_translate():
    """API endpoint â€” ÙŠØ³ØªÙ‚Ø¨Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ø§Ù†Ù‡ÙˆØ§ ÙˆÙŠÙØ¯Ø®Ù„Ù‡ ÙÙŠ Ø·Ø§Ø¨ÙˆØ± Celery."""
    from tasks import process_chapter

    user = get_session_user()
    if not user or user.get('role') != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 403

    data = request.get_json() or {}
    source_url = data.get('url', '').strip()
    manga_id = data.get('manga_id', '')
    chapter_id = data.get('chapter_id', '')

    if not source_url or not manga_id or not chapter_id:
        return jsonify({"error": "Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø±Ø§Ø¨Ø·ØŒ Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ø§Ù†Ø¬Ø§ØŒ ÙˆÙ…Ø¹Ø±Ù Ø§Ù„ÙØµÙ„"}), 400

    image_urls = None
    try:
        import json as _json
        with open("scraped_mangas.json", "r", encoding="utf-8") as _f:
            _catalog = _json.load(_f)
        for _m in _catalog:
            if _m.get("id") == manga_id:
                for _ch in _m.get("chapters", []):
                    if _ch.get("id") == chapter_id:
                        _imgs = _ch.get("images", [])
                        if _imgs:
                            image_urls = _imgs
                        break
                break
    except Exception:
        pass

    task = process_chapter.delay(manga_id, chapter_id, source_url, image_urls=image_urls)
    return jsonify({
        "status": "queued",
        "task_id": task.id,
        "message": "ØªÙ… ÙˆØ¶Ø¹ Ø§Ù„ÙØµÙ„ ÙÙŠ Ø·Ø§Ø¨ÙˆØ± Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø©"
    }), 202

@app.route('/api/admin/notifications/broadcast', methods=['POST'])
@require_admin
def broadcast_notification():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    message = data.get('message', '').strip()
    notif_type = data.get('type', 'broadcast').strip()
    if not title or not message:
        return jsonify({"error": "Ø§Ù„Ø¹Ù†ÙˆØ§Ù† ÙˆØ§Ù„Ø±Ø³Ø§Ù„Ø© Ù…Ø·Ù„ÙˆØ¨Ø§Ù†"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users')
        users = c.fetchall()
        for (email,) in users:
            create_notification(email=email, type=notif_type, title=title, message=message)
    finally:
        conn.close()
    return jsonify({"status": "success", "message": f"ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± Ø¥Ù„Ù‰ {len(users)} Ù…Ø³ØªØ®Ø¯Ù…"}), 200

@app.route('/api/admin/import-manga', methods=['POST', 'OPTIONS'])
def admin_import_manga():
    """Import manga from external URL - creates manga + chapters in DB"""
    if request.method == 'OPTIONS':
        return jsonify({}), 204
    
    user = get_session_user()
    if not user or user.get('role') != 'admin':
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­ØŒ Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·"}), 403
    
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    scrape_images = data.get('scrape_images', False)
    auto_translate = data.get('auto_translate', False)
    
    if not url:
        return jsonify({'success': False, 'error': 'Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ø§Ù†Ø¬Ø§'}), 400
    
    try:
        from scrapers.importer import import_manga_from_url
        result = import_manga_from_url(url, db_path="kairo.db", scrape_images=scrape_images, max_threads=5)
        
        if not result.get('success'):
            return jsonify({'success': False, 'error': result.get('error', 'ÙØ´Ù„ Ø§Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯')}), 400
        
        response = {
            'success': True,
            'manga_id': result['manga_id'],
            'title': result['title'],
            'chapters_count': result['chapters_count'],
            'cover_url': result.get('cover_url', ''),
            'message': f'ØªÙ… Ø§Ø³ØªÙŠØ±Ø§Ø¯ {result["title"]} Ø¨Ù†Ø¬Ø§Ø­ Ù…Ø¹ {result["chapters_count"]} ÙØµÙ„'
        }
        
        # Optionally trigger auto-translation for all chapters
        if auto_translate and result.get('chapters_count', 0) > 0:
            try:
                from tasks import process_chapter
                queued = 0
                for ch in result.get('chapters', []):
                    ch_id = ch.get('id') or ch.get('number') or str(hash(ch.get('url', '')))
                    process_chapter.delay(result['manga_id'], str(ch_id), ch.get('url', ''))
                    queued += 1
                response['translation_queued'] = queued
                response['message'] += f' ÙˆØªÙ… ÙˆØ¶Ø¹ {queued} ÙØµÙ„ ÙÙŠ Ø·Ø§Ø¨ÙˆØ± Ø§Ù„ØªØ±Ø¬Ù…Ø©'
            except Exception as e:
                response['translation_note'] = f'ØªÙ… Ø§Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù„ÙƒÙ† ÙØ´Ù„ Ø¨Ø¯Ø¡ Ø§Ù„ØªØ±Ø¬Ù…Ø©: {str(e)}'
        
        return jsonify(response), 201
        
    except ImportError:
        return jsonify({'success': False, 'error': 'Ù…ÙƒØªØ¨Ø© Ø§Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯ ØºÙŠØ± Ù…ØªÙˆÙØ±Ø© (manga_importer.py)'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯: {str(e)}'}), 500

@app.route('/api/admin/import-manga/sources', methods=['GET'])
def import_manga_sources():
    """Return supported import sources"""
    return jsonify({
        'sources': [
            {'name': 'lekmanga', 'label': 'LekManga', 'url_pattern': 'lekmanga.site'},
            {'name': 'generic_madara', 'label': 'Ù…ÙˆØ§Ù‚Ø¹ Madara', 'url_pattern': 'Ø£ÙŠ Ù…ÙˆÙ‚Ø¹ ÙˆÙˆØ±Ø¯Ø¨Ø±ÙŠØ³ Ù…Ø§Ù†Ø¬Ø§'},
        ],
        'supported': True
    })

@app.route('/api/start-full-manga-download', methods=['POST'])
@require_admin
def start_full_manga_download():
    data = request.get_json() or {}
    source_url = data.get('source_url', '').strip()
    
    if not source_url:
        return jsonify({"error": "ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ø§Ù†Ù‡ÙˆØ§"}), 400
        
    try:
        from scrapers.importer import import_manga_from_url
        import_result = import_manga_from_url(source_url, scrape_images=False)
        
        if "error" in import_result:
            return jsonify({"error": import_result["error"]}), 400
            
        from tasks import download_full_manga
        task = download_full_manga.delay(source_url)
        
        return jsonify({
            "success": True,
            "message": "ØªÙ… Ø¨Ø¯Ø¡ Ø§Ù„Ø£ØªÙ…ØªØ©! ÙŠØªÙ… Ø³Ø­Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙØµÙˆÙ„ Ø¢Ù„ÙŠØ§Ù‹ Ø¨ÙØ§ØµÙ„ Ø²Ù…Ù†ÙŠ.",
            "task_id": task.id,
            "manga_id": import_result.get("manga_id"),
            "title": import_result.get("title"),
            "chapters_count": import_result.get("chapters_count", 0)
        }), 200
    except Exception as e:
        app.logger.error(f"Failed to queue download_full_manga task: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"ÙØ´Ù„ Ø¨Ø¯Ø¡ Ø§Ù„Ù…Ù‡Ù…Ø©: {e}"}), 500

# ============================================================
# WATERMARK SYSTEM (wasmoo)
# ============================================================
def _get_watermark_config():
    config = {
        'watermark_enabled': 'false',
        'watermark_text': 'KAIRO / Ù…Ù†Ù‡ÙˆØ§',
        'watermark_opacity': '25',
        'watermark_font_size': '32',
        'watermark_position': 'bottom-right',
    }
    try:
        conn = sqlite3.connect(DB_FILE, timeout=5)
        c = conn.cursor()
        for key in config.keys():
            c.execute('SELECT value FROM system_settings WHERE key = ?', (key,))
            row = c.fetchone()
            if row:
                config[key] = row[0]
        conn.close()
    except Exception:
        pass
    return config

def _apply_watermark(img):
    config = _get_watermark_config()
    if config.get('watermark_enabled', 'false').lower() != 'true':
        return img
    text = config.get('watermark_text', '').strip()
    if not text:
        return img
    try:
        opacity = max(5, min(80, int(config.get('watermark_opacity', '25'))))
        font_size = max(14, min(72, int(config.get('watermark_font_size', '32'))))
        position = config.get('watermark_position', 'bottom-right')
    except (ValueError, TypeError):
        opacity, font_size, position = 25, 32, 'bottom-right'
    try:
        from PIL import ImageDraw, ImageFont
        if img.mode != 'RGBA':
            bg = img.convert('RGBA')
        else:
            bg = img
        overlay = Image.new('RGBA', bg.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        font = None
        for fp in ['C:\\Windows\\Fonts\\arial.ttf', 'C:\\Windows\\Fonts\\tahoma.ttf', 'C:\\Windows\\Fonts\\times.ttf']:
            if os.path.exists(fp):
                try:
                    font = ImageFont.truetype(fp, font_size)
                    break
                except Exception:
                    continue
        if font is None:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        margin = 20
        pos_map = {
            'center': ((bg.width - tw) // 2, (bg.height - th) // 2),
            'top-left': (margin, margin),
            'top-right': (bg.width - tw - margin, margin),
            'bottom-left': (margin, bg.height - th - margin),
        }
        xy = pos_map.get(position, (bg.width - tw - margin, bg.height - th - margin))
        alpha = int(255 * opacity / 100)
        draw.text((xy[0]+1, xy[1]+1), text, font=font, fill=(0, 0, 0, alpha))
        draw.text(xy, text, font=font, fill=(255, 255, 255, alpha))
        result = Image.alpha_composite(bg, overlay)
        return result.convert('RGB')
    except Exception:
        return img

@app.route('/api/admin/watermark-settings', methods=['GET'])
def get_watermark_settings():
    return jsonify(_get_watermark_config()), 200

@app.route('/api/admin/watermark-settings', methods=['POST'])
@require_admin
def save_watermark_settings():
    data = request.get_json() or {}
    keys = ['watermark_enabled', 'watermark_text', 'watermark_opacity', 'watermark_font_size', 'watermark_position']
    try:
        conn = sqlite3.connect(DB_FILE, timeout=30)
        c = conn.cursor()
        for key in keys:
            if key in data:
                c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', (key, str(data[key])))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "ØªÙ… Ø­ÙØ¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø¹Ù„Ø§Ù…Ø© Ø§Ù„Ù…Ø§Ø¦ÙŠØ©"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ============================================================
# READING HISTORY API
# ============================================================
@app.route('/api/user/reading-history', methods=['GET'])
def get_reading_history():
    user = get_session_user()
    if not user:
        return jsonify({"error": "ØºÙŠØ± Ù…ØµØ±Ø­"}), 401
    limit = request.args.get('limit', 20, type=int)
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT manga_id, chapter_id, page, updated_at FROM reading_progress WHERE email = ? ORDER BY updated_at DESC LIMIT ?', (user['email'], limit))
        rows = c.fetchall()
    finally:
        conn.close()
    history = [{"manga_id": r[0], "chapter_id": r[1], "page": r[2], "updated_at": r[3]} for r in rows]
    return jsonify(history), 200

# ============================================================
# SEARCH API
# ============================================================
@app.route('/api/search')
def search_mangas():
    q = request.args.get('q', '').strip().lower()
    if not q or len(q) < 2:
        return jsonify([]), 200
    mangas = load_scraped_mangas()
    results = []
    for m in mangas:
        score = 0
        title = (m.get('title') or '').lower()
        alt = (m.get('alternative') or '').lower()
        author = (m.get('author') or '').lower()
        genres = (m.get('genres') or '')
        if isinstance(genres, str):
            genres = genres.lower()
        elif isinstance(genres, list):
            genres = ', '.join(genres).lower()
        synopsis = (m.get('synopsis') or m.get('description') or '').lower()
        if q in title:
            score += 10
        if title.startswith(q):
            score += 5
        if q in alt:
            score += 3
        if q in author:
            score += 2
        if q in genres:
            score += 1
        if q in synopsis:
            score += 1
        if score > 0:
            results.append((score, {
                "id": m.get("id"),
                "title": m.get("title"),
                "cover": m.get("cover"),
                "author": m.get("author"),
                "genres": m.get("genres"),
                "type": m.get("type"),
                "status": m.get("status"),
            }))
    results.sort(key=lambda x: -x[0])
    return jsonify([r[1] for r in results[:20]]), 200

def _cache_image_data(img_url, img_data):
    """Save raw image data to local cache files (JPEG + WebP)"""
    url_hash = hashlib.md5(img_url.encode('utf-8')).hexdigest()
    cache_jpeg = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
    cache_webp = os.path.join(CACHE_DIR, f"{url_hash}.webp")
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(img_data))
        img = img.convert('RGB')
        img.save(cache_jpeg, "JPEG", quality=90)
        try:
            img.save(cache_webp, "WEBP", quality=85)
        except Exception:
            pass
    except Exception:
        with open(cache_jpeg, 'wb') as f:
            f.write(img_data)

def _download_chapter_images_playwright(image_urls, chapter_url):
    """Download all images via a single Playwright session using JS fetch (bypasses Cloudflare)"""
    from playwright.sync_api import sync_playwright
    results = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to chapter page first to pass Cloudflare JS challenge + set cookies
        try:
            page.goto(chapter_url, wait_until='networkidle', timeout=60000)
        except Exception:
            pass
        # Fetch ALL images via JS in same browser context (cookies inherited)
        js_code = '''async (urls) => {
            const results = [];
            for (const url of urls) {
                try {
                    const resp = await fetch(url, {credentials: 'include'});
                    const blob = await resp.blob();
                    const buf = await blob.arrayBuffer();
                    results.push({url, data: Array.from(new Uint8Array(buf))});
                } catch(e) {
                    results.push({url, error: e.message});
                }
            }
            return results;
        }'''
        js_data = page.evaluate(js_code, image_urls)
        browser.close()
    for item in js_data:
        if 'data' in item:
            results[item['url']] = bytes(item['data'])
    return results

@app.route('/api/fetch-chapter-images', methods=['POST'])
def fetch_chapter_images():
    """On-demand: scrape + download chapter images in ONE Playwright session"""
    data = request.get_json(silent=True) or {}
    manga_id = str(data.get('manga_id', '')).strip()
    chapter_id = str(data.get('chapter_id', '')).strip()

    if not manga_id or not chapter_id:
        return jsonify({"error": "manga_id and chapter_id required"}), 400

    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    if not os.path.exists(OUTPUT_FILE):
        return jsonify({"error": "No scraped manga data"}), 404

    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            scraped_db = json.load(f)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    manga = next((m for m in scraped_db if str(m.get('id')) == manga_id), None)
    if not manga:
        return jsonify({"error": "Manga not found"}), 404

    chapter = next((ch for ch in (manga.get('chapters') or []) if str(ch.get('id')) == chapter_id), None)
    if not chapter:
        return jsonify({"error": "Chapter not found"}), 404

    if chapter.get('images') and len(chapter['images']) > 0:
        return jsonify({"images": chapter['images'], "cached": True})

    chapter_url = chapter.get('url', '')
    if not chapter_url:
        return jsonify({"error": "Chapter has no URL to scrape"}), 400

    from playwright.sync_api import sync_playwright
    from bs4 import BeautifulSoup
    import urllib.parse

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        # Step 1: Navigate to chapter page (passes Cloudflare JS challenge)
        try:
            page.goto(chapter_url, wait_until='domcontentloaded', timeout=60000)
        except Exception:
            pass

        # Step 2: Extract image URLs from rendered page (NO download â€” served on-demand via /proxy-image)
        html = page.content()
        soup = BeautifulSoup(html, 'html.parser')
        images = []
        for img in soup.find_all('img'):
            src = img.get('src', '').strip().replace(' ', '%20')
            if not src:
                src = img.get('data-src', '').strip().replace(' ', '%20')
            if 'uploads/manga_' in src or 'images/manga/' in src:
                full = urllib.parse.urljoin(chapter_url, src)
                if full not in images:
                    images.append(full)
        if not images:
            browser.close()
            return jsonify({"error": "No images found in chapter page"}), 404

        browser.close()

        # Save URLs to JSON; actual image downloads happen on-demand through /proxy-image
        chapter['images'] = images
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(scraped_db, f, ensure_ascii=False, indent=2)

        # Smart preload: first 5 chapters in background
        threading.Thread(target=preload_first_chapters, args=(manga_id,), daemon=True).start()

        return jsonify({"images": images, "cached": False})


# ============================================================
# LIVE SCRAPING SSE
# ============================================================
@app.route('/api/admin/scrape_stream', methods=['GET'])
def scrape_stream():
    token = request.args.get('token')
    user = None
    if token:
        try:
            import sqlite3
            conn = sqlite3.connect(DB_FILE, timeout=30)
            c = conn.cursor()
            c.execute('SELECT email FROM sessions WHERE token = ?', (token,))
            srow = c.fetchone()
            if srow:
                c.execute('SELECT username, email, role FROM users WHERE email=?', (srow[0],))
            row = c.fetchone()
            if row:
                user = {"username": row[0], "email": row[1], "role": row[2]}
        except:
            pass
    if not user:
        user = get_session_user()

    if not user or user['role'] != 'admin':
        return jsonify({"error": "Unauthorized"}), 401
    
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "URL is required"}), 400

    def generate():
        import os
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        
        process = subprocess.Popen(
            ['python', 'add_manga.py', url],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
            encoding='utf-8',
            errors='replace'
        )
        
        yield "data: Starting scrape process...\n\n"
        
        for line in iter(process.stdout.readline, ''):
            if line:
                # Remove newlines and format for SSE
                clean_line = line.strip().replace('\n', ' ')
                yield f"data: {clean_line}\n\n"
        
        process.stdout.close()
        process.wait()
        yield "data: [DONE]\n\n"
        
    return Response(stream_with_context(generate()), mimetype='text/event-stream')



# ============================================================
# AUTO UPDATER TOGGLE
# ============================================================
UPDATER_CONFIG_FILE = os.path.join(BASE_DIR, 'mangas_data', 'auto_updater_config.json')

def get_updater_status():
    if not os.path.exists(UPDATER_CONFIG_FILE):
        return {"enabled": False}
    with open(UPDATER_CONFIG_FILE, 'r') as f:
        return json.load(f)

@app.route('/api/admin/updater_status', methods=['GET'])
def updater_status():
    return jsonify(get_updater_status())

@app.route('/api/admin/updater_toggle', methods=['POST'])
def updater_toggle():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json() or {}
    new_state = data.get('enabled', False)
    
    with open(UPDATER_CONFIG_FILE, 'w') as f:
        json.dump({"enabled": new_state}, f)
        
    return jsonify({"enabled": new_state})

if __name__ == '__main__':
    from werkzeug.serving import run_simple
    run_simple('0.0.0.0', 8000, app, threaded=True, use_reloader=False)
