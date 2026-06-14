import os
import json
import sqlite3
import logging
from flask import Flask, request, jsonify
from celery.result import AsyncResult
from celery_app import celery_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

DRAFT_DB = "kairo_drafts.db"
AI_API_KEY = os.environ.get("AI_API_KEY", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "kairo-admin-secret-dev")


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def require_admin():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token != ADMIN_TOKEN:
        return jsonify({"error": "غير مصرح"}), 403
    return None


@app.route("/api/admin/auto-translate", methods=["POST", "OPTIONS"])
def auto_translate():
    if request.method == "OPTIONS":
        return jsonify({}), 204
    auth_err = require_admin()
    if auth_err:
        return auth_err

    data = request.get_json(silent=True) or {}
    source_url = (data.get("url") or "").strip()
    manga_id = (data.get("manga_id") or "").strip()
    chapter_id = (data.get("chapter_id") or "").strip()

    if not source_url or not manga_id or not chapter_id:
        return jsonify({"error": "الرجاء إدخال الرابط، معرف المانجا، ومعرف الفصل"}), 400

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

    from tasks import process_chapter
    task = process_chapter.delay(manga_id, chapter_id, source_url, image_urls=image_urls)

    logger.info(f"Queued task {task.id} for {manga_id}/{chapter_id}")
    return jsonify({
        "status": "queued",
        "task_id": task.id,
        "message": "تم وضع الفصل في طابور المعالجة"
    }), 202


@app.route("/api/admin/task-status/<task_id>", methods=["GET", "OPTIONS"])
def task_status(task_id):
    if request.method == "OPTIONS":
        return jsonify({}), 204
    auth_err = require_admin()
    if auth_err:
        return auth_err

    result = AsyncResult(task_id, app=celery_app)
    response = {"task_id": task_id, "status": result.status, "state": result.state}

    if result.state == "PENDING":
        response["info"] = "في انتظار التنفيذ"
    elif result.state == "STARTED":
        meta = result.info or {}
        response["progress"] = meta.get("progress", 0)
        response["current_step"] = meta.get("state", "STARTED")
        response["info"] = "جاري المعالجة"
    elif result.state == "SUCCESS":
        response["result"] = result.result
        response["info"] = "تم بنجاح"
    elif result.state == "FAILURE":
        response["error"] = str(result.info)
        response["info"] = "فشل"
    elif result.state == "RETRY":
        response["info"] = "جاري إعادة المحاولة"

    return jsonify(response)


@app.route("/api/admin/drafts", methods=["GET", "OPTIONS"])
def list_drafts():
    if request.method == "OPTIONS":
        return jsonify({}), 204
    auth_err = require_admin()
    if auth_err:
        return auth_err

    conn = sqlite3.connect(DRAFT_DB)
    conn.row_factory = sqlite3.Row
    try:
        c = conn.cursor()
        c.execute("""
            SELECT id, manga_id, chapter_id, source_url, status, images, created_at
            FROM chapter_drafts
            ORDER BY created_at DESC
            LIMIT 100
        """)
        rows = c.fetchall()
        drafts = []
        for row in rows:
            images_raw = row["images"]
            try:
                parsed_images = json.loads(images_raw) if images_raw else []
            except (json.JSONDecodeError, TypeError):
                parsed_images = []
            drafts.append({
                "id": row["id"],
                "manga_id": row["manga_id"],
                "chapter_id": row["chapter_id"],
                "source_url": row["source_url"],
                "status": row["status"],
                "images": parsed_images,
                "created_at": row["created_at"]
            })
        return jsonify({"drafts": drafts})
    finally:
        conn.close()


@app.route("/api/admin/task-log", methods=["GET", "OPTIONS"])
def task_log():
    if request.method == "OPTIONS":
        return jsonify({}), 204
    auth_err = require_admin()
    if auth_err:
        return auth_err

    conn = sqlite3.connect(DRAFT_DB)
    conn.row_factory = sqlite3.Row
    try:
        c = conn.cursor()
        c.execute("""
            SELECT id, task_id, manga_id, chapter_id, status, result, created_at
            FROM task_log
            ORDER BY created_at DESC
            LIMIT 100
        """)
        rows = c.fetchall()
        logs = []
        for row in rows:
            logs.append({
                "id": row["id"],
                "task_id": row["task_id"],
                "manga_id": row["manga_id"],
                "chapter_id": row["chapter_id"],
                "status": row["status"],
                "result": row["result"],
                "created_at": row["created_at"]
            })
        return jsonify({"logs": logs})
    finally:
        conn.close()


@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "service": "Kairo Manhwa Translation Server",
        "status": "running",
        "api_key_configured": bool(AI_API_KEY)
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    logger.info(f"Starting translation server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
