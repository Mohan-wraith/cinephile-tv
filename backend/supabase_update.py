"""
CINEPHILE TV - IMDB DATABASE UPDATE PIPELINE
Uses plain requests instead of supabase-py (avoids Python 3.14 compatibility issues)
"""
import pandas as pd
import os
import requests
import gzip
import shutil
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

REST_URL = f"{SUPABASE_URL}/rest/v1"

URLS = {
    "basics": "https://datasets.imdbws.com/title.basics.tsv.gz",
    "episode": "https://datasets.imdbws.com/title.episode.tsv.gz",
    "ratings": "https://datasets.imdbws.com/title.ratings.tsv.gz"
}

MIN_VOTES = 4900
BATCH_SIZE = 500


def download_and_extract(url, filename):
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


def upload_batch(table_name, data_list):
    total = len(data_list)
    uploaded = 0
    errors = 0

    for i in range(0, total, BATCH_SIZE):
        batch = data_list[i:i + BATCH_SIZE]
        r = requests.post(
            f"{REST_URL}/{table_name}",
            headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
            json=batch
        )
        if r.status_code in (200, 201):
            uploaded += len(batch)
        else:
            errors += len(batch)
            print(f"   ⚠️  Batch error {r.status_code}: {r.text[:200]}")

        if uploaded % 5000 == 0 or i + BATCH_SIZE >= total:
            print(f"   ✓ {uploaded:,}/{total:,} uploaded to {table_name}")

    if errors:
        print(f"   ⚠️  {errors:,} rows had errors in {table_name}")


def build_and_upload():
    print("\n" + "="*60)
    print("🎬 CINEPHILE TV - DATABASE UPDATE PIPELINE")
    print("="*60 + "\n")

    # Step 1: Download
    print("📥 STEP 1: DOWNLOADING IMDB DATASETS\n")
    for name, url in URLS.items():
        download_and_extract(url, f"title.{name}.tsv")

    # Step 2: Preserve rows absent from this snapshot.
    # Uploads below merge on tconst; do not clear the existing tables.
    print("\n🔄 STEP 2: PRESERVING EXISTING ROWS\n")

    # Step 3: Load ratings into memory
    print("\n📊 STEP 3: LOADING RATINGS\n")
    ratings_map = {}
    chunksize = 1000000
    for chunk in pd.read_csv("title.ratings.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'numVotes', 'averageRating']):
        for _, row in chunk.iterrows():
            ratings_map[row['tconst']] = {
                'numvotes': int(row['numVotes']),
                'averageRating': float(row['averageRating'])
            }
    print(f"✅ Loaded {len(ratings_map):,} ratings into memory")

    # Step 4: Process shows
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
                'numVotes': rating_data['numvotes'],
                'averageRating': rating_data['averageRating'],
                'genres': row['genres'] if row['genres'] != '\\N' else 'Unknown',
                'created_at': now,
                'updated_at': now
            })

    print(f"✅ {len(shows_data):,} shows (≥{MIN_VOTES:,} votes)")
    print("⬆️  Uploading shows...\n")
    upload_batch('shows', shows_data)

    # Step 5: Process episodes
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

    # Step 6: Get episode titles
    print("\n📝 STEP 6: EXTRACTING EPISODE TITLES\n")
    ep_titles = {}
    for chunk in pd.read_csv("title.basics.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'primaryTitle']):
        matched = chunk[chunk['tconst'].isin(kept_episodes)]
        for _, row in matched.iterrows():
            ep_titles[row['tconst']] = row['primaryTitle']
    print(f"✅ Got {len(ep_titles):,} episode titles")

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

    print("⬆️  Uploading episodes...\n")
    upload_batch('episodes', episodes_data)

    # Step 7: Upload ratings
    print("\n⭐ STEP 7: UPLOADING RATINGS\n")
    ratings_data = []
    for chunk in pd.read_csv("title.ratings.tsv", sep='\t', chunksize=chunksize):
        for _, row in chunk.iterrows():
            ratings_data.append({
                'tconst': row['tconst'],
                'averageRating': float(row['averageRating']),
                'numvotes': int(row['numVotes']),
                'created_at': now,
                'updated_at': now
            })

    print(f"✅ {len(ratings_data):,} ratings")
    print("⬆️  Uploading ratings...\n")
    upload_batch('ratings', ratings_data)

    print("\n" + "="*60)
    print("🎉 DATABASE UPDATE COMPLETE!")
    print("="*60)
    print(f"✅ Shows:    {len(shows_data):,}")
    print(f"✅ Episodes: {len(episodes_data):,}")
    print(f"✅ Ratings:  {len(ratings_data):,}")
    print("="*60 + "\n")


if __name__ == "__main__":
    build_and_upload()
