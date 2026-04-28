import sqlite3
import os
from supabase import create_client, Client

# ═══════════════════════════════════════════════════════════════════════════
# SUPABASE CREDENTIALS - FILL THESE IN
# ═══════════════════════════════════════════════════════════════════════════
SUPABASE_URL = "https://giyedhgpncubquylemht.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeWVkaGdwbmN1YnF1eWxlbWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3OTQ4MDYsImV4cCI6MjA5MTM3MDgwNn0.Q2bbcD_2dLtnCBEYX6SPVkEB0MPIKZ7zZ8-uU3tWbUM"  # Get from Supabase Settings > API

# ═══════════════════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════════════════
SQLITE_DB = r"C:\Users\SUB-ZERO\Downloads\MY PROJECTS\Cinephile-Fullstack\backend\tv_shows.db"

print("🔄 Starting Migration...")
print(f"📁 SQLite: {SQLITE_DB}")
print(f"☁️  Supabase: {SUPABASE_URL}")

# Connect
sqlite_conn = sqlite3.connect(SQLITE_DB)
sqlite_conn.row_factory = sqlite3.Row
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ═══════════════════════════════════════════════════════════════════════════
# 1. MIGRATE SHOWS
# ═══════════════════════════════════════════════════════════════════════════
print("\n📺 Migrating SHOWS...")
cursor = sqlite_conn.execute("SELECT * FROM shows")
shows = [dict(row) for row in cursor.fetchall()]
print(f"   Found {len(shows)} shows")

BATCH_SIZE = 1000
for i in range(0, len(shows), BATCH_SIZE):
    batch = shows[i:i+BATCH_SIZE]
    supabase.table('shows').upsert(batch).execute()
    print(f"   ✅ Uploaded {min(i+BATCH_SIZE, len(shows))}/{len(shows)} shows")

# ═══════════════════════════════════════════════════════════════════════════
# 2. MIGRATE EPISODES
# ═══════════════════════════════════════════════════════════════════════════
print("\n📺 Migrating EPISODES...")
cursor = sqlite_conn.execute("SELECT * FROM episodes")
episodes = [dict(row) for row in cursor.fetchall()]
print(f"   Found {len(episodes)} episodes")

for i in range(0, len(episodes), BATCH_SIZE):
    batch = episodes[i:i+BATCH_SIZE]
    supabase.table('episodes').upsert(batch).execute()
    print(f"   ✅ Uploaded {min(i+BATCH_SIZE, len(episodes))}/{len(episodes)} episodes")

# ═══════════════════════════════════════════════════════════════════════════
# 3. MIGRATE RATINGS
# ═══════════════════════════════════════════════════════════════════════════
print("\n⭐ Migrating RATINGS...")
cursor = sqlite_conn.execute("SELECT * FROM ratings")
ratings = [dict(row) for row in cursor.fetchall()]
print(f"   Found {len(ratings)} ratings")

for i in range(0, len(ratings), BATCH_SIZE):
    batch = ratings[i:i+BATCH_SIZE]
    supabase.table('ratings').upsert(batch).execute()
    print(f"   ✅ Uploaded {min(i+BATCH_SIZE, len(ratings))}/{len(ratings)} ratings")

sqlite_conn.close()

print("\n✅ MIGRATION COMPLETE!")
print(f"📊 Total: {len(shows)} shows, {len(episodes)} episodes, {len(ratings)} ratings")
print("\n🎯 Your frontend should now work!")