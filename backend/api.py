"""
CINEPHILE TV BACKEND - EXACT COLUMN NAMES FROM SCHEMA
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from supabase import create_client, Client
import json
from bs4 import BeautifulSoup
import time
import random

app = FastAPI(title="Cinephile TV API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Cinephile TV API Engine. All systems go."}

@app.get("/api/top250")
def get_top_250():
    try:
        response = supabase.rpc('get_top_250').execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        try:
            response = supabase.table('shows').select('*').gte('numvotes', 50000).order('averageRating', desc=True).limit(250).execute()
            return {"status": "success", "data": response.data}
        except Exception as e2:
            return {"status": "error", "message": str(e2)}

@app.get("/api/search")
def search_shows(q: str):
    try:
        response = supabase.rpc('search_shows_by_title', {'search_query': q}).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        try:
            response = supabase.table('shows').select('*').ilike('primaryTitle', f'%{q}%').order('numVotes', desc=True).limit(15).execute()
            return {"status": "success", "data": response.data}
        except Exception as e2:
            return {"status": "error", "message": str(e2)}

@app.get("/api/show/{tconst}")
def get_show(tconst: str):
    try:
        response = supabase.rpc('get_show_by_id', {'show_id': tconst}).execute()
        if not response.data:
            return {"status": "error", "message": "Show not found"}
        return {"status": "success", "data": response.data[0]}
    except Exception as e:
        try:
            response = supabase.table('shows').select('*').eq('tconst', tconst).limit(1).execute()
            if not response.data:
                return {"status": "error", "message": "Show not found"}
            return {"status": "success", "data": response.data[0]}
        except Exception as e2:
            return {"status": "error", "message": str(e2)}

@app.get("/api/recommendations")
def get_recommendations(id: str):
    try:
        response = supabase.rpc('get_recommendations', {'show_id': id}).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        try:
            show_response = supabase.table('shows').select('genres').eq('tconst', id).execute()
            if not show_response.data or not show_response.data[0].get('genres'):
                return {"status": "success", "data": []}
            genres_str = show_response.data[0]['genres']
            main_genre = genres_str.split(',')[0].strip()
            response = supabase.table('shows').select('*').ilike('genres', f'%{main_genre}%').neq('tconst', id).order('numVotes', desc=True).limit(12).execute()
            return {"status": "success", "data": response.data}
        except Exception as e2:
            return {"status": "error", "message": str(e2)}

@app.get("/api/heatmap")
def get_heatmap(id: str, mode: str = "db"):

    if mode == "db":
        try:
            ep_response = supabase.table('episodes').select(
                'tconst, seasonNumber, episodeNumber, primaryTitle'
            ).eq('parentTconst', id).gt(
                'seasonNumber', 0
            ).order('seasonNumber').order('episodeNumber').execute()

            if not ep_response.data:
                return {"status": "error", "message": "No data found in database."}

            episodes = ep_response.data

            episode_ids = [ep['tconst'] for ep in episodes]

            ratings_response = supabase.table('ratings').select(
                '*'
            ).in_('tconst', episode_ids).execute()

            ratings_map = {r['tconst']: r for r in ratings_response.data}

            seasons_data = {}

            for ep in episodes:
                season = str(int(ep['seasonNumber']))

                if season not in seasons_data:
                    seasons_data[season] = []

                rating_data = ratings_map.get(ep['tconst'], {})

                seasons_data[season].append({
                    "episode": int(ep['episodeNumber']),
                    "title": ep['primaryTitle'] or f"Episode {ep['episodeNumber']}",
                    "rating": rating_data.get('averageRating', 0),
                    "ep_tconst": ep['tconst']
                })

            return {
                "status": "success",
                "data": seasons_data,
                "source": "database"
            }

        except Exception as e:
            return {"status": "error", "message": str(e)}

    elif mode == "live":
        return {
        "status": "error",
        "message": "Live scraping unavailable. Use db mode."
    }

@app.get("/api/hall-of-fame")
def get_hall_of_fame():
    try:
        # OPTIMIZED: Get episodes WITH shows data in ONE query using nested select
        # ratings -> episodes(*, shows(*))
        print("Fetching best episodes with nested select...")
        
        best_query = """
            *, 
            episodes!inner(
                parentTconst,
                seasonNumber,
                episodeNumber,
                primaryTitle,
                shows!inner(
                    primaryTitle,
                    startYear,
                    numVotes
                )
            )
        """
        
        best_resp = (
            supabase.table('ratings')
            .select(best_query)
            .gte('numvotes', 1000)
            .order('averageRating', desc=True)
            .limit(25)
            .execute()
        )
        
        best_episodes = []
        for item in best_resp.data:
            ep = item.get('episodes', {})
            show = ep.get('shows', {}) if isinstance(ep.get('shows'), dict) else {}
            
            best_episodes.append({
                'tconst': item['tconst'],
                'averageRating': item['averageRating'],
                'numVotes': item['numvotes'],
                'showTconst': ep.get('parentTconst'),
                'seasonNumber': ep.get('seasonNumber'),
                'episodeNumber': ep.get('episodeNumber'),
                'epTitle': ep.get('primaryTitle', ''),
                'showTitle': show.get('primaryTitle', ''),
                'startYear': show.get('startYear', ''),
                'showVotes': show.get('numVotes', 0)
            })
        
        print(f"✓ Fetched {len(best_episodes)} best episodes in 1 query")
        
        # Worst episodes - same optimization
        print("Fetching worst episodes with nested select...")
        
        worst_resp = (
            supabase.table('ratings')
            .select(best_query)  # Same query structure
            .gte('numvotes', 1000)
            .order('averageRating', desc=False)
            .limit(25)
            .execute()
        )
        
        worst_episodes = []
        for item in worst_resp.data:
            ep = item.get('episodes', {})
            show = ep.get('shows', {}) if isinstance(ep.get('shows'), dict) else {}
            
            worst_episodes.append({
                'tconst': item['tconst'],
                'averageRating': item['averageRating'],
                'numVotes': item['numvotes'],
                'showTconst': ep.get('parentTconst'),
                'seasonNumber': ep.get('seasonNumber'),
                'episodeNumber': ep.get('episodeNumber'),
                'epTitle': ep.get('primaryTitle', ''),
                'showTitle': show.get('primaryTitle', ''),
                'startYear': show.get('startYear', ''),
                'showVotes': show.get('numVotes', 0)
            })
        
        print(f"✓ Fetched {len(worst_episodes)} worst episodes in 1 query")
        
        return {
            "status": "success",
            "bestEpisodes": best_episodes,
            "worstEpisodes": worst_episodes,
            "bestSeasons": [],
            "worstSeasons": [],
            "mostConsistent": []
        }
    
    except Exception as e:
        print(f"Hall of fame error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "success",
            "bestEpisodes": [],
            "worstEpisodes": [],
            "bestSeasons": [],
            "worstSeasons": [],
            "mostConsistent": []
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
