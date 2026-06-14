import json, os, logging
from flask import Blueprint, request, jsonify
from scrapers.alternative_sources import search_alternative_sources, find_fallback_images, get_mangadex_chapter_images

logger = logging.getLogger("routes.alternative")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

alt_sources_bp = Blueprint('alt_sources', __name__)

def get_session_user():
    from flask import request
    import sqlite3
    token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    if not token:
        return None
    DB_FILE = os.path.join(BASE_DIR, "kairo.db")
    conn = sqlite3.connect(DB_FILE, timeout=30)
    try:
        c = conn.cursor()
        c.execute('SELECT email, role FROM sessions WHERE token = ? AND expires_at > ?', (token, time.time()))
        row = c.fetchone()
        if row:
            return {"email": row[0], "role": row[1], "token": token}
    except Exception:
        pass
    finally:
        conn.close()
    return None

def require_admin(f):
    import functools
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        user = get_session_user()
        if not user or user.get('role') != 'admin':
            return jsonify({"error": "غير مصرح"}), 403
        return f(*args, **kwargs)
    return wrapper

@alt_sources_bp.route('/api/admin/find-alternative-sources', methods=['POST'])
@require_admin
def find_alternative_sources():
    data = request.get_json(silent=True) or {}
    manga_id = data.get('manga_id', '').strip()
    if not manga_id:
        return jsonify({"error": "manga_id مطلوب"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            mangas = json.load(f)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    manga = next((m for m in mangas if str(m.get('id')) == manga_id), None)
    if not manga:
        return jsonify({"error": "مانجا غير موجودة"}), 404
    title = manga.get('title', '')
    if not title:
        return jsonify({"error": "المانجا ليس لها عنوان"}), 400
    results = search_alternative_sources(title)
    return jsonify({"results": results, "manga_id": manga_id}), 200

@alt_sources_bp.route('/api/admin/link-alternative-source', methods=['POST'])
@require_admin
def link_alternative_source():
    data = request.get_json(silent=True) or {}
    manga_id = data.get('manga_id', '').strip()
    source = data.get('source', '')
    source_url = data.get('source_url', '')
    if not manga_id or not source or not source_url:
        return jsonify({"error": "manga_id, source, source_url مطلوبون"}), 400
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            mangas = json.load(f)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    manga = next((m for m in mangas if str(m.get('id')) == manga_id), None)
    if not manga:
        return jsonify({"error": "مانجا غير موجودة"}), 404
    alt_sources = manga.get('alternative_sources', [])
    for s in alt_sources:
        if s.get('source') == source:
            return jsonify({"error": f"المصدر {source} موجود بالفعل"}), 400
    alt_sources.append({"source": source, "url": source_url})
    manga['alternative_sources'] = alt_sources
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(mangas, f, ensure_ascii=False, indent=2)
    return jsonify({"status": "success", "alternative_sources": alt_sources}), 200

@alt_sources_bp.route('/api/admin/import-alt-chapter-images', methods=['POST'])
@require_admin
def import_alt_chapter_images():
    data = request.get_json(silent=True) or {}
    manga_id = data.get('manga_id', '').strip()
    chapter_id = data.get('chapter_id', '').strip()
    alt_url = data.get('alt_url', '').strip()
    if not manga_id or not chapter_id or not alt_url:
        return jsonify({"error": "manga_id, chapter_id, alt_url مطلوبون"}), 400
    images = get_mangadex_chapter_images(alt_url)
    if not images:
        return jsonify({"error": "لم نعثر على صور للمصدر البديل"}), 404
    OUTPUT_FILE = os.path.join(BASE_DIR, "scraped_mangas.json")
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            mangas = json.load(f)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    manga = next((m for m in mangas if str(m.get('id')) == manga_id), None)
    if not manga:
        return jsonify({"error": "مانجا غير موجودة"}), 404
    chapter = next((ch for ch in (manga.get('chapters') or []) if str(ch.get('id')) == chapter_id), None)
    if not chapter:
        return jsonify({"error": "فصل غير موجود"}), 404
    chapter['alt_images'] = images
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(mangas, f, ensure_ascii=False, indent=2)
    return jsonify({"status": "success", "alt_images": images, "count": len(images)}), 200

import time
