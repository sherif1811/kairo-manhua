import os
import io
import hashlib
import urllib.parse
import urllib.request
import http.server
import socketserver
import sqlite3
import secrets
import time
from PIL import Image, ImageDraw, ImageFont

PORT = 8000
CACHE_DIR = "image_cache"
DB_FILE = "kairo.db"

# Create cache directory if it doesn't exist
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

def get_solid_rows(img, threshold=20, solid_ratio=0.98):
    w, h = img.size
    pixels = img.load()
    solid_rows = []
    row_bg_colors = []
    
    for y in range(h):
        row_colors = [pixels[x, y] for x in range(w)]
        rounded_colors = [(r//8*8, g//8*8, b//8*8) for r, g, b in row_colors]
        from collections import Counter
        most_common_rounded = Counter(rounded_colors).most_common(1)[0][0]
        
        r_ref, g_ref, b_ref = most_common_rounded
        solid_count = 0
        sum_r = sum_g = sum_b = 0
        for r, g, b in row_colors:
            if abs(r - r_ref) < threshold and abs(g - g_ref) < threshold and abs(b - b_ref) < threshold:
                solid_count += 1
                sum_r += r
                sum_g += g
                sum_b += b
                
        if solid_count / w >= solid_ratio:
            solid_rows.append(True)
            row_bg_colors.append((sum_r // solid_count, sum_g // solid_count, sum_b // solid_count))
        else:
            solid_rows.append(False)
            row_bg_colors.append(None)
            
    return solid_rows, row_bg_colors

def detect_and_remove_watermarks(img):
    import numpy as np
    if img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    pixels = img.load()
    
    solid_rows, row_bg_colors = get_solid_rows(img)
    
    regions = []
    in_region = False
    start_y = 0
    for y in range(h):
        if not solid_rows[y]:
            if not in_region:
                start_y = y
                in_region = True
        else:
            if in_region:
                regions.append((start_y, y - 1))
                in_region = False
    if in_region:
        regions.append((start_y, h - 1))
        
    draw = ImageDraw.Draw(img)
    margin = 50
    pad = 5
    
    for y1, y2 in regions:
        rh = y2 - y1 + 1
        
        if 15 <= rh <= 250:
            bounded_top = (y1 == 0 or solid_rows[y1 - 1])
            bounded_bottom = (y2 == h - 1 or solid_rows[y2 + 1])
            
            if bounded_top and bounded_bottom:
                bg_color = (255, 255, 255)
                if y1 > 0 and row_bg_colors[y1 - 1] is not None:
                    bg_color = row_bg_colors[y1 - 1]
                elif y2 < h - 1 and row_bg_colors[y2 + 1] is not None:
                    bg_color = row_bg_colors[y2 + 1]
                    
                crop_w = w - 2 * margin
                binary = np.zeros((rh, crop_w), dtype=np.uint8)
                threshold = 30
                min_x = w
                max_x = 0
                has_content = False
                
                for y in range(rh):
                    img_y = y1 + y
                    for x in range(crop_w):
                        img_x = margin + x
                        r, g, b = pixels[img_x, img_y]
                        tr, tg, tb = bg_color
                        if abs(r - tr) > threshold or abs(g - tg) > threshold or abs(b - tb) > threshold:
                            binary[y, x] = 1
                            if img_x < min_x: min_x = img_x
                            if img_x > max_x: max_x = img_x
                            has_content = True
                            
                if not has_content:
                    continue
                    
                bw = max_x - min_x + 1
                w_ratio = bw / (w - 2 * margin)
                
                proj = np.sum(binary, axis=0)
                is_gap = proj <= 1
                
                gaps_count = 0
                in_gap = True
                for val in is_gap:
                    if val:
                        in_gap = True
                    else:
                        if in_gap:
                            gaps_count += 1
                            in_gap = False
                            
                segments_count = 0
                in_segment = False
                segment_widths = []
                current_segment_width = 0
                for val in is_gap:
                    if not val:
                        if not in_segment:
                            in_segment = True
                        current_segment_width += 1
                    else:
                        if in_segment:
                            segments_count += 1
                            segment_widths.append(current_segment_width)
                            in_segment = False
                            current_segment_width = 0
                if in_segment:
                    segments_count += 1
                    segment_widths.append(current_segment_width)
                    
                avg_segment_width = np.mean(segment_widths) if segments_count > 0 else 0
                
                is_watermark = False
                
                # Heuristic 1: English text watermark
                if segments_count >= 8 and avg_segment_width < 45:
                    is_watermark = True
                # Heuristic 2: Long continuous banner/URL
                elif segments_count > 0 and max(segment_widths) > 350 and rh <= 95 and w_ratio > 0.70:
                    is_watermark = True
                # Heuristic 3: Logo/drawing in a gap
                elif w_ratio < 0.85 and rh >= 60:
                    max_w = max(segment_widths) if segments_count > 0 else 0
                    rel_min_x = min_x - margin
                    rel_max_x = max_x - margin
                    bbox_crop = binary[:, rel_min_x : rel_max_x + 1]
                    non_bg_count = np.sum(bbox_crop)
                    area = bw * rh
                    density = non_bg_count / area if area > 0 else 0
                    if max_w > 100 and density >= 0.15:
                        is_watermark = True
                        
                if is_watermark:
                    bx1 = 0
                    by1 = max(0, y1 - pad)
                    bx2 = w
                    by2 = min(h - 1, y2 + pad)
                    draw.rectangle([bx1, by1, bx2, by2], fill=bg_color)
                    print(f"[Watermark Removed] y=[{y1}, {y2}] background={bg_color}")
                    
    return img

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    email TEXT PRIMARY KEY,
                    password_hash TEXT,
                    role TEXT
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
    conn.commit()
    conn.close()

init_db()

def hash_password(password):
    salt = "kairo_salt_123!"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

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
                
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT email FROM users WHERE email = ?', (email,))
                if c.fetchone():
                    conn.close()
                    self.send_cors_response(400, body=json.dumps({"error": "هذا البريد الإلكتروني مسجل بالفعل"}))
                    return
                
                # Force admin role for the specified email
                role = 'admin' if email == 'sherifahmed200100@gmail.com' else 'user'
                password_hash = hash_password(password)
                
                c.execute('INSERT INTO users VALUES (?, ?, ?)', (email, password_hash, role))
                conn.commit()
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
                
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT password_hash, role FROM users WHERE email = ?', (email,))
                row = c.fetchone()
                
                if not row or row[0] != hash_password(password):
                    conn.close()
                    self.send_cors_response(401, body=json.dumps({"error": "البريد الإلكتروني أو كلمة المرور غير صحيحة"}))
                    return
                
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
                conn.close()
                
                self.send_cors_response(200, body=json.dumps({
                    "status": "success",
                    "token": token,
                    "email": email,
                    "role": role
                }))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 3. Logout Endpoint
        elif parsed_url.path == '/api/logout':
            user = get_session_user(self.headers)
            if user:
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('DELETE FROM sessions WHERE token = ?', (user['token'],))
                conn.commit()
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
                
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('INSERT OR REPLACE INTO user_settings VALUES (?, ?)', (user['email'], json.dumps(settings)))
                conn.commit()
                conn.close()
                
                self.send_cors_response(200, body=json.dumps({"status": "success"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))

        # 5. Save Manga Endpoint (Admin Only)
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
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('INSERT INTO suggestions (email, type, content, created_at) VALUES (?, ?, ?, ?)',
                          (user['email'], sug_type, content, time.time()))
                conn.commit()
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
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('INSERT OR REPLACE INTO manga_reviews (manga_id, email, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?)',
                          (manga_id, user['email'], rating, review_text, time.time()))
                conn.commit()
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
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('INSERT INTO chapter_comments (manga_id, chapter_id, email, comment_text, created_at) VALUES (?, ?, ?, ?, ?)',
                          (manga_id, chapter_id, user['email'], comment_text, time.time()))
                conn.commit()
                conn.close()
                self.send_cors_response(200, body=json.dumps({"status": "success", "message": "تم نشر التعليق بنجاح"}))
            except Exception as e:
                self.send_cors_response(500, body=json.dumps({"error": str(e)}))
        else:
            self.send_cors_response(404, body=json.dumps({"error": "غير موجود"}))

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        import json
        
        # 1. Get Settings Endpoint
        if parsed_url.path == '/api/get_settings':
            user = get_session_user(self.headers)
            if not user:
                self.send_cors_response(401, body=json.dumps({"error": "غير مصرح، الرجاء تسجيل الدخول"}))
                return
            
            try:
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT settings_json FROM user_settings WHERE email = ?', (user['email'],))
                row = c.fetchone()
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
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT email, type, content, created_at FROM suggestions ORDER BY created_at DESC')
                rows = c.fetchall()
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
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT email, rating, review_text, created_at FROM manga_reviews WHERE manga_id = ? ORDER BY created_at DESC', (manga_id,))
                rows = c.fetchall()
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
                conn = sqlite3.connect(DB_FILE)
                c = conn.cursor()
                c.execute('SELECT email, comment_text, created_at FROM chapter_comments WHERE manga_id = ? AND chapter_id = ? ORDER BY created_at DESC', (manga_id, chapter_id))
                rows = c.fetchall()
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
            # Serve static files
            super().do_GET()

    def handle_proxy_image(self, url):
        # 1. Check Cache
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
        cache_path = os.path.join(CACHE_DIR, f"{url_hash}.jpg")
        
        if os.path.exists(cache_path):
            self.serve_local_file(cache_path)
            return

        # 2. Fetch remote image
        # Set User-Agent to avoid getting blocked
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        
        try:
            # Set a standard timeout of 15 seconds
            with urllib.request.urlopen(req, timeout=15) as response:
                img_data = response.read()
        except Exception as e:
            # Fallback to serving the image directly via redirect if download fails
            print(f"Failed to fetch {url}, redirecting... Error: {e}")
            self.send_response(302)
            self.send_header('Location', url)
            self.end_headers()
            return

        # 3. Clean and process image
        try:
            img = Image.open(io.BytesIO(img_data))
            img = img.convert('RGB')
            # Detect and remove watermarks of other sites first
            try:
                img = detect_and_remove_watermarks(img)
            except Exception as e:
                print(f"Error removing watermarks: {e}")
            w, h = img.size
            
            draw = ImageDraw.Draw(img)
            
            # Wipe left margin (45px) and right margin (45px) with solid black
            margin_width = 45
            draw.rectangle([0, 0, margin_width, h], fill="black")
            draw.rectangle([w - margin_width, 0, w, h], fill="black")
            
            # Draw custom watermark vertical text on left and right margins
            # Load Font
            try:
                font = ImageFont.truetype("arial.ttf", 14)
            except Exception:
                try:
                    font = ImageFont.load_default(size=14)
                except TypeError:
                    font = ImageFont.load_default()
            
            # Function to draw repeating vertical text
            def draw_vertical_brand(draw, x_center, height):
                y = 80
                char_spacing = 16
                text_block = [
                    ("KAIRO", (0, 240, 255)),     # Cyan
                    ("★", (255, 0, 127)),         # Pink
                    ("MANHUA", (138, 43, 226))    # Purple
                ]
                
                while y < height - 100:
                    for word, color in text_block:
                        # Center character
                        for char in word:
                            # Center character offset approximation
                            draw.text((x_center - 5, y), char, fill=color, font=font)
                            y += char_spacing
                        y += 10
                    y += 150 # spacing between repeats

            # Draw on left margin center
            draw_vertical_brand(draw, margin_width // 2, h)
            # Draw on right margin center
            draw_vertical_brand(draw, w - margin_width // 2, h)
            
            # Save to cache
            img.save(cache_path, "JPEG", quality=90)
            
            # Serve local file
            self.serve_local_file(cache_path)
            
        except Exception as e:
            print(f"Error processing image bytes: {e}")
            # Serve original bytes if processing fails
            self.send_response(200)
            self.send_header('Content-Type', 'image/jpeg')
            self.send_header('Content-Length', str(len(img_data)))
            self.end_headers()
            self.wfile.write(img_data)

    def serve_local_file(self, path):
        self.send_response(200)
        self.send_header('Content-Type', 'image/jpeg')
        self.send_header('Content-Length', str(os.path.getsize(path)))
        # Enable caching on browser
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.end_headers()
        with open(path, 'rb') as f:
            self.wfile.write(f.read())

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
