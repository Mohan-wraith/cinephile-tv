"""
AUTOMATED WEEKLY SCRAPER
Runs via GitHub Actions every week to update all show ratings
"""
import os
import time
import random
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
from supabase import create_client, Client
import json
import re

# ========================================
# CONFIGURATION
# ========================================
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')  # Use service_role key for writes

# ========================================
# CONNECT TO SUPABASE
# ========================================
print(f"🔗 Connecting to Supabase...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
print("✅ Connected!\n")

# ========================================
# SETUP SELENIUM
# ========================================
print("🌐 Setting up browser...")
options = Options()
options.add_argument("--headless")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

driver = webdriver.Chrome(options=options)
print("✅ Browser ready!\n")

# ========================================
# GET ALL SHOWS FROM DATABASE
# ========================================
print("📺 Fetching shows from database...")
response = supabase.table('shows').select('tconst, primaryTitle').execute()
shows = response.data
print(f"✅ Found {len(shows)} shows to update\n")

# ========================================
# SCRAPE EACH SHOW
# ========================================
print("="*60)
print("🔄 STARTING WEEKLY UPDATE")
print("="*60)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

updated_count = 0
error_count = 0

for i, show in enumerate(shows, 1):
    tconst = show['tconst']
    title = show['primaryTitle']
    
    print(f"[{i}/{len(shows)}] {title} ({tconst})")
    
    try:
        # Visit show's episode page
        url = f"https://www.imdb.com/title/{tconst}/episodes/"
        driver.get(url)
        time.sleep(random.uniform(2, 4))
        
        soup = BeautifulSoup(driver.page_source, "html.parser")
        
        # Get all seasons
        season_select = soup.find("select", id=re.compile(r"browse-episodes-season"))
        if not season_select:
            print(f"  ⚠️  No seasons found - skipping")
            continue
        
        season_options = season_select.find_all("option")
        season_numbers = [opt.get('value') for opt in season_options if opt.get('value', '').isdigit()]
        
        if not season_numbers:
            print(f"  ⚠️  No valid seasons - skipping")
            continue
        
        print(f"  📊 Found {len(season_numbers)} seasons")
        
        # Scrape each season
        episodes_to_update = []
        
        for season_num in season_numbers:
            season_url = f"https://www.imdb.com/title/{tconst}/episodes/?season={season_num}"
            driver.get(season_url)
            time.sleep(random.uniform(1.5, 3))
            
            soup = BeautifulSoup(driver.page_source, "html.parser")
            
            # Try JSON method first
            next_data_tag = soup.find("script", id="__NEXT_DATA__")
            if next_data_tag:
                try:
                    next_data = json.loads(next_data_tag.string)
                    page_props = next_data.get("props", {}).get("pageProps", {})
                    content_data = page_props.get("contentData", {})
                    section = content_data.get("section", {})
                    episodes_list = section.get("episodes", {}).get("items", [])
                    
                    for ep_data in episodes_list:
                        ep_num = ep_data.get("episodeNumber")
                        ep_tconst = ep_data.get("id", "")
                        
                        rating_data = ep_data.get("ratingsSummary", {})
                        rating = rating_data.get("aggregateRating")
                        votes = rating_data.get("voteCount", 0)
                        
                        if ep_tconst and rating:
                            episodes_to_update.append({
                                'tconst': ep_tconst,
                                'averageRating': float(rating),
                                'numVotes': int(votes) if votes else 0
                            })
                
                except Exception as e:
                    print(f"  ⚠️  S{season_num} JSON parse error: {e}")
        
        # Batch update ratings in Supabase
        if episodes_to_update:
            supabase.table('ratings').upsert(episodes_to_update).execute()
            print(f"  ✅ Updated {len(episodes_to_update)} episode ratings")
            updated_count += 1
        else:
            print(f"  ⚠️  No episodes to update")
        
        # Rate limiting (be nice to IMDb)
        time.sleep(random.uniform(3, 5))
    
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        error_count += 1
        continue

# ========================================
# CLEANUP
# ========================================
driver.quit()

print("\n" + "="*60)
print("✅ WEEKLY UPDATE COMPLETE")
print("="*60)
print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"✅ Successfully updated: {updated_count} shows")
print(f"❌ Errors: {error_count} shows")
print(f"📊 Total shows: {len(shows)}")
print("="*60)

# Create summary file for GitHub Actions artifacts
with open('update_summary.txt', 'w') as f:
    f.write(f"Weekly Update Summary\n")
    f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"Successfully updated: {updated_count}/{len(shows)} shows\n")
    f.write(f"Errors: {error_count}\n")

print("\n💾 Summary saved to update_summary.txt")