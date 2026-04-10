"""
Migrate your SQLite database to Supabase PostgreSQL
Run once to move all your data
"""

import sqlite3
from supabase import create_client, Client

# ========================================
# CONFIGURATION (FILL THIS ONLY)
# ========================================

SUPABASE_URL = "https://giyedhgpncubquylemht.supabase.co"

# ⚠️ USE SERVICE ROLE KEY (NOT ANON)
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeWVkaGdwbmN1YnF1eWxlbWh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc5NDgwNiwiZXhwIjoyMDkxMzcwODA2fQ.C1GI5OtLPe8YECAqoSaxr_Ri_eUUX870_6EHxzJoYw8"

SQLITE_DB_PATH = "tv_shows.db"


# ========================================
# CONNECT TO DATABASES
# ========================================

print("🔗 Connecting to databases...")

sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
sqlite_conn.row_factory = sqlite3.Row

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("✅ Connected!\n")


# ========================================
# MIGRATE SHOWS
# ========================================

print("📺 Migrating shows...")
cursor = sqlite_conn.execute("SELECT * FROM shows")
shows = [dict(row) for row in cursor.fetchall()]

batch_size = 500  # safer

for i in range(0, len(shows), batch_size):
    batch = shows[i:i+batch_size]
    supabase.table("shows").upsert(batch).execute()
    print(f"  ✓ {min(i+batch_size, len(shows))}/{len(shows)}")

print(f"✅ Shows migrated: {len(shows)}\n")


# ========================================
# MIGRATE EPISODES
# ========================================

print("📼 Migrating episodes...")
cursor = sqlite_conn.execute("SELECT * FROM episodes")
episodes = [dict(row) for row in cursor.fetchall()]

for i in range(0, len(episodes), batch_size):
    batch = episodes[i:i+batch_size]
    supabase.table("episodes").upsert(batch).execute()
    print(f"  ✓ {min(i+batch_size, len(episodes))}/{len(episodes)}")

print(f"✅ Episodes migrated: {len(episodes)}\n")


# ========================================
# MIGRATE RATINGS
# ========================================

print("⭐ Migrating ratings...")
cursor = sqlite_conn.execute("SELECT * FROM ratings")
ratings = [dict(row) for row in cursor.fetchall()]

for i in range(0, len(ratings), batch_size):
    batch = ratings[i:i+batch_size]
    supabase.table("ratings").upsert(batch).execute()
    print(f"  ✓ {min(i+batch_size, len(ratings))}/{len(ratings)}")

print(f"✅ Ratings migrated: {len(ratings)}\n")


# ========================================
# DONE
# ========================================

sqlite_conn.close()

print("=" * 60)
print("🎉 MIGRATION COMPLETE!")
print("=" * 60)
print(f"✅ Shows: {len(shows)}")
print(f"✅ Episodes: {len(episodes)}")
print(f"✅ Ratings: {len(ratings)}")