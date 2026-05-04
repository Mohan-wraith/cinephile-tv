"""
CINEPHILE TV BACKEND - LOWERCASE COLUMN FIX
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from supabase import create_client, Client
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
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
            response = supabase.table('shows').select('*').gte('numvotes', 50000).order('averagerating', desc=True).limit(250).execute()
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
            response = supabase.table('shows').select('*').ilike('primarytitle', f'%{q}%').order('numvotes', desc=True).limit(15).execute()
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
            response = supabase.table('shows').select('*').ilike('genres', f'%{main_genre}%').neq('tconst', id).order('numvotes', desc=True).limit(12).execute()
            return {"status": "success", "data": response.data}
        except Exception as e2:
            return {"status": "error", "message": str(e2)}

@app.get("/api/heatmap")
def get_heatmap(id: str, mode: str = "db"):
    if mode == "db":
        try:
            ep_response = supabase.table('episodes').select('tconst, seasonnumber, episodenumber, primarytitle').eq('parenttconst', id).gt('seasonnumber', 0).order('seasonnumber').order('episodenumber').execute()
            if not ep_response.data:
                return {"status": "error", "message": "No data found in database."}
            episodes = ep_response.data
            episode_ids = [ep['tconst'] for ep in episodes]
            ratings_response = supabase.table('ratings').select('*').in_('tconst', episode_ids).execute()
            ratings_map = {r['tconst']: r for r in ratings_response.data}
            seasons_data = {}
            for ep in episodes:
                season = str(int(ep['seasonnumber']))
                if season not in seasons_data:
                    seasons_data[season] = []
                rating_data = ratings_map.get(ep['tconst'], {})
                seasons_data[season].append({"episode": int(ep['episodenumber']), "title": ep['primarytitle'] or f"Episode {ep['episodenumber']}", "rating": rating_data.get('averagerating', 0), "ep_tconst": ep['tconst']})
            return {"status": "success", "data": seasons_data, "source": "database"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    elif mode == "live":
        print(f"\n{'='*60}\n🔴 LIVE SCRAPE: {id}\n{'='*60}\n")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        driver = None
        seasons_data = {}
        try:
            driver = webdriver.Chrome(options=options)
            try:
                response = supabase.table('episodes').select('seasonnumber').eq('parenttconst', id).order('seasonnumber', desc=True).limit(1).execute()
                num_seasons = int(response.data[0]['seasonnumber']) if response.data else 10
            except:
                num_seasons = 10
            num_seasons = min(num_seasons, 20)
            print(f"📊 Will scrape {num_seasons} seasons\n")
            for s in range(1, num_seasons + 1):
                url = f"https://www.imdb.com/title/{id}/episodes/?season={s}"
                print(f"[S{s}] Loading {url}")
                try:
                    driver.get(url)
                    time.sleep(random.uniform(2.5, 4))
                    soup = BeautifulSoup(driver.page_source, "html.parser")
                    season_episodes = []
                    next_data_tag = soup.find("script", id="__NEXT_DATA__")
                    if next_data_tag:
                        try:
                            next_data = json.loads(next_data_tag.string)
                            page_props = next_data.get("props", {}).get("pageProps", {})
                            episodes_list = page_props.get("contentData", {}).get("section", {}).get("episodes", {}).get("items", [])
                            for ep_data in episodes_list:
                                ep_num = ep_data.get("episodeNumber")
                                title_data = ep_data.get("titleText", {})
                                title = title_data.get("text", f"Episode {ep_num}")
                                rating_data = ep_data.get("ratingsSummary", {})
                                rating = rating_data.get("aggregateRating")
                                ep_tconst = ep_data.get("id", "")
                                if ep_num and rating:
                                    season_episodes.append({"episode": int(ep_num), "title": str(title), "rating": float(rating), "ep_tconst": str(ep_tconst)})
                        except Exception as e:
                            print(f"[S{s}] JSON parse error: {e}")
                    if season_episodes:
                        season_episodes.sort(key=lambda x: x['episode'])
                        seasons_data[str(s)] = season_episodes
                        print(f"[S{s}] ✓ Scraped {len(season_episodes)} episodes")
                    else:
                        print(f"[S{s}] ✗ No episodes found")
                except Exception as e:
                    print(f"[S{s}] ✗ Error: {e}")
                    continue
            print(f"\n{'='*60}\n✓ COMPLETE: Scraped {len(seasons_data)} seasons\n{'='*60}\n")
            if seasons_data:
                return {"status": "success", "data": seasons_data, "source": "selenium_live", "scraped_seasons": len(seasons_data)}
            else:
                return {"status": "error", "message": "No episodes found."}
        except Exception as e:
            print(f"✗ FATAL ERROR: {e}")
            return {"status": "error", "message": f"Selenium error: {str(e)}"}
        finally:
            if driver:
                driver.quit()

@app.get("/api/hall-of-fame")
def get_hall_of_fame():
    try:
        # Get best episodes - USING LOWERCASE COLUMN NAMES
        ratings_resp = supabase.table('ratings').select('*').gte('numvotes', 1000).order('averagerating', desc=True).limit(25).execute()
        best_episodes = []
        
        for r in ratings_resp.data:
            try:
                ep = supabase.table('episodes').select('*').eq('tconst', r['tconst']).limit(1).execute()
                if not ep.data:
                    continue
                ep_data = ep.data[0]
                show = supabase.table('shows').select('*').eq('tconst', ep_data.get('parenttconst')).limit(1).execute()
                if not show.data:
                    continue
                show_data = show.data[0]
                best_episodes.append({
                    'tconst': r['tconst'],
                    'averageRating': r.get('averagerating', 0),
                    'numVotes': r.get('numvotes', 0),
                    'showTconst': ep_data.get('parenttconst'),
                    'seasonNumber': ep_data.get('seasonnumber', 0),
                    'episodeNumber': ep_data.get('episodenumber', 0),
                    'epTitle': ep_data.get('primarytitle', ''),
                    'showTitle': show_data.get('primarytitle', ''),
                    'startYear': show_data.get('startyear', ''),
                    'showVotes': show_data.get('numvotes', 0)
                })
            except Exception as e:
                print(f"Error processing episode {r.get('tconst')}: {e}")
                continue
        
        # Get worst episodes - USING LOWERCASE COLUMN NAMES
        worst_ratings_resp = supabase.table('ratings').select('*').gte('numvotes', 1000).order('averagerating', desc=False).limit(25).execute()
        worst_episodes = []
        
        for r in worst_ratings_resp.data:
            try:
                ep = supabase.table('episodes').select('*').eq('tconst', r['tconst']).limit(1).execute()
                if not ep.data:
                    continue
                ep_data = ep.data[0]
                show = supabase.table('shows').select('*').eq('tconst', ep_data.get('parenttconst')).limit(1).execute()
                if not show.data:
                    continue
                show_data = show.data[0]
                worst_episodes.append({
                    'tconst': r['tconst'],
                    'averageRating': r.get('averagerating', 0),
                    'numVotes': r.get('numvotes', 0),
                    'showTconst': ep_data.get('parenttconst'),
                    'seasonNumber': ep_data.get('seasonnumber', 0),
                    'episodeNumber': ep_data.get('episodenumber', 0),
                    'epTitle': ep_data.get('primarytitle', ''),
                    'showTitle': show_data.get('primarytitle', ''),
                    'startYear': show_data.get('startyear', ''),
                    'showVotes': show_data.get('numvotes', 0)
                })
            except Exception as e:
                print(f"Error processing worst episode {r.get('tconst')}: {e}")
                continue
        
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
        return {"status": "success", "bestEpisodes": [], "worstEpisodes": [], "bestSeasons": [], "worstSeasons": [], "mostConsistent": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)