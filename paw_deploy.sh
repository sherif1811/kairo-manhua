#!/bin/bash
# ==============================================
# هذا السكريبت يشتغل على PythonAnywhere Webhook
# ==============================================
cd ~/kairo-manhua
git pull origin main
touch /var/www/kairomanha_pythonanywhere_com_wsgi.py
echo "[$(date)] Deployed successfully"
