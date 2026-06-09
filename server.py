import os
import io
import hashlib
import urllib.parse
import urllib.request
import http.server
import socketserver
from PIL import Image, ImageDraw, ImageFont

PORT = 8000
CACHE_DIR = "image_cache"

# Create cache directory if it doesn't exist
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

class KairoRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/save_manga':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            import json
            try:
                manga_data = json.loads(post_data.decode('utf-8'))
                manga_id = manga_data.get("id")
                
                if not manga_id:
                    self.send_response(400)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(b"Missing manga id")
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
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "title": manga_data.get("title")}).encode('utf-8'))
                print(f"[+] Saved manga received from browser: {manga_data.get('title')}")
            except Exception as e:
                print(f"[-] Error saving manga: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/proxy-image':
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
