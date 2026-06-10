import os
import io
import json
import hashlib
import urllib.parse
import urllib.request
import sqlite3
import secrets
import time

# Set working directory to project folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

from flask import Flask, request, jsonify, send_from_directory, send_file, redirect

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

PORT = 8000
CACHE_DIR = os.path.join(BASE_DIR, "image_cache")
DB_FILE = os.path.join(BASE_DIR, "kairo.db")

# Create cache directory if it doesn't exist
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# ============================================================
# Database Init
# ============================================================
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    email TEXT PRIMARY KEY,
                    password_hash TEXT,
                    role TEXT DEFAULT 'user'
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
    conn.commit()
    conn.close()

init_db()

# ============================================================
# Helpers
# ============================================================
def hash_password(password):
    salt = "kairo_salt_123!"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email, expires_at FROM sessions WHERE token = ?', (token,))
    row = c.fetchone()
    if not row:
        conn.close()
        return None
    email, expires_at = row
    if expires_at < time.time():
        c.execute('DELETE FROM sessions WHERE token = ?', (token,))
        conn.commit()
        conn.close()
        return None
    c.execute('SELECT role FROM users WHERE email = ?', (email,))
    role_row = c.fetchone()
    role = role_row[0] if role_row else 'user'
    conn.close()
    return {'email': email, 'role': role, 'token': token}

def cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

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
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)

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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email FROM users WHERE email = ?', (email,))
    if c.fetchone():
        conn.close()
        return jsonify({"error": "هذا البريد الإلكتروني مسجل بالفعل"}), 400
    role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
    password_hash = hash_password(password)
    c.execute('INSERT INTO users VALUES (?, ?, ?)', (email, password_hash, role))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "تم التسجيل بنجاح"}), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return jsonify({"error": "الرجاء إدخال البريد وكلمة المرور"}), 400
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT password_hash, role FROM users WHERE email = ?', (email,))
    row = c.fetchone()
    if not row or row[0] != hash_password(password):
        conn.close()
        return jsonify({"error": "البريد الإلكتروني أو كلمة المرور غير صحيحة"}), 401
    role = row[1]
    if email == 'sherifahmed200100@gmail.com' and role != 'admin':
        c.execute('UPDATE users SET role = ? WHERE email = ?', ('admin', email))
        conn.commit()
        role = 'admin'
    token = secrets.token_hex(32)
    expires_at = time.time() + 86400 * 30
    c.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token, email, expires_at))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "token": token, "email": email, "role": role}), 200

@app.route('/api/logout', methods=['POST'])
def logout():
    user = get_session_user()
    if user:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('DELETE FROM sessions WHERE token = ?', (user['token'],))
        conn.commit()
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
        
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email, role FROM users WHERE email = ?', (email,))
    row = c.fetchone()
    
    if not row:
        # تسجيل تلقائي
        random_pass = secrets.token_hex(16)
        password_hash = hash_password(random_pass)
        role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
        c.execute('INSERT INTO users VALUES (?, ?, ?)', (email, password_hash, role))
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
    conn.close()
    
    return jsonify({"status": "success", "token": token, "email": email, "role": user_role}), 200

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
            
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email, role FROM users WHERE email = ?', (email,))
    row = c.fetchone()
    
    if not row:
        # تسجيل تلقائي
        random_pass = secrets.token_hex(16)
        password_hash = hash_password(random_pass)
        role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
        c.execute('INSERT INTO users VALUES (?, ?, ?)', (email, password_hash, role))
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
    conn.close()
    
    return jsonify({"status": "success", "token": token, "email": email, "role": user_role}), 200

# ============================================================
# SETTINGS
# ============================================================
@app.route('/api/get_settings', methods=['GET'])
def get_settings():
    user = get_session_user()
    if not user:
        return jsonify({"error": "غير مصرح، الرجاء تسجيل الدخول"}), 401
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT settings_json FROM user_settings WHERE email = ?', (user['email'],))
    row = c.fetchone()
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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO user_settings VALUES (?, ?)', (user['email'], json.dumps(settings)))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"}), 200

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
    return jsonify({"status": "success", "message": "تم حذف المنهوا بنجاح"}), 200

# ============================================================
# SUGGESTIONS
# ============================================================
@app.route('/api/suggestions', methods=['GET'])
def get_suggestions():
    user = get_session_user()
    if not user or user['role'] != 'admin':
        return jsonify({"error": "غير مصرح، للمدير فقط"}), 403
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email, type, content, created_at FROM suggestions ORDER BY created_at DESC')
    rows = c.fetchall()
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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('INSERT INTO suggestions (email, type, content, created_at) VALUES (?, ?, ?, ?)',
              (user['email'], sug_type, content, time.time()))
    conn.commit()
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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email, rating, review_text, created_at FROM manga_reviews WHERE manga_id = ? ORDER BY created_at DESC', (manga_id,))
    rows = c.fetchall()
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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO manga_reviews (manga_id, email, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?)',
              (manga_id, user['email'], rating, review_text, time.time()))
    conn.commit()
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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT email, comment_text, created_at FROM chapter_comments WHERE manga_id = ? AND chapter_id = ? ORDER BY created_at DESC', (manga_id, chapter_id))
    rows = c.fetchall()
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
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('INSERT INTO chapter_comments (manga_id, chapter_id, email, comment_text, created_at) VALUES (?, ?, ?, ?, ?)',
              (manga_id, chapter_id, user['email'], comment_text, time.time()))
    conn.commit()
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
    cache_path = os.path.join(CACHE_DIR, f"{url_hash}.jpg")

    if os.path.exists(cache_path):
        return send_file(cache_path, mimetype='image/jpeg',
                         max_age=86400)

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
            img.save(cache_path, "JPEG", quality=90)
            return send_file(cache_path, mimetype='image/jpeg', max_age=86400)
        except Exception as e:
            pass

    return send_file(io.BytesIO(img_data), mimetype='image/jpeg')


if __name__ == '__main__':
    app.run(debug=True, port=8000)
