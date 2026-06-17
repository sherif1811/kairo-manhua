#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image
img = Image.open("test_page.webp")
print(f"Size: {img.size}")
print(f"Mode: {img.mode}")
print(f"Format: {img.format}")
print(f"File size: {img.fp.name}")
