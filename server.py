import os
import io
import sys
import re
import json
import math
import hashlib
import xml.etree.ElementTree as ET
import urllib.parse
import urllib.request
import http.server
import socketserver
import sqlite3
import secrets
import time
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import image_processor

# Reconfigure stdout/stderr to utf-8 for Windows console support
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PORT = 8000
CACHE_DIR = "image_cache"
DB_FILE = "kairo.db"

# Create cache directory if it doesn't exist
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# ============================================================
# SEO / Crawler Middleware Helpers
# ============================================================
CRAWLER_PATTERN = re.compile(r'(googlebot|bingbot|facebookexternalhit|twitterbot|discordbot|slackbot|whatsapp|telegrambot|yandexbot|baiduspider|applebot|duckduckbot|semrushbot|ahrefsbot|dotbot)', re.IGNORECASE)

def is_crawler(user_agent):
    return bool(user_agent and CRAWLER_PATTERN.search(user_agent))

def load_scraped_mangas():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else '.', 'scraped_mangas.json')
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

def inject_seo_meta(html, title, description, image_url=''):
    title = title or 'KAIRO / منهوا - منصة قراءة المانجا والمنهوا الأولى'
    desc = description or 'منصة KAIRO/منهوا - اقرأ المانجا والمنهوا المفضلة لديك بجودة عالية وبدون إعلانات مزعجة.'
    
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

def _escape_html(s):
    if not s:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')

def get_seo_for_spa_path(path):
    parsed = urllib.parse.urlparse(path)
    clean = parsed.path  # Ignore hash/query for path matching
    
    # Support /manga/{id} and /reader/{mangaId}/{chapterId} clean URLs
    manga_match = re.match(r'^/manga/([^/]+)', clean)
    reader_match = re.match(r'^/reader/([^/]+)/([^/]+)', clean)
    
    if reader_match:
        manga_id = reader_match.group(1)
        chapter_id = reader_match.group(2)
        manga = find_manga_for_seo(manga_id)
        if manga:
            chapters = manga.get('chapters', [])
            chapter_title = 'فصل ' + chapter_id
            for ch in chapters:
                if str(ch.get('id')) == str(chapter_id):
                    chapter_title = ch.get('title', chapter_title)
                    break
            title = manga.get('title', '') + ' - ' + chapter_title + ' | KAIRO / منهوا'
            desc = 'اقرأ ' + manga.get('title', '') + ' ' + chapter_title + ' على KAIRO/منهوا'
            cover = manga.get('cover', '')
            return title, desc, cover
    elif manga_match:
        manga_id = manga_match.group(1)
        manga = find_manga_for_seo(manga_id)
        if manga:
            title = manga.get('title', '') + ' | KAIRO / منهوا'
            desc = (manga.get('synopsis', '') or '')[:200]
            cover = manga.get('cover', '')
            return title, desc, cover
    
    return None, None, None

