import time
import json
import os
import subprocess
from glob import glob

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'mangas_data')
CONFIG_FILE = os.path.join(BASE_DIR, 'mangas_data', 'auto_updater_config.json')

def is_enabled():
    if not os.path.exists(CONFIG_FILE):
        return False
    try:
        with open(CONFIG_FILE, 'r') as f:
            data = json.load(f)
            return data.get('enabled', False)
    except:
        return False

def run_update_cycle():
    print("[AutoUpdater] Starting update cycle...")
    files = glob(os.path.join(DATA_DIR, '*.json'))
    for file in files:
        if not is_enabled():
            print("[AutoUpdater] Updater was disabled mid-cycle. Stopping.")
            return
            
        try:
            with open(file, 'r', encoding='utf-8') as f:
                manga = json.load(f)
            
            source_url = manga.get('source_url')
            if not source_url:
                continue
                
            print(f"[AutoUpdater] Checking updates for: {manga.get('title')}...")
            # Run the scraper
            process = subprocess.Popen(
                ['python', 'add_manga.py', source_url],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            process.wait()
            print(f"[AutoUpdater] Finished checking: {manga.get('title')}")
            
            # Sleep a bit to avoid hitting rate limits
            time.sleep(5)
            
        except Exception as e:
            print(f"[AutoUpdater] Error processing file {file}: {e}")

if __name__ == '__main__':
    print("[AutoUpdater] Auto Updater Daemon Started.")
    while True:
        if is_enabled():
            run_update_cycle()
        else:
            # print("[AutoUpdater] Paused. Waiting...")
            pass
            
        # Wait 6 hours before next full cycle, but check enable flag every 1 minute
        for _ in range(60 * 6):  # 6 hours in 1-minute increments
            time.sleep(60)
            if not is_enabled():
                break # If disabled, exit the sleep loop to wait
