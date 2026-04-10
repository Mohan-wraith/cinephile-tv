"""
Run this to see what IMDb's HTML actually looks like
"""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import time

options = Options()
options.binary_location = r"C:\Users\SUB-ZERO\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe"
options.add_argument("--headless")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=options)

try:
    # Band of Brothers Season 1
    url = "https://www.imdb.com/title/tt0185906/episodes/?season=1"
    print(f"Loading: {url}\n")
    
    driver.get(url)
    time.sleep(3)
    
    soup = BeautifulSoup(driver.page_source, "html.parser")
    
    # Save the HTML
    with open("imdb_page_structure.html", "w", encoding="utf-8") as f:
        f.write(soup.prettify())
    print("✓ Saved full HTML to: imdb_page_structure.html\n")
    
    # Check for different possible containers
    print("="*60)
    print("CHECKING DIFFERENT SELECTORS:")
    print("="*60)
    
    articles = soup.find_all("article")
    print(f"\n1. <article> tags: {len(articles)}")
    
    divs_with_episode = soup.find_all("div", class_=lambda x: x and "episode" in x.lower())
    print(f"2. <div> with 'episode' in class: {len(divs_with_episode)}")
    
    ipc_metadata = soup.find_all(class_=lambda x: x and "ipc-metadata-list" in x.lower())
    print(f"3. Elements with 'ipc-metadata-list': {len(ipc_metadata)}")
    
    # Try to find any rating stars
    ratings = soup.find_all(class_=lambda x: x and "rating" in x.lower())
    print(f"4. Elements with 'rating' in class: {len(ratings)}")
    
    # Check for script tags with JSON data
    scripts = soup.find_all("script", type="application/ld+json")
    print(f"5. JSON-LD scripts: {len(scripts)}")
    
    next_data = soup.find("script", id="__NEXT_DATA__")
    print(f"6. __NEXT_DATA__ script: {'FOUND' if next_data else 'NOT FOUND'}")
    
    print("\n" + "="*60)
    print("SAMPLE CONTENT (first 500 chars of body):")
    print("="*60)
    body = soup.find("body")
    if body:
        print(body.get_text()[:500])
    
    print("\n✓ Check imdb_page_structure.html for full HTML")
    
finally:
    driver.quit()