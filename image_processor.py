import os
import shutil
import logging
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from collections import Counter

logger = logging.getLogger(__name__)

def get_solid_rows(img, threshold=20, solid_ratio=0.98):
    w, h = img.size
    pixels = img.load()
    solid_rows = []
    row_bg_colors = []
    for y in range(h):
        row_colors = [pixels[x, y] for x in range(w)]
        rounded_colors = [(r//8*8, g//8*8, b//8*8) for r, g, b in row_colors]
        most_common_rounded = Counter(rounded_colors).most_common(1)[0][0]
        r_ref, g_ref, b_ref = most_common_rounded
        solid_count = 0
        sum_r = sum_g = sum_b = 0
        for r, g, b in row_colors:
            if abs(r - r_ref) < threshold and abs(g - g_ref) < threshold and abs(b - b_ref) < threshold:
                solid_count += 1
                sum_r += r; sum_g += g; sum_b += b
        if solid_count / w >= solid_ratio:
            solid_rows.append(True)
            row_bg_colors.append((sum_r // solid_count, sum_g // solid_count, sum_b // solid_count))
        else:
            solid_rows.append(False)
            row_bg_colors.append(None)
    return solid_rows, row_bg_colors

def detect_and_remove_watermarks(img):
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
    removed_regions = []
    removed_count = 0
    margin = 50
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
                min_x = w; max_x = 0
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
                if segments_count >= 8 and avg_segment_width < 45:
                    is_watermark = True
                elif segments_count > 0 and max(segment_widths) > 350 and rh <= 95 and w_ratio > 0.70:
                    is_watermark = True
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
                    pad = 5
                    by1 = max(0, y1 - pad)
                    by2 = min(h - 1, y2 + pad)
                    draw.rectangle([0, by1, w, by2], fill=bg_color)
                    removed_regions.append((by1, by2, bg_color))
                    removed_count += 1
    return removed_regions, removed_count

def process_image_watermark(img):
    if not NUMPY_AVAILABLE:
        return 0
    try:
        removed_regions, count = detect_and_remove_watermarks(img)
        return count
    except Exception as e:
        print(f"Watermark processing skipped: {e}")
        return 0

def detect_chapter_language(image_paths, sample_count=5):
    """Detect whether chapter images contain Arabic or English text.
    Returns 'ar' if Arabic detected, 'en' otherwise.
    Falls back to 'en' if OCR libraries are not available."""
    try:
        import pytesseract
    except ImportError:
        try:
            from paddleocr import PaddleOCR
            ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            sample_paths = [p for p in image_paths if os.path.isfile(p)][:sample_count]
            for path in sample_paths:
                result = ocr.ocr(path, cls=False)
                if result and result[0]:
                    for line in result[0]:
                        text = line[1][0]
                        arabic_count = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
                        if arabic_count > 3:
                            return 'ar'
        except Exception:
            pass
        return 'en'

    sample_paths = [p for p in image_paths if os.path.isfile(p)][:sample_count]
    ar_scores = 0
    en_scores = 0

    for path in sample_paths:
        try:
            img = Image.open(path)
            text = pytesseract.image_to_string(img, lang='ara+eng')
            ar_chars = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
            en_chars = sum(1 for c in text if c.isascii() and c.isalpha())
            if ar_chars > en_chars:
                ar_scores += 1
            else:
                en_scores += 1
        except Exception:
            continue

    return 'ar' if ar_scores > en_scores else 'en'


def batch_clean_images(input_dir: str, output_dir: str) -> list[str]:
    input_path = Path(input_dir) if not isinstance(input_dir, Path) else input_dir
    output_path = Path(output_dir) if not isinstance(output_dir, Path) else output_dir
    output_path.mkdir(parents=True, exist_ok=True)

    results = []
    for img_file in sorted(input_path.iterdir()):
        if img_file.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        out_file = output_path / img_file.name
        shutil.copy(str(img_file), str(out_file))
        results.append(str(out_file))
        logger.info(f"Copied: {img_file.name}")

    return results
