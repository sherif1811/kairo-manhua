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

# Reconfigure stdout/stderr to utf-8 for Windows console support
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Set working directory to project folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

from flask import Flask, request, jsonify, send_from_directory, send_file, redirect

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import image_processor

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

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
                        level INTEGER DEFAULT 1
                     )''')
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
                        created_at REAL
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

# ============================================================
# Helpers
# ============================================================
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

def points_needed_for_level(level):
    return 50 * level * (level + 1)

def calculate_level(points):
    if points <= 0:
        return 1
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
        c.execute('SELECT role, points, level FROM users WHERE email = ?', (email,))
        role_row = c.fetchone()
        role = role_row[0] if role_row else 'user'
        points = role_row[1] if role_row else 20
        level = role_row[2] if role_row else 1
    finally:
        conn.close()
    return {'email': email, 'role': role, 'token': token, 'points': points, 'level': level}

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

@app.route('/<path:filename>')
def static_files(filename):
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, filename)
    # SPA fallback: serve index.html for non-file paths (clean URLs like /manga/1)
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
        return jsonify({"error": "الرجاء إدخال البريد وكلمة المرور"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE email = ?', (email,))
        if c.fetchone():
            return jsonify({"error": "هذا البريد الإلكتروني مسجل بالفعل"}), 400
        role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
        password_hash = hash_password(password)
        c.execute('INSERT INTO users (email, password_hash, role, provider, points, level) VALUES (?, ?, ?, ?, 20, 1)', (email, password_hash, role, 'email'))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "تم التسجيل بنجاح"}), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({"error": "الرجاء إدخال البريد وكلمة المرور"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT password_hash, role FROM users WHERE email = ?', (email,))
        row = c.fetchone()
        if not row or not verify_password(password, row[0]):
            return jsonify({"error": "البريد الإلكتروني أو كلمة المرور غير صحيحة"}), 401
        
        stored_hash = row[0]
        if ':' not in stored_hash:
            new_hash = hash_password(password)
            c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (new_hash, email))
        
        role = row[1]
        if email == 'sherifahmed200100@gmail.com' and role != 'admin':
            c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
            conn.commit()
            role = 'admin'
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
    return jsonify({"status": "success", "token": token, "email": email, "role": role, "points": points, "level": level}), 200

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
        return jsonify({"error": "بيانات التوثيق مفقودة"}), 400
        
    user_info = verify_google_token(credential=credential, access_token=access_token)
    if not user_info:
        return jsonify({"error": "فشل التحقق من حساب Google"}), 401
        
    email = user_info.get('email', '').strip().lower()
    if not email:
        return jsonify({"error": "فشل استخراج البريد الإلكتروني من حساب Google"}), 400
        
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
        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        pu = c.fetchone()
        points = pu[0] if pu else 20
        level = pu[1] if pu else 1
    finally:
        conn.close()
    
    return jsonify({"status": "success", "token": token, "email": email, "role": user_role, "points": points, "level": level}), 200

@app.route('/api/auth/facebook', methods=['POST'])
def auth_facebook():
    data = request.get_json() or {}
    access_token = data.get('access_token')
    
    if not access_token:
        return jsonify({"error": "توكن الفيسبوك مفقود"}), 400
        
    user_info = verify_facebook_token(access_token)
    if not user_info:
        return jsonify({"error": "فشل التحقق من حساب Facebook"}), 401
        
    email = user_info.get('email', '').strip().lower()
    # إذا لم يكن الحساب يحتوي على بريد إلكتروني مفعل (نادر الحدوث)، نستخدم معرف الفيسبوك لتوليد بريد وهمي فريد
    if not email:
        fb_id = user_info.get('id')
        if fb_id:
            email = f"fb_{fb_id}@kairo-facebook.com"
        else:
            return jsonify({"error": "فشل استخراج بيانات الحساب من Facebook"}), 400
            
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
        c.execute('SELECT points, level FROM users WHERE email = ?', (email,))
        pu = c.fetchone()
        points = pu[0] if pu else 20
        level = pu[1] if pu else 1
    finally:
        conn.close()
    
    return jsonify({"status": "success", "token": token, "email": email, "role": user_role, "points": points, "level": level}), 200

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "غير مصرح، للمدير فقط"}), 403
    
    from_ts = request.args.get('from')
    to_ts = request.args.get('to')
        
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
        return jsonify({"error": "غير مصرح، للمدير فقط"}), 403
    
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
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
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
    return jsonify({
        "points": points,
        "level": level,
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
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
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
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
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
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
    data = request.get_json() or {}
    manga_id = (data.get('manga_id') or '').strip()
    chapter_id = (data.get('chapter_id') or '').strip()
    page = data.get('page', 1)
    
    if not manga_id or not chapter_id:
        return jsonify({"error": "بيانات القراءة غير مكتملة"}), 400
    
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
            c.execute("SELECT key, value FROM system_settings WHERE key IN ('google_client_id', 'facebook_app_id')")
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
        return jsonify({"error": "غير مصرح، للمسؤولين فقط"}), 403
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
        return jsonify({"error": "غير مصرح، للمسؤولين فقط"}), 403
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
        return jsonify({"status": "success", "message": "تم تحديث إعدادات النظام بنجاح"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({"error": "الرجاء إدخال البريد الإلكتروني"}), 400
    
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email FROM users WHERE email = ?', (email,))
        if not c.fetchone():
            return jsonify({"error": "هذا البريد الإلكتروني غير مسجل لدينا"}), 400
            
        token = secrets.token_hex(32)
        expires_at = time.time() + 3600 # 1 hour
        c.execute('INSERT OR REPLACE INTO password_resets VALUES (?, ?, ?)', (email, token, expires_at))
        conn.commit()
    finally:
        conn.close()
    
    host = request.headers.get('Host', 'localhost:8000')
    if not validate_reset_host(host):
        host = 'kairo-manhua.com'
    
    try:
        send_reset_email(email, token, host)
        return jsonify({"status": "success", "message": "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح."}), 200
    except Exception as ex:
        print(f"SMTP sending failed: {ex}")
        reset_link = f"http://{host}/#/reset-password?token={token}"
        print(f"[BACKUP reset link] For {email}: {reset_link}")
        
        err_str = str(ex)
        if "إعدادات خادم SMTP" in err_str:
            return jsonify({"error": err_str}), 400
        else:
            return jsonify({
                "status": "success",
                "message": f"تم تسجيل رابط الاستعادة بنجاح في سجل خادم الويب (SMTP خامل أو معطل). رابط الاستعادة للمطور: {reset_link}"
            }), 200

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token', '').strip()
    new_password = data.get('password', '')
    
    if not token or not new_password:
        return jsonify({"error": "البيانات المطلوبة مفقودة"}), 400
        
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, expires_at FROM password_resets WHERE token = ?', (token,))
        row = c.fetchone()
        
        if not row:
            return jsonify({"error": "رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية"}), 400
            
        email, expires_at = row
        if expires_at < time.time():
            c.execute('DELETE FROM password_resets WHERE token = ?', (token,))
            conn.commit()
            return jsonify({"error": "رابط الاستعادة انتهت صلاحيته"}), 400
            
        password_hash = hash_password(new_password)
        c.execute('UPDATE users SET password_hash = ? WHERE email = ?', (password_hash, email))
        c.execute('DELETE FROM password_resets WHERE token = ?', (token,))
        conn.commit()
    finally:
        conn.close()
    
    return jsonify({"status": "success", "message": "تم تحديث كلمة المرور بنجاح"}), 200

# ============================================================
# MANGA DATA
# ============================================================
@app.route('/api/save_manga', methods=['POST'])
def save_manga():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "غير مصرح، يجب أن تكون المدير للقيام بهذا العمل"}), 403
    manga_data = request.get_json() or {}
    manga_id = manga_data.get("id")
    if not manga_id:
        return jsonify({"error": "معرف المنهوا مفقود"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    scraped_db = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            pass
    scraped_db = [m for m in scraped_db if m["id"] != manga_id]
    scraped_db.append(manga_data)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)
    import threading
    threading.Thread(target=ping_google_sitemap, daemon=True).start()
    return jsonify({"status": "success", "title": manga_data.get("title")}), 200

@app.route('/api/delete_manga', methods=['POST'])
def delete_manga():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "غير مصرح، يجب أن تكون المدير للقيام بهذا العمل"}), 403
    data = request.get_json() or {}
    manga_id = data.get("id")
    if not manga_id:
        return jsonify({"error": "معرف المنهوا مفقود"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    scraped_db = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                scraped_db = json.load(f)
        except Exception:
            pass
    scraped_db = [m for m in scraped_db if m["id"] != manga_id]
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(scraped_db, f, ensure_ascii=False, indent=2)
    import threading
    threading.Thread(target=ping_google_sitemap, daemon=True).start()
    return jsonify({"status": "success", "message": "تم حذف المنهوا بنجاح"}), 200

# ============================================================
# SUGGESTIONS
# ============================================================
@app.route('/api/suggestions', methods=['GET'])
def get_suggestions():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "غير مصرح، للمدير فقط"}), 403
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, type, content, created_at FROM suggestions ORDER BY created_at DESC')
        rows = c.fetchall()
    finally:
        conn.close()
    results = [{"email": r[0], "type": r[1], "content": r[2], "created_at": r[3]} for r in rows]
    return jsonify(results), 200

@app.route('/api/suggestions', methods=['POST'])
def post_suggestion():
    user = get_session_user()
    if not user:
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
    data = request.get_json() or {}
    sug_type = data.get('type', 'suggestion').strip()
    content = data.get('content', '').strip()
    if not content:
        return jsonify({"error": "الرجاء كتابة نص الرسالة"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT INTO suggestions (email, type, content, created_at) VALUES (?, ?, ?, ?)',
                  (user['email'], sug_type, content, time.time()))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "تم إرسال رسالتك بنجاح"}), 200

# ============================================================
# REVIEWS
# ============================================================
@app.route('/api/manga_reviews', methods=['GET'])
def get_manga_reviews():
    manga_id = request.args.get('manga_id')
    if not manga_id:
        return jsonify({"error": "معرف المنهوا مطلوب"}), 400
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
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
    data = request.get_json() or {}
    manga_id = data.get('manga_id', '').strip()
    rating = int(data.get('rating', 5))
    review_text = data.get('review_text', '').strip()
    if not manga_id or rating < 1 or rating > 5:
        return jsonify({"error": "بيانات التقييم غير صالحة"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO manga_reviews (manga_id, email, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?)',
                  (manga_id, user['email'], rating, review_text, time.time()))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "تم حفظ تقييمك ومراجعتك بنجاح"}), 200

# ============================================================
# COMMENTS
# ============================================================
@app.route('/api/chapter_comments', methods=['GET'])
def get_chapter_comments():
    manga_id = request.args.get('manga_id')
    chapter_id = request.args.get('chapter_id')
    if not manga_id or not chapter_id:
        return jsonify({"error": "معرف المنهوا والفصل مطلوبان"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, comment_text, created_at FROM chapter_comments WHERE manga_id = ? AND chapter_id = ? ORDER BY created_at DESC', (manga_id, chapter_id))
        rows = c.fetchall()
    finally:
        conn.close()
    results = [{"email": r[0], "comment_text": r[1], "created_at": r[2]} for r in rows]
    return jsonify(results), 200

@app.route('/api/chapter_comments', methods=['POST'])
def post_chapter_comment():
    user = get_session_user()
    if not user:
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
    data = request.get_json() or {}
    manga_id = data.get('manga_id', '').strip()
    chapter_id = data.get('chapter_id', '').strip()
    comment_text = data.get('comment_text', '').strip()
    if not manga_id or not chapter_id or not comment_text:
        return jsonify({"error": "بيانات التعليق غير مكتملة"}), 400
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('INSERT INTO chapter_comments (manga_id, chapter_id, email, comment_text, created_at) VALUES (?, ?, ?, ?, ?)',
                  (manga_id, chapter_id, user['email'], comment_text, time.time()))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"status": "success", "message": "تم نشر التعليق بنجاح"}), 200

# ============================================================
# IMAGE PROXY
# ============================================================
@app.route('/proxy-image')
def proxy_image():
    image_url = request.args.get('url')
    if not image_url:
        return jsonify({"error": "Missing url parameter"}), 400

    url_hash = hashlib.md5(image_url.encode('utf-8')).hexdigest()
    cache_jpeg = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
    cache_webp = os.path.join(CACHE_DIR, f"{url_hash}.webp")

    # Check if client accepts WebP
    accept = request.headers.get('Accept', '')
    wants_webp = 'image/webp' in accept

    if wants_webp and os.path.exists(cache_webp):
        return send_file(cache_webp, mimetype='image/webp', max_age=86400)
    if os.path.exists(cache_jpeg):
        return send_file(cache_jpeg, mimetype='image/jpeg', max_age=86400)

    req = urllib.request.Request(
        image_url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            img_data = response.read()
    except Exception as e:
        return redirect(image_url)

    if PIL_AVAILABLE:
        try:
            img = Image.open(io.BytesIO(img_data))
            img = img.convert('RGB')
            w, h = img.size
            wm_count = image_processor.process_image_watermark(img)
            if wm_count > 0:
                print(f"[KAIRO] Removed {wm_count} watermark(s) from proxy image")
            draw = ImageDraw.Draw(img)
            margin_width = 45
            draw.rectangle([0, 0, margin_width, h], fill="black")
            draw.rectangle([w - margin_width, 0, w, h], fill="black")
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

            # Save both formats
            img.save(cache_jpeg, "JPEG", quality=90)
            try:
                img.save(cache_webp, "WEBP", quality=85)
            except Exception as webp_err:
                print(f"WebP save skipped: {webp_err}")

            if wants_webp and os.path.exists(cache_webp):
                return send_file(cache_webp, mimetype='image/webp', max_age=86400)
            return send_file(cache_jpeg, mimetype='image/jpeg', max_age=86400)
        except Exception as e:
            pass

    return send_file(io.BytesIO(img_data), mimetype='image/jpeg')


if __name__ == '__main__':
    app.run(debug=True, port=8000)
