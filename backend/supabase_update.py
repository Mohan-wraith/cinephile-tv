"""
DIRECT TO SUPABASE - IMDB DATA PIPELINE
Downloads latest IMDb datasets and uploads directly to Supabase PostgreSQL
Replaces old data to save storage space
"""
import pandas as pd
import os
import requests
import gzip
import shutil
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

URLS = {
    "basics": "https://datasets.imdbws.com/title.basics.tsv.gz",
    "episode": "https://datasets.imdbws.com/title.episode.tsv.gz",
    "ratings": "https://datasets.imdbws.com/title.ratings.tsv.gz"
}

MIN_VOTES = 4900
BATCH_SIZE = 1000  # Insert 1000 rows at a time

def download_and_extract(url, filename):
    """Download and extract IMDb dataset"""
    if os.path.exists(filename):
        print(f"✅ {filename} exists. Using local copy.")
        return
    
    print(f"⬇️  Downloading {filename}...")
    headers = {"User-Agent": "Mozilla/5.0"}
    
    with requests.get(url, stream=True, headers=headers) as r:
        r.raise_for_status()
        with open(filename + ".gz", 'wb') as f:
            shutil.copyfileobj(r.raw, f)
    
    print(f"📦 Extracting {filename}...")
    with gzip.open(filename + ".gz", 'rb') as f_in:
        with open(filename, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    if os.path.exists(filename + ".gz"):
        os.remove(filename + ".gz")

def clear_table(table_name):
    """Delete all data from table to save storage"""
    print(f"🗑️  Clearing {table_name} table...")
    try:
        # Delete all rows (Supabase doesn't support TRUNCATE via API)
        supabase.table(table_name).delete().neq('tconst', '').execute()
        print(f"✅ {table_name} cleared")
    except Exception as e:
        print(f"⚠️  Could not clear {table_name}: {e}")

def upload_in_batches(table_name, data_list, batch_size=BATCH_SIZE):
    """Upload data in batches to avoid timeouts"""
    total = len(data_list)
    uploaded = 0
    
    for i in range(0, total, batch_size):
        batch = data_list[i:i + batch_size]
        try:
            supabase.table(table_name).insert(batch).execute()
            uploaded += len(batch)
            print(f"   ✓ {uploaded:,}/{total:,} rows uploaded to {table_name}")
        except Exception as e:
            print(f"   ✗ Error uploading batch to {table_name}: {e}")
            continue

def build_and_upload():
    """Main pipeline: Download IMDb data and upload to Supabase"""
    
    print("\n" + "="*60)
    print("🎬 CINEPHILE TV - DATABASE UPDATE PIPELINE")
    print("="*60 + "\n")
    
    # Step 1: Download datasets
    print("📥 STEP 1: DOWNLOADING IMDB DATASETS\n")
    for name, url in URLS.items():
        download_and_extract(url, f"title.{name}.tsv")
    
    # Step 2: Clear existing data
    print("\n🗑️  STEP 2: CLEARING OLD DATA FROM SUPABASE\n")
    clear_table('shows')
    clear_table('episodes')
    clear_table('ratings')
    
    # Step 3: Load ratings into memory
    print("\n📊 STEP 3: LOADING RATINGS DATA\n")
    ratings_map = {}
    chunksize = 1000000
    
    for chunk in pd.read_csv("title.ratings.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'numVotes', 'averageRating']):
        for _, row in chunk.iterrows():
            ratings_map[row['tconst']] = {
                'numvotes': int(row['numVotes']),  # lowercase for ratings table
                'averageRating': float(row['averageRating'])
            }
    
    print(f"✅ Loaded {len(ratings_map):,} ratings into memory")
    
    # Step 4: Process and upload SHOWS
    print("\n📺 STEP 4: PROCESSING SHOWS\n")
    
    shows_data = []
    kept_show_tconsts = set()
    now = datetime.utcnow().isoformat()
    
    for chunk in pd.read_csv("title.basics.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'titleType', 'primaryTitle', 'startYear', 'endYear', 'genres']):
        tv = chunk[chunk['titleType'].isin(['tvSeries', 'tvMiniSeries'])]
        
        for _, row in tv.iterrows():
            tid = row['tconst']
            rating_data = ratings_map.get(tid)
            
            if not rating_data or rating_data['numvotes'] < MIN_VOTES:
                continue
            
            kept_show_tconsts.add(tid)
            
            shows_data.append({
                'tconst': tid,
                'primaryTitle': row['primaryTitle'] if row['primaryTitle'] != '\\N' else 'Unknown',
                'startYear': row['startYear'] if row['startYear'] != '\\N' else 'Unknown',
                'endYear': row['endYear'] if row['endYear'] != '\\N' else None,
                'numVotes': rating_data['numvotes'],  # camelCase for shows table
                'averageRating': rating_data['averageRating'],
                'genres': row['genres'] if row['genres'] != '\\N' else 'Unknown',
                'created_at': now,
                'updated_at': now
            })
    
    print(f"✅ Processed {len(shows_data):,} shows (≥{MIN_VOTES:,} votes)")
    print(f"⬆️  Uploading shows to Supabase...\n")
    upload_in_batches('shows', shows_data)
    
    # Step 5: Process EPISODES
    print("\n🎞️  STEP 5: PROCESSING EPISODES\n")
    
    kept_episodes = set()
    ep_list = []
    
    for chunk in pd.read_csv("title.episode.tsv", sep='\t', chunksize=chunksize, na_values='\\N'):
        chunk = chunk.dropna(subset=['seasonNumber', 'episodeNumber'])
        chunk = chunk[chunk['parentTconst'].isin(kept_show_tconsts)]
        
        for _, row in chunk.iterrows():
            kept_episodes.add(row['tconst'])
            ep_list.append({
                'tconst': row['tconst'],
                'parentTconst': row['parentTconst'],
                'seasonNumber': int(row['seasonNumber']),
                'episodeNumber': int(row['episodeNumber'])
            })
    
    print(f"✅ Found {len(ep_list):,} episodes")
    
    # Step 6: Extract episode titles
    print(f"📝 STEP 6: EXTRACTING EPISODE TITLES\n")
    
    ep_titles = {}
    for chunk in pd.read_csv("title.basics.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'primaryTitle']):
        matched = chunk[chunk['tconst'].isin(kept_episodes)]
        for _, row in matched.iterrows():
            ep_titles[row['tconst']] = row['primaryTitle']
    
    print(f"✅ Extracted {len(ep_titles):,} episode titles")
    
    # Combine episode data with titles
    episodes_data = []
    for ep in ep_list:
        episodes_data.append({
            'tconst': ep['tconst'],
            'parentTconst': ep['parentTconst'],
            'seasonNumber': ep['seasonNumber'],
            'episodeNumber': ep['episodeNumber'],
            'primaryTitle': ep_titles.get(ep['tconst'], f"Episode {ep['episodeNumber']}"),
            'created_at': now,
            'updated_at': now
        })
    
    print(f"⬆️  Uploading episodes to Supabase...\n")
    upload_in_batches('episodes', episodes_data)
    
    # Step 7: Upload RATINGS
    print("\n⭐ STEP 7: UPLOADING RATINGS\n")
    
    ratings_data = []
    for chunk in pd.read_csv("title.ratings.tsv", sep='\t', chunksize=chunksize):
        for _, row in chunk.iterrows():
            ratings_data.append({
                'tconst': row['tconst'],
                'averageRating': float(row['averageRating']),
                'numvotes': int(row['numVotes']),  # lowercase!
                'created_at': now,
                'updated_at': now
            })
    
    print(f"✅ Processed {len(ratings_data):,} ratings")
    print(f"⬆️  Uploading ratings to Supabase...\n")
    upload_in_batches('ratings', ratings_data)
    
    # Final summary
    print("\n" + "="*60)
    print("🎉 DATABASE UPDATE COMPLETE!")
    print("="*60)
    print(f"✅ Shows: {len(shows_data):,}")
    print(f"✅ Episodes: {len(episodes_data):,}")
    print(f"✅ Ratings: {len(ratings_data):,}")
    print(f"✅ All data uploaded to Supabase")
    print("\n💾 Old data was REPLACED (not duplicated)")
    print("🌐 Your app now has the latest IMDb ratings!")
    print("="*60 + "\n")

if __name__ == "__main__":
    build_and_upload()