def serve_index_html(handler, path):
    index_path = os.path.join(os.getcwd(), 'index.html')
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
    except (IOError, OSError) as e:
        print(f"Error reading index.html: {e}")
        handler.send_error(500, "Internal server error")
        return
    
    user_agent = handler.headers.get('User-Agent', '')
    if is_crawler(user_agent):
        seo_title, seo_desc, seo_img = get_seo_for_spa_path(path)
        if seo_title:
            html = inject_seo_meta(html, seo_title, seo_desc, seo_img)
    
    body = html.encode('utf-8')
    handler.send_response(200)
    handler.send_header('Content-Type', 'text/html; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

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

def init_db():
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
                        email TEXT PRIMARY KEY,
                        password_hash TEXT,
                        role TEXT DEFAULT 'user',
                        points INTEGER DEFAULT 20,
                        level INTEGER DEFAULT 1
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS user_settings (
                        email TEXT PRIMARY KEY,
                        settings_json TEXT
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS sessions (
                        token TEXT PRIMARY KEY,
                        email TEXT,
                        expires_at REAL
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
                        created_at REAL
                     )''')
        c.execute('''CREATE TABLE IF NOT EXISTS reading_progress (
                        email TEXT,
                        manga_id TEXT,
                        chapter_id TEXT,
                        page INTEGER,
                        updated_at REAL,
                        PRIMARY KEY (email, manga_id)
                     )''')
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
        c.execute("INSERT OR IGNORE INTO system_settings VALUES ('smtp_sender', 'KAIRO/منهوا <noreply@kairo-manhua.com>')")
        
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
        c.execute("PRAGMA journal_mode=WAL")
        conn.commit()
    finally:
        conn.close()

init_db()

def hash_password(password):
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return salt + ':' + dk.hex()

def verify_password(password, stored_hash):
    if not stored_hash:
        return False
    if ':' in stored_hash:
        salt, dk_hex = stored_hash.split(':', 1)
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return dk.hex() == dk_hex
    else:
        return stored_hash == hashlib.sha256((password + 'kairo_salt_123!').encode('utf-8')).hexdigest()

ALLOWED_RESET_HOSTS = {'kairo-manhua.com', 'localhost:8000', 'localhost'}

def validate_reset_host(host):
    return host in ALLOWED_RESET_HOSTS

# --- Gamification Helpers ---
def points_needed_for_level(level):
    return 50 * level * (level + 1)

def calculate_level(points):
    if points <= 0:
        return max(1, points)
    n = math.floor((-1 + math.sqrt(1 + 4 * points / 50)) / 2)
    return max(1, n)

def get_rank_name(level):
    if level <= 30:
        return 'مبتدئ'
    elif level <= 60:
        return 'قارئ ممتاز'
    else:
        return 'قارئ أسطوري'

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

def verify_google_token(credential=None, access_token=None):
    try:
        import json
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
        import json
        url = f"https://graph.facebook.com/me?fields=email,name&access_token={urllib.parse.quote(access_token)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data
    except Exception as e:
        print("Facebook token verification error:", e)
        return None

def send_reset_email(email, token, host):
    import smtplib
    from email.mime.text import MIMEText
    
    if not validate_reset_host(host):
        host = 'kairo-manhua.com'
    
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_host',))
        smtp_host = c.fetchone()[0]
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_port',))
        smtp_port = int(c.fetchone()[0] or 587)
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_user',))
        smtp_user = c.fetchone()[0]
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_pass',))
        smtp_pass = c.fetchone()[0]
        c.execute('SELECT value FROM system_settings WHERE key = ?', ('smtp_sender',))
        smtp_sender = c.fetchone()[0]
    finally:
        conn.close()
    
    reset_link = f"http://{host}/#/reset-password?token={token}"
    
    # Check if SMTP details are configured
    if not smtp_user or not smtp_pass:
        raise ValueError("إعدادات خادم SMTP غير مكتملة. يرجى تهيئة SMTP في لوحة التحكم.")

    msg_body = f"""أهلاً بك،

لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في منصة KAIRO/منهوا.

يمكنك إعادة تعيين كلمة المرور بالضغط على الرابط التالي:
{reset_link}

إذا لم تطلب هذا التغيير، يرجى تجاهل هذا البريد الإلكتروني. الرابط صالح لمدة ساعة واحدة.

شكراً لك،
إدارة KAIRO/منهوا
"""
    
    mime_msg = MIMEText(msg_body, 'plain', 'utf-8')
    mime_msg['Subject'] = 'استعادة كلمة المرور - KAIRO/منهوا'
    mime_msg['From'] = smtp_sender
    mime_msg['To'] = email

    # Send message using SMTP
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_sender, [email], mime_msg.as_string())


def get_session_user(headers):
    # Check Authorization header first
    auth_header = headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
    
    # Check Cookie header second
    if not token:
        cookie_header = headers.get('Cookie', '')
        if cookie_header:
            parts = cookie_header.split(';')
            for p in parts:
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
        
        c.execute('SELECT role, points, level FROM users WHERE email = ?', (email,))
        user_row = c.fetchone()
        role = user_row[0] if user_row else 'user'
        points = user_row[1] if user_row else 20
        level = user_row[2] if user_row else 1
        
        return {'email': email, 'role': role, 'token': token, 'points': points, 'level': level}
    finally:
        conn.close()

class KairoRequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_cors_response(self, status_code, content_type='application/json', body=None):
        self.send_response(status_code)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Content-Type', content_type)
        self.end_headers()
        if body is not None:
            if isinstance(body, str):
                self.wfile.write(body.encode('utf-8'))
            else:
                self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        import json
        
        # 1. Register Endpoint
        if parsed_url.path == '/api/register':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                email = data.get('email', '').strip().lower()
                password = data.get('password', '')
                
                if not email or not password:
                    self.send_cors_response(400, body=json.dumps({"error": "الرجاء إدخال البريد وكلمة المرور"}))
                    return
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email FROM users WHERE email = ?', (email,))
                    if c.fetchone():
                        self.send_cors_response(400, body=json.dumps({"error": "هذا البريد الإلكتروني مسجل بالفعل"}))
                        return
                    
                    # Force admin role for the specified email
                    role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
                    password_hash = hash_password(password)
                    
                    c.execute('INSERT INTO users (email, password_hash, role, provider, points, level) VALUES (?, ?, ?, ?, 20, 1)', (email, password_hash, role, 'email'))
                    conn.commit()
                finally:
                    conn.close()
                
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم التسجيل بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 2. Login Endpoint
        elif parsed_url.path == '/api/login':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                email = data.get('email', '').strip().lower()
                password = data.get('password', '')
                
                if not email or not password:
                    self.send_cors_response(400, body=json.dumps({"error": "الرجاء إدخال البريد وكلمة المرور"}))
                    return
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT password_hash, role FROM users WHERE email = ?', (email,))
                    row = c.fetchone()
                    
                    if not row or not verify_password(password, row[0]):
                        self.send_cors_response(401, body=json.dumps({"error": "البريد الإلكتروني أو كلمة المرور غير صحيحة"}))
                        return
                    
                    stored_hash = row[0]
                    # Re-hash to PBKDF2 if old format
                    if ':' not in stored_hash:
                        new_hash = hash_password(password)
                        c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (new_hash, email))
                    
                    role = row[1]
                    # Keep database role updated if user changed their role config
                    if email == 'sherifahmed200100@gmail.com' and role != 'admin':
                        c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
                        conn.commit()
                        role = 'admin'
                    
                    # Create session
                    token = secrets.token_hex(32)
                    expires_at = time.time() + 86400 * 30  # 30 days
                    c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
                    conn.commit()
                finally:
                    conn.close()
                
                c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
                pu = c.fetchone()
                points = pu[0] if pu else 20
                level = pu[1] if pu else 1
                self.send_cors_response(200, body=json.dumps({
                    "status": "success",
                    "token": token,
                    "email": email,
                    "role": role,
                    "points": points,
                    "level": level
                }))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 3. Logout Endpoint
        elif parsed_url.path == '/api/logout':
            user = get_session_user(self.headers)
            if user:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('DELETE FROM sessions WHERE token = ?', (user['token'],))
                    conn.commit()
                finally:
                    conn.close()
            self.send_cors_response(200, body=json.dumps({"status": "success"}))

        # 4. Sync Settings Endpoint
        elif parsed_url.path == '/api/sync_settings':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                settings = data.get('settings', {})
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('INSERT OR REPLACE INTO user_settings VALUES (?, ?)', (user['email'], json.dumps(settings)))
                    conn.commit()
                finally:
                    conn.close()
                
                self.send_cors_response(200, body=json.dumps({"status": "success"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 5. Reading Progress Endpoint (Awards Points)
        elif parsed_url.path == '/api/user/reading-progress':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                manga_id = data.get('manga_id', '').strip()
                chapter_id = data.get('chapter_id', '').strip()
                page = data.get('page', 1)
                
                if not manga_id or not chapter_id:
                    self.send_cors_response(400, body=json.dumps({"error": "بيانات القراءة غير مكتملة"}))
                    return
                
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
                
                self.send_cors_response(200, body=json.dumps({
                    "status": "success",
                    "points": result['points'],
                    "level": result['level'],
                    "new_points": result['new_points'],
                    "leveled_up": result['leveled_up'],
                    "rank_name": result.get('rank_name', get_rank_name(result['level']))
                }))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 6. Save Manga Endpoint (Admin Only)
        elif parsed_url.path == '/api/save_manga':
            user = get_session_user(self.headers)
            if not user or user['role'] != 'admin':
                self.send_cors_response(403, body=json.dumps({"error": "غير مصرح، يجب أن تكون المدير للقيام بهذا العمل"}))
                return
                
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                manga_data = json.loads(post_data.decode('utf-8'))
                manga_id = manga_data.get("id")
                
                if not manga_id:
                    self.send_cors_response(400, body=json.dumps({"error": "معرف المنهوا مفقود"}))
                    return
                
                # Load existing database
                OUTPUT_FILE = "scraped_mangas.json"
                scraped_db = []
                if os.path.exists(OUTPUT_FILE):
                    try:
                        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                            scraped_db = json.load(f)
                    except Exception:
                        pass
                
                # Merge: remove old if exists
                scraped_db = [m for m in scraped_db if m["id"] != manga_id]
                scraped_db.append(manga_data)
                
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(scraped_db, f, ensure_ascii=False, indent=2)
                
                import threading
                threading.Thread(target=ping_google_sitemap, daemon=True).start()
                self.send_cors_response(200, body=json.dumps({"status": "success", "title": manga_data.get("title")}))
                print(f"[+] Saved manga received from browser: {manga_data.get('title')}")
            except Exception as e:
                print(f"[-] Error saving manga: {e}")
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 6. Delete Manga Endpoint (Admin Only)
        elif parsed_url.path == '/api/delete_manga':
            user = get_session_user(self.headers)
            if not user or user['role'] != 'admin':
                self.send_cors_response(403, body=json.dumps({"error": "غير مصرح، يجب أن تكون المدير للقيام بهذا العمل"}))
                return
                
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                manga_id = data.get("id")
                
                if not manga_id:
                    self.send_cors_response(400, body=json.dumps({"error": "معرف المنهوا مفقود"}))
                    return
                
                # Load existing database
                OUTPUT_FILE = "scraped_mangas.json"
                scraped_db = []
                if os.path.exists(OUTPUT_FILE):
                    try:
                        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                            scraped_db = json.load(f)
                    except Exception:
                        pass
                
                # Delete
                scraped_db = [m for m in scraped_db if m["id"] != manga_id]
                
                with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                    json.dump(scraped_db, f, ensure_ascii=False, indent=2)
                
                import threading
                threading.Thread(target=ping_google_sitemap, daemon=True).start()
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم حذف المنهوا بنجاح"}))
                print(f"[+] Deleted manga: {manga_id}")
            except Exception as e:
                print(f"[-] Error deleting manga: {e}")
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 7. Suggestions Endpoint (POST)
        elif parsed_url.path == '/api/suggestions':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                sug_type = data.get('type', 'suggestion').strip()
                content = data.get('content', '').strip()
                if not content:
                    self.send_cors_response(400, body=json.dumps({"error": "الرجاء كتابة نص الرسالة"}))
                    return
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('INSERT INTO suggestions (email, type, content, created_at) VALUES (?, ?, ?, ?)',
                              (user['email'], sug_type, content, time.time()))
                    conn.commit()
                finally:
                    conn.close()
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم إرسال رسالتك بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 8. Manga Reviews Endpoint (POST)
        elif parsed_url.path == '/api/manga_reviews':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                manga_id = data.get('manga_id', '').strip()
                rating = int(data.get('rating', 5))
                review_text = data.get('review_text', '').strip()
                if not manga_id or rating < 1 or rating > 5:
                    self.send_cors_response(400, body=json.dumps({"error": "بيانات التقييم غير صالحة"}))
                    return
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('INSERT OR REPLACE INTO manga_reviews (manga_id, email, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?)',
                              (manga_id, user['email'], rating, review_text, time.time()))
                    conn.commit()
                finally:
                    conn.close()
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم حفظ تقييمك ومراجعتك بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 9. Chapter Comments Endpoint (POST)
        elif parsed_url.path == '/api/chapter_comments':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                manga_id = data.get('manga_id', '').strip()
                chapter_id = data.get('chapter_id', '').strip()
                comment_text = data.get('comment_text', '').strip()
                if not manga_id or not chapter_id or not comment_text:
                    self.send_cors_response(400, body=json.dumps({"error": "بيانات التعليق غير مكتملة"}))
                    return
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('INSERT INTO chapter_comments (manga_id, chapter_id, email, comment_text, created_at) VALUES (?, ?, ?, ?, ?)',
                              (manga_id, chapter_id, user['email'], comment_text, time.time()))
                    conn.commit()
                finally:
                    conn.close()
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم نشر التعليق بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 10. Admin Config Endpoint (POST)
        elif parsed_url.path == '/api/admin/config':
            user = get_session_user(self.headers)
            if not user or user['role'] != 'admin':
                self.send_cors_response(403, body=json.dumps({"error": "غير مصرح، للمسؤولين فقط"}))
                return
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    for key, val in data.items():
                        c.execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', (key, str(val)))
                    conn.commit()
                finally:
                    conn.close()
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم تحديث إعدادات النظام بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 11. Forgot Password Endpoint (POST)
        elif parsed_url.path == '/api/auth/forgot-password':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                email = data.get('email', '').strip().lower()
                if not email:
                    self.send_cors_response(400, body=json.dumps({"error": "الرجاء إدخال البريد الإلكتروني"}))
                    return
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email FROM users WHERE email = ?', (email,))
                    if not c.fetchone():
                        self.send_cors_response(400, body=json.dumps({"error": "هذا البريد الإلكتروني غير مسجل لدينا"}))
                        return
                    
                    # Generate token and store it
                    token = secrets.token_hex(32)
                    expires_at = time.time() + 3600  # 1 hour
                    c.execute('INSERT OR REPLACE INTO password_resets VALUES (?, ?, ?)', (email, token, expires_at))
                    conn.commit()
                finally:
                    conn.close()
                
                host = self.headers.get('Host', 'localhost:8000')
                if not validate_reset_host(host):
                    host = 'kairo-manhua.com'
                
                try:
                    send_reset_email(email, token, host)
                    self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح."}))
                except Exception as ex:
                    print(f"SMTP sending failed: {ex}")
                    # Write link to console as backup/dev environment helper
                    reset_link = f"http://{host}/#/reset-password?token={token}"
                    print(f"[BACKUP reset link] For {email}: {reset_link}")
                    
                    err_str = str(ex)
                    if "إعدادات خادم SMTP" in err_str:
                        self.send_cors_response(400, body=json.dumps({"error": err_str}))
                    else:
                        self.send_cors_response(200, body=json.dumps({
                            "status": "success", 
                            "message": f"تم تسجيل رابط الاستعادة بنجاح في سجل خادم الويب (SMTP خامل أو معطل). رابط الاستعادة للمطور: {reset_link}"
                        }))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 12. Reset Password Endpoint (POST)
        elif parsed_url.path == '/api/auth/reset-password':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                token = data.get('token', '').strip()
                new_password = data.get('password', '')
                
                if not token or not new_password:
                    self.send_cors_response(400, body=json.dumps({"error": "البيانات المطلوبة مفقودة"}))
                    return
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, expires_at FROM password_resets WHERE token = ?', (token,))
                    row = c.fetchone()
                    
                    if not row:
                        self.send_cors_response(400, body=json.dumps({"error": "رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية"}))
                        return
                    
                    email, expires_at = row
                    if expires_at < time.time():
                        c.execute('DELETE FROM password_resets WHERE token = ?', (token,))
                        conn.commit()
                        self.send_cors_response(400, body=json.dumps({"error": "رابط الاستعادة انتهت صلاحيته"}))
                        return
                    
                    password_hash = hash_password(new_password)
                    c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (password_hash, email))
                    c.execute('DELETE FROM password_resets WHERE token = ?', (token,))
                    conn.commit()
                finally:
                    conn.close()
                
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم تحديث كلمة المرور بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 13. Google Auth Endpoint (POST)
        elif parsed_url.path == '/api/auth/google':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                credential = data.get('credential')
                access_token = data.get('access_token')
                
                if not credential and not access_token:
                    self.send_cors_response(400, body=json.dumps({"error": "بيانات التوثيق مفقودة"}))
                    return
                
                user_info = verify_google_token(credential=credential, access_token=access_token)
                if not user_info:
                    self.send_cors_response(401, body=json.dumps({"error": "فشل التحقق من حساب Google"}))
                    return
                
                email = user_info.get('email', '').strip().lower()
                if not email:
                    self.send_cors_response(400, body=json.dumps({"error": "فشل استخراج البريد الإلكتروني من حساب Google"}))
                    return
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, role FROM users WHERE email = ?', (email,))
                    row = c.fetchone()
                    
                    if not row:
                        # تسجيل تلقائي
                        random_pass = secrets.token_hex(16)
                        password_hash = hash_password(random_pass)
                        role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
                        c.execute('INSERT INTO users (email, password_hash, role, provider, points, level) VALUES (?, ?, ?, ?, 20, 1)', (email, password_hash, role, 'google'))
                        conn.commit()
                        user_role = role
                    else:
                        user_role = row[1]
                        if email == 'sherifahmed200100@gmail.com' and user_role != 'admin':
                            c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
                            conn.commit()
                            user_role = 'admin'
                    
                    token = secrets.token_hex(32)
                    expires_at = time.time() + 86400 * 30
                    c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
                    conn.commit()
                finally:
                    conn.close()
                
                c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
                pu = c.fetchone()
                points = pu[0] if pu else 20
                level = pu[1] if pu else 1
                self.send_cors_response(200, body=json.dumps({"status": "success", "token": token, "email": email, "role": user_role, "points": points, "level": level}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 14. Facebook Auth Endpoint (POST)
        elif parsed_url.path == '/api/auth/facebook':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                access_token = data.get('access_token')
                if not access_token:
                    self.send_cors_response(400, body=json.dumps({"error": "توكن الفيسبوك مفقود"}))
                    return
                
                user_info = verify_facebook_token(access_token)
                if not user_info:
                    self.send_cors_response(401, body=json.dumps({"error": "فشل التحقق من حساب Facebook"}))
                    return
                
                email = user_info.get('email', '').strip().lower()
                if not email:
                    fb_id = user_info.get('id')
                    if fb_id:
                        email = f"fb_{fb_id}@kairo-facebook.com"
                    else:
                        self.send_cors_response(400, body=json.dumps({"error": "فشل استخراج بيانات الحساب من Facebook"}))
                        return
                
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, role FROM users WHERE email = ?', (email,))
                    row = c.fetchone()
                    
                    if not row:
                        # تسجيل تلقائي
                        random_pass = secrets.token_hex(16)
                        password_hash = hash_password(random_pass)
                        role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
                        c.execute('INSERT INTO users (email, password_hash, role, provider, points, level) VALUES (?, ?, ?, ?, 20, 1)', (email, password_hash, role, 'facebook'))
                        conn.commit()
                        user_role = role
                    else:
                        user_role = row[1]
                        if email == 'sherifahmed200100@gmail.com' and user_role != 'admin':
                            c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
                            conn.commit()
                            user_role = 'admin'
                    
                    token = secrets.token_hex(32)
                    expires_at = time.time() + 86400 * 30
                    c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
                    conn.commit()
                finally:
                    conn.close()
                
                c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
                pu = c.fetchone()
                points = pu[0] if pu else 20
                level = pu[1] if pu else 1
                self.send_cors_response(200, body=json.dumps({"status": "success", "token": token, "email": email, "role": user_role, "points": points, "level": level}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))
        else:
            self.send_cors_response(404, body=json.dumps({"error": "غير موجود"}))

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # Sitemap.xml endpoint
        if parsed_url.path == '/sitemap.xml':
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml; charset=utf-8')
            self.end_headers()
            self.wfile.write(generate_sitemap_xml().encode('utf-8'))
            return
        
        # Public config endpoint
        if parsed_url.path == '/api/config':
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute("SELECT key, value FROM system_settings WHERE key IN ('google_client_id', 'facebook_app_id')")
                    rows = c.fetchall()
                finally:
                    conn.close()
                config = {row[0]: row[1] for row in rows}
                self.send_cors_response(200, body=json.dumps(config))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))
            return

        # Admin config endpoint (GET)
        elif parsed_url.path == '/api/admin/config':
            user = get_session_user(self.headers)
            if not user or user['role'] != 'admin':
                self.send_cors_response(403, body=json.dumps({"error": "غير مصرح، للمسؤولين فقط"}))
                return
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT key, value FROM system_settings')
                    rows = c.fetchall()
                finally:
                    conn.close()
                config = {row[0]: row[1] for row in rows}
                self.send_cors_response(200, body=json.dumps(config))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))
            return

        # Admin Stats endpoint (GET)
        elif parsed_url.path == '/api/admin/stats':
            user = get_session_user(self.headers)
            if not user or user['role'] != 'admin':
                self.send_cors_response(403, body=json.dumps({"error": "غير مصرح، للمدير فقط"}))
                return
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute("SELECT value FROM site_stats WHERE key = 'visits'")
                    visits_row = c.fetchone()
                    visits = visits_row[0] if visits_row else 0
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
                    c.execute("SELECT COUNT(*) FROM users")
                    stats["total_users"] = c.fetchone()[0]
                finally:
                    conn.close()
                self.send_cors_response(200, body=json.dumps(stats))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))
            return

        # User Profile endpoint (GET)
        if parsed_url.path == '/api/user/profile':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            
            conn = sqlite3.connect(DB_FILE, timeout=30)
            try:
                c = conn.cursor()
                c.execute('SELECT points, level FROM users WHERE email = ?', (user['email'],))
                row = c.fetchone()
                points = row[0] if row else 20
                level = row[1] if row else 1
            finally:
                conn.close()
            
            rank_name = get_rank_name(level)
            points_current = points_needed_for_level(level - 1) if level > 1 else 0
            points_next = points_needed_for_level(level)
            progress = ((points - points_current) / (points_next - points_current)) * 100 if points_next > points_current else 100
            
            self.send_cors_response(200, body=json.dumps({
                "points": points,
                "level": level,
                "rank_name": rank_name,
                "progress": round(progress, 1),
                "points_to_next": points_next - points
            }))
            return

        # 1. Get Settings Endpoint
        if parsed_url.path == '/api/get_settings':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT settings_json FROM user_settings WHERE email = ?', (user['email'],))
                    row = c.fetchone()
                finally:
                    conn.close()
                
                settings_json = row[0] if row else "{}"
                self.send_cors_response(200, body=settings_json)
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))
                
        elif parsed_url.path == '/api/suggestions':
            user = get_session_user(self.headers)
            if not user or user['role'] != 'admin':
                self.send_cors_response(403, body=json.dumps({"error": "غير مصرح، للمدير فقط"}))
                return
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, type, content, created_at FROM suggestions ORDER BY created_at DESC')
                    rows = c.fetchall()
                finally:
                    conn.close()
                results = []
                for row in rows:
                    results.append({
                        "email": row[0],
                        "type": row[1],
                        "content": row[2],
                        "created_at": row[3]
                    })
                self.send_cors_response(200, body=json.dumps(results))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        elif parsed_url.path == '/api/manga_reviews':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            manga_id = query_params.get('manga_id', [None])[0]
            if not manga_id:
                self.send_cors_response(400, body=json.dumps({"error": "معرف المنهوا مطلوب"}))
                return
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, rating, review_text, created_at FROM manga_reviews WHERE manga_id = ? ORDER BY created_at DESC', (manga_id,))
                    rows = c.fetchall()
                finally:
                    conn.close()
                results = []
                for row in rows:
                    results.append({
                        "email": row[0],
                        "rating": row[1],
                        "review_text": row[2],
                        "created_at": row[3]
                    })
                self.send_cors_response(200, body=json.dumps(results))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        elif parsed_url.path == '/api/chapter_comments':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            manga_id = query_params.get('manga_id', [None])[0]
            chapter_id = query_params.get('chapter_id', [None])[0]
            if not manga_id or not chapter_id:
                self.send_cors_response(400, body=json.dumps({"error": "معرف المنهوا والفصل مطلوبان"}))
                return
            try:
                conn = sqlite3.connect(DB_FILE, timeout=30)
                try:
                    c = conn.cursor()
                    c.execute('SELECT email, comment_text, created_at FROM chapter_comments WHERE manga_id = ? AND chapter_id = ? ORDER BY created_at DESC', (manga_id, chapter_id))
                    rows = c.fetchall()
                finally:
                    conn.close()
                results = []
                for row in rows:
                    results.append({
                        "email": row[0],
                        "comment_text": row[1],
                        "created_at": row[2]
                    })
                self.send_cors_response(200, body=json.dumps(results))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        elif parsed_url.path == '/proxy-image':
            # Handle image proxying
            query_params = urllib.parse.parse_qs(parsed_url.query)
            image_url = query_params.get('url', [None])[0]
            
            if not image_url:
                self.send_error(400, "Missing 'url' parameter")
                return
                
            try:
                self.handle_proxy_image(image_url)
            except Exception as e:
                print(f"Error proxying image {image_url}: {e}")
                self.send_error(500, f"Error processing image: {e}")
        else:
            # SPA: serve index.html for all non-API, non-file routes
            # Try static file first, fall back to SPA index.html
            local_path = self.translate_path(self.path)
            if os.path.isfile(local_path):
                super().do_GET()
            else:
                serve_index_html(self, self.path)

    def handle_proxy_image(self, url):
        # 1. Check Cache
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
        cache_jpeg = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
        cache_webp = os.path.join(CACHE_DIR, f"{url_hash}.webp")
        
        # Check if client accepts WebP
        accept = self.headers.get('Accept', '')
        wants_webp = 'image/webp' in accept
        
        if wants_webp and os.path.exists(cache_webp):
            self.serve_local_file(cache_webp, 'image/webp')
            return
        if os.path.exists(cache_jpeg):
            self.serve_local_file(cache_jpeg, 'image/jpeg')
            return

        # 2. Fetch remote image
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                img_data = response.read()
        except Exception as e:
            print(f"Failed to fetch {url}, redirecting... Error: {e}")
            self.send_response(302)
            self.send_header('Location', url)
            self.end_headers()
            return

        # 3. Clean and process image
        if not PIL_AVAILABLE:
            self.serve_local_file_raw(img_data)
            return
        try:
            img = Image.open(io.BytesIO(img_data))
            img = img.convert('RGB')
            w, h = img.size
            
            draw = ImageDraw.Draw(img)
            
            # إزالة العلامات المائية وإضافة شعار KAIRO
            wm_count = image_processor.process_image_watermark(img)
            if wm_count > 0:
                print(f"[KAIRO] Removed {wm_count} watermark(s) from proxy image")

            margin_width = 45
            draw.rectangle([0, 0, margin_width, h], fill="black")
            draw.rectangle([w - margin_width, 0, w, h], fill="black")
            
            try:
                font = ImageFont.truetype("arial.ttf", 14)
            except Exception:
                try:
                    font = ImageFont.load_default(size=14)
                except TypeError:
                    font = ImageFont.load_default()
            
            def draw_vertical_brand(draw, x_center, height):
                y = 80
                char_spacing = 16
                text_block = [
                    ("KAIRO", (0, 240, 255)),
                    ("★", (255, 0, 127)),
                    ("MANHUA", (138, 43, 226))
                ]
                
                while y < height - 100:
                    for word, color in text_block:
                        for char in word:
                            draw.text((x_center - 5, y), char, fill=color, font=font)
                            y += char_spacing
                        y += 10
                    y += 150

            draw_vertical_brand(draw, margin_width // 2, h)
            draw_vertical_brand(draw, w - margin_width // 2, h)
            
            # Save both JPEG and WebP to cache
            img.save(cache_jpeg, "JPEG", quality=90)
            try:
                img.save(cache_webp, "WEBP", quality=85)
            except Exception as webp_err:
                print(f"WebP save skipped: {webp_err}")
            
            # Serve appropriate format
            if wants_webp and os.path.exists(cache_webp):
                self.serve_local_file(cache_webp, 'image/webp')
            else:
                self.serve_local_file(cache_jpeg, 'image/jpeg')
            
        except Exception as e:
            print(f"Error processing image bytes: {e}")
            # Serve original bytes if processing fails
            self.send_response(200)
            self.send_header('Content-Type', 'image/jpeg')
            self.send_header('Content-Length', str(len(img_data)))
            self.end_headers()
            self.wfile.write(img_data)

    def serve_local_file(self, path, content_type='image/jpeg'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(os.path.getsize(path)))
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.end_headers()
        with open(path, 'rb') as f:
            self.wfile.write(f.read())

    def serve_local_file_raw(self, data, content_type='image/jpeg'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.end_headers()
        self.wfile.write(data)

if __name__ == '__main__':
    # Use ThreadingHTTPServer if available for handling concurrent requests
    # fallback to HTTPServer
    try:
        from http.server import ThreadingHTTPServer
        server_class = ThreadingHTTPServer
    except ImportError:
        server_class = http.server.HTTPServer

    print(f"Starting Kairo server on port {PORT}...")
    with server_class(("", PORT), KairoRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        print("Server stopped.")
