from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

options = Options()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

try:
    # Set session token and login state
    driver.get("http://localhost:8000/")
    driver.execute_script("window.localStorage.setItem('sessionToken', 'dummy_token');")
    driver.execute_script("window.localStorage.setItem('userEmail', 'sherifahmed181199@gmail.com');")
    driver.get("http://localhost:8000/#/admin")
    time.sleep(2)
    
    btn = driver.find_element(By.ID, "tab-site-settings")
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(1)
    
    panel = driver.find_element(By.ID, "panel-site-settings")
    print("PANEL DISPLAY:", panel.value_of_css_property("display"))
    
    active_tabs = driver.find_elements(By.CSS_SELECTOR, ".admin-tab.active")
    print("ACTIVE TABS:", len(active_tabs), active_tabs[0].text if active_tabs else "None")
    
    logs = driver.get_log('browser')
    print("LOGS:", logs)
finally:
    driver.quit()
