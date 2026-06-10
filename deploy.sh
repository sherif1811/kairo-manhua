#!/bin/bash
# ==================================================
# KAIRO/منهوا - DigitalOcean Auto-Deploy Script
# استخدم هذا السكريبت عند الاتصال عبر SSH بالـ Droplet
# ==================================================
set -e

REPO_DIR="/var/www/kairo-manhua"
SERVICE_NAME="kairo-manhua"

echo "=== KAIRO Deploy: $(date) ==="

# 1. Pull latest code
cd "$REPO_DIR"
git pull origin main

# 2. Activate virtual env & install deps
source venv/bin/activate
pip install -r requirements.txt

# 3. Run DB migrations (init_db runs on server start)
#    Already handled by flask_app.py startup

# 4. Restart the gunicorn service
sudo systemctl restart "$SERVICE_NAME"

echo "=== DEPLOY COMPLETE: $(date) ==="
