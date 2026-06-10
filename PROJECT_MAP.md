# KAIRO / منهوا — Project Map

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser (SPA)                  │
│  Vanilla JS  ·  Hash Router  ·  localStorage    │
│  IntersectionObserver Lazy Loading              │
│  Dynamic SEO Meta (title, og:*, twitter:*)     │
├─────────────────────────────────────────────────┤
│              HTTP / WSGI Server                  │
│  server.py (dev)  ·  flask_app.py (prod)        │
│  ThreadingHTTPServer  ·  Flask + WSGI           │
├─────────────────────────────────────────────────┤
│                   SQLite DB                      │
│  kairo.db (WAL mode, timeout=30)                │
│  users, sessions, settings, reviews, comments   │
│  scraped_mangas.json (manga/chapter data)       │
└─────────────────────────────────────────────────┘
```

## Key Files

| File | Role |
|---|---|---|
| `index.html` | SPA shell with SEO-optimized meta tags |
| `app.js` | Frontend controller: routing, state, rendering |
| `style.css` | Design system & component styles |
| `server.py` | Dev server (ThreadingHTTPServer, Python stdlib) |
| `flask_app.py` | Production server (Flask, WSGI, DigitalOcean) |
| `image_processor.py` | Shared watermark detection/removal + KAIRO branding module |
| `kairo.db` | SQLite database (auth, settings, reviews) |
| `scraped_mangas.json` | Manga/chapter data (admin scraped) |
| `image_cache/` | Cached processed images (JPEG + WebP) |
| `covers/` | Downloaded cover/banner images |
| `requirements.txt` | Pillow + numpy (image processing) |
| `PROJECT_MAP.md` | This file — architecture + ADR |

## Architectural Decisions (ADRs)

### ADR-1: Hash Routing for SPA
- **Context:** App uses `#/manga/id` hash routing
- **Decision:** Keep hash routing; server serves index.html for all non-file routes (SPA fallback)
- **SEO:** Meta tags set dynamically via JS; server-side injection for crawlers via clean URLs (`/manga/id`)

### ADR-2: Crawler Middleware (Server-Side SEO)
- **Context:** Social media crawlers (Facebook, Twitter, Discord) don't execute JS; need OG meta tags
- **Decision:** Both `server.py` and `flask_app.py` check User-Agent for crawler patterns and inject OG/title/meta tags into `index.html` before serving for clean URLs (`/manga/{id}`, `/reader/{mangaId}/{chapterId}`)
- **Files:** `server.py:serve_index_html()`, `flask_app.py:render_index_with_seo()`

### ADR-3: Dynamic Sitemap.xml
- **Context:** Need sitemap for Google Search Console
- **Decision:** `GET /sitemap.xml` reads `scraped_mangas.json` and generates XML using `xml.etree.ElementTree` (stdlib, no extra deps)
- **URLs:** Clean URLs (`/manga/{id}`, `/reader/{mangaId}/{chapterId}`)

### ADR-4: WebP Image Conversion
- **Context:** Reduce bandwidth for image-heavy manga pages
- **Decision:** `proxy-image` endpoint saves both JPEG and WebP to cache; serves WebP when `Accept: image/webp` header is present
- **File:** `server.py:handle_proxy_image()`, `flask_app.py:proxy_image()`

### ADR-5: Lazy Loading with IntersectionObserver
- **Context:** Reader pages have many images; need efficient loading with error resilience
- **Decision:** IntersectionObserver with 400px rootMargin; max 2 retries per image (proxy → direct → fallback); retry counter stored in `data-retries` attribute

### ADR-6: Vanilla JS (No Framework)
- **Context:** App is SPA with complex state management
- **Decision:** Pure Vanilla JS with `AppState` class; avoids build tools and framework complexity; matches DigitalOcean App Platform static deployment constraints

### ADR-7: Smart Watermark Removal + KAIRO Branding
- **Context:** Chapter images from external sources contain competing site watermarks; need automated removal and replacement
- **Decision:** `image_processor.py` implements visual watermark detection using `numpy` + PIL: identifies non-solid rows bounded by solid regions, classifies via 3 heuristics (text density, banner width, logo density), fills with background color, and overlays subtle "KAIRO / منهوا" brand text
- **Integration:** Called in `handle_proxy_image()` / `proxy_image()` before vertical side branding; cached results prevent reprocessing

## SEO Implementation Summary

| Feature | Frontend | Backend (server.py) | Backend (flask_app.py) |
|---|---|---|---|
| Dynamic title/meta | `handleRouting()` → `updateSEOMeta()` | — | — |
| Crawler meta injection | — | `serve_index_html()` | `render_index_with_seo()` |
| Sitemap.xml | — | `GET /sitemap.xml` | `GET /sitemap.xml` |
| WebP images | — | `handle_proxy_image()` | `proxy_image()` |
| Lazy loading | `initLazyLoading()` + `loadSingleImage()` | — | — |

