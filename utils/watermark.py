import os
import sqlite3
from PIL import Image, ImageDraw, ImageFont

DB_FILE = None

def _get_db_path():
    global DB_FILE
    if DB_FILE is None:
        DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kairo.db")
    return DB_FILE

def get_watermark_config():
    config = {
        'watermark_enabled': 'false',
        'watermark_text': 'KAIRO / منهوا',
        'watermark_opacity': '25',
        'watermark_font_size': '32',
        'watermark_position': 'bottom-right',
    }
    try:
        conn = sqlite3.connect(_get_db_path(), timeout=5)
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

def apply_watermark(img):
    config = get_watermark_config()
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
