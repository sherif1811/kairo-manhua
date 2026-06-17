import sys

with open("flask_app.py", "r", encoding="utf-8") as f:
    content = f.read()

target = """    image_urls = None
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
        "message": "تم وضع ال� صل � ي طابور المعالجة"
    }), 202"""

replacement = """    try:
        from tasks import process_chapter
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
            "message": "?? ??? ????? ?? ????? ????????"
        }), 202
    except Exception as e:
        import traceback
        err = f"Server Error: {str(e)}\\n{traceback.format_exc()}"
        print(err)
        return jsonify({"error": err}), 500"""

if target in content:
    content = content.replace(target, replacement)
    with open("flask_app.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Target not found")
