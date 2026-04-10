import pandas as pd
import sqlite3
import os
import requests
import gzip
import shutil

DB_NAME = "tv_shows.db"
URLS = {
    "basics": "https://datasets.imdbws.com/title.basics.tsv.gz",
    "episode": "https://datasets.imdbws.com/title.episode.tsv.gz",
    "ratings": "https://datasets.imdbws.com/title.ratings.tsv.gz"
}

MIN_VOTES = 4900

def download_and_extract(url, filename):
    if os.path.exists(filename):
        print(f"✅ {filename} exists. Using local copy.")
        return
    print(f"⬇️ Downloading {filename}...")
    headers = {"User-Agent": "Mozilla/5.0"}
    with requests.get(url, stream=True, headers=headers) as r:
        r.raise_for_status()
        with open(filename + ".gz", 'wb') as f:
            shutil.copyfileobj(r.raw, f)
    print(f"📦 Extracting {filename}...")
    with gzip.open(filename + ".gz", 'rb') as f_in:
        with open(filename, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    if os.path.exists(filename + ".gz"): os.remove(filename + ".gz")

def build_database():
    # 1. Download
    for name, url in URLS.items():
        download_and_extract(url, f"title.{name}.tsv")

    print(f"\n⚙️ Rebuilding Database (WITH EPISODE TITLES & {MIN_VOTES} VOTE FILTER)...")
    if os.path.exists(DB_NAME): os.remove(DB_NAME)

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    # 2. Load Votes + Ratings into memory
    print("   -> Loading Ratings & Votes...")
    ratings_map = {}
    chunksize = 1000000
    for chunk in pd.read_csv("title.ratings.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'numVotes', 'averageRating']):
        for _, row in chunk.iterrows():
            ratings_map[row['tconst']] = (int(row['numVotes']), float(row['averageRating']))

    # 3. Process Shows — NOW includes averageRating in shows table
    print("   -> Processing Shows...")
    c.execute("""
        CREATE TABLE IF NOT EXISTS shows (
            tconst        TEXT PRIMARY KEY,
            primaryTitle  TEXT,
            startYear     TEXT,
            endYear       TEXT,
            numVotes      INTEGER,
            averageRating REAL,
            genres        TEXT
        )
    """)

    batch_data = []
    kept_show_tconsts = set()

    for chunk in pd.read_csv("title.basics.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'titleType', 'primaryTitle', 'startYear', 'endYear', 'genres']):
        tv = chunk[chunk['titleType'].isin(['tvSeries', 'tvMiniSeries'])]
        for _, row in tv.iterrows():
            tid = row['tconst']
            votes, avg_rating = ratings_map.get(tid, (0, 0.0))

            if votes < MIN_VOTES:
                continue

            kept_show_tconsts.add(tid)
            title     = row['primaryTitle']
            year      = row['startYear']  if row['startYear']  != '\\N' else "Unknown"
            end_year  = row['endYear']    if row['endYear']    != '\\N' else "None"
            genres    = row['genres']     if row['genres']     != '\\N' else "Unknown"

            batch_data.append((tid, title, year, end_year, votes, avg_rating, genres))

        if batch_data:
            c.executemany("INSERT OR IGNORE INTO shows VALUES (?,?,?,?,?,?,?)", batch_data)
            conn.commit()
            batch_data = []

    c.execute("CREATE INDEX IF NOT EXISTS idx_title ON shows (primaryTitle)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_votes ON shows (numVotes)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_rating ON shows (averageRating)")

    # 4. Process Episodes
    print("   -> Finding Episodes for Kept Shows...")
    kept_episodes = set()
    ep_list = []
    for chunk in pd.read_csv("title.episode.tsv", sep='\t', chunksize=chunksize, na_values='\\N'):
        chunk = chunk.dropna(subset=['seasonNumber', 'episodeNumber'])
        chunk = chunk[chunk['parentTconst'].isin(kept_show_tconsts)]
        for _, row in chunk.iterrows():
            kept_episodes.add(row['tconst'])
            ep_list.append((row['tconst'], row['parentTconst'],
                            int(row['seasonNumber']), int(row['episodeNumber'])))

    # 5. Extract Episode Titles
    print("   -> Extracting Episode Titles (scanning basics again, ~30 seconds)...")
    ep_titles = {}
    for chunk in pd.read_csv("title.basics.tsv", sep='\t', chunksize=chunksize,
                             usecols=['tconst', 'primaryTitle']):
        matched = chunk[chunk['tconst'].isin(kept_episodes)]
        for _, row in matched.iterrows():
            ep_titles[row['tconst']] = row['primaryTitle']

    # 6. Save Episodes
    print("   -> Saving Episodes to Database...")
    c.execute("""
        CREATE TABLE IF NOT EXISTS episodes (
            tconst        TEXT PRIMARY KEY,
            parentTconst  TEXT,
            seasonNumber  INTEGER,
            episodeNumber INTEGER,
            primaryTitle  TEXT
        )
    """)

    final_eps = []
    for ep in ep_list:
        tid, ptid, sn, en = ep
        title = ep_titles.get(tid, f"Episode {en}")
        final_eps.append((tid, ptid, sn, en, title))
        if len(final_eps) > 100000:
            c.executemany("INSERT OR IGNORE INTO episodes VALUES (?,?,?,?,?)", final_eps)
            conn.commit()
            final_eps = []

    if final_eps:
        c.executemany("INSERT OR IGNORE INTO episodes VALUES (?,?,?,?,?)", final_eps)
        conn.commit()

    c.execute("CREATE INDEX IF NOT EXISTS idx_parent ON episodes (parentTconst)")

    # 7. Process Ratings table (kept for backwards compatibility with myapi.py joins)
    print("   -> Processing Ratings table...")
    c.execute("CREATE TABLE IF NOT EXISTS ratings (tconst TEXT PRIMARY KEY, averageRating REAL)")
    for chunk in pd.read_csv("title.ratings.tsv", sep='\t', chunksize=chunksize):
        data = chunk[['tconst', 'averageRating']].values.tolist()
        c.executemany("INSERT OR IGNORE INTO ratings VALUES (?,?)", data)
        conn.commit()

    conn.close()

    size_mb = os.path.getsize(DB_NAME) / (1024 * 1024)
    print(f"\n🎉 SUCCESS! Database rebuilt with averageRating in shows table. Size: {size_mb:.2f} MB")
    print(f"   Shows kept: {len(kept_show_tconsts):,} (≥{MIN_VOTES:,} votes)")

if __name__ == "__main__":
    build_database()