## Deployment Checklist

- [x] Push to GitHub (autodeploy to DigitalOcean App Platform)
- [x] Configure App Platform: start command `gunicorn flask_app:app`
- [x] Set `requirements.txt`: `Pillow==10.4.0`, `flask>=3.0.0`, `gunicorn>=22.0.0`
- [ ] Ensure `sitemap.xml` is accessible (requires populated `scraped_mangas.json`)
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] Verify OG meta with Facebook Sharing Debugger
- [ ] Verify Twitter card with Twitter Card Validator
- [x] OAuth credentials configurable via admin panel (stored in DB, no hardcoded placeholders)

## ORPHANS & PENDING

- **OAuth Credentials:** تُحمّل من قاعدة البيانات (system_settings). على المسؤول إدخال Google Client ID و Facebook App ID الفعليين عبر (لوحة الإدارة ← إعدادات الموقع) لتفعيل تسجيل الدخول الاجتماعي.
- **Watermark Algorithm Tuning:** قد تحتاج الهيuristic thresholds (عدد القطع، العرض، الكثافة) إلى ضبط حسب مصادر الصور المختلفة. تُسجل كل إزالة في الـ Console log للمساعدة في الضبط.
- **Google Search Console:** Sitemap submission and crawl verification pending server deployment.
- **Social Media Debugger:** OG/Twitter card validation pending public URL availability.
- **PWA / Offline Reading:** Not yet implemented. Reader has `isOfflineAvailable` flag but full service worker + cache strategy not built.
- **Admin Panel Polish:** Admin statistics dashboard exists but could benefit from date-range filtering and export features.

## Dependencies

- **Python:** Pillow 10.4.0, numpy >=1.26.0, Flask >=3.0.0, gunicorn >=22.0.0
- **Frontend:** None (Vanilla JS, Font Awesome CDN, Google Fonts CDN, Google Identity Services CDN)

## Implementation Status

| Area | Status | Notes |
|------|--------|-------|
| SEO dynamic meta (frontend) | ✅ Complete | `updateSEOMeta()` in `handleRouting()` |
| Crawler middleware (server.py) | ✅ Complete | `serve_index_html()` with crawler User-Agent detection |
| Crawler middleware (flask_app.py) | ✅ Complete | `render_index_with_seo()` with crawler User-Agent detection |
| Sitemap.xml (server.py) | ✅ Complete | Dynamic from `scraped_mangas.json` |
| Sitemap.xml (flask_app.py) | ✅ Complete | Same logic |
| WebP conversion (server.py) | ✅ Complete | JPEG+WebP cache, `Accept: image/webp` detection |
| WebP conversion (flask_app.py) | ✅ Complete | Same with `PIL_AVAILABLE` graceful degradation |
| Lazy loading (frontend) | ✅ Complete | IntersectionObserver + 400px rootMargin + 2 retry max |
| PIL graceful degradation (server.py) | ✅ Complete | Uses `PIL_AVAILABLE` flag |
| Error handling (file reads) | ✅ Complete | try/except with logging for index.html reads |
| Dead code cleanup (app.js) | ✅ Complete | Removed unused bookmark selector + old comment form |
| Requirements updated | ✅ Complete | `flask`, `gunicorn` added |
| OAuth credential management | ✅ Complete | Loaded from DB (`system_settings`), admin panel editable, no hardcoded placeholders |
| PIL graceful degradation (server.py) | ✅ Complete | Uses `PIL_AVAILABLE` flag like flask_app.py |
| Watermark removal + KAIRO branding | ✅ Complete | `image_processor.py` detects/removes watermarks → replaces with brand text in proxy-image pipeline |
| Auto-fetch cover + banner | ✅ Complete | `import_from_lek.py` + `import_catalog.py` download to `covers/` dir, store local paths in JSON |

## Quality Notes

- **JS Syntax Checker:** `check_js_syntax.py` is a basic regex-based parser. It reports 4 false-positive errors on the existing `cssImageUrl()` function (template literal with escaped backticks at `app.js:81-82`). These are not actual syntax errors — confirmed by runtime execution and manual inspection. Real JS parser (Node.js) would pass cleanly.
- **Python Syntax:** Both `server.py` and `flask_app.py` compile without errors.
- **Dead Code:** Zero dead code remains. Unused bookmark selector (`.select-bookmark-status`) and old comment form (`#comment-form`) were removed from `attachEventListeners()`.
- **OAuth Credentials:** No hardcoded placeholders remain. Credentials stored in `kairo.db` `system_settings` table, loaded via `bootstrapConfig()` → `GET /api/config`, editable via admin settings panel. Validation is format-based (Google: ends with `.apps.googleusercontent.com`, Facebook: length >= 8).
