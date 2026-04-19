from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import pandas as pd
import json
import requests
from bs4 import BeautifulSoup
import time
import random
import re

# Selenium imports
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

app = FastAPI(title="Cinephile TV API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "tv_shows.db"

@app.get("/")
def read_root():
    return {"message": "Welcome to the Cinephile TV API Engine. All systems go."}

# =======================
# TOP 250
# =======================
@app.get("/api/top250")
def get_top_250():
    conn = sqlite3.connect(DB_FILE)
    sql = """
        SELECT s.tconst, s.primaryTitle, s.startYear, s.endYear, s.numVotes, s.genres, r.averageRating 
        FROM shows s 
        JOIN ratings r ON s.tconst = r.tconst 
        WHERE s.numVotes > 50000 
        ORDER BY r.averageRating DESC, s.numVotes DESC 
        LIMIT 250
    """
    try: 
        df = pd.read_sql_query(sql, conn)
        return {"status": "success", "data": df.to_dict(orient="records")}
    except Exception as e: 
        return {"status": "error", "message": str(e)}
    finally: 
        conn.close()

# =======================
# SEARCH
# =======================
@app.get("/api/search")
def search_shows(q: str):
    conn = sqlite3.connect(DB_FILE)
    words = q.split()
    where_clause = " AND ".join(["s.primaryTitle LIKE ?" for _ in words])
    params = [f"%{p}%" for p in words]
    
    sql = f"""
        SELECT s.tconst, s.primaryTitle, s.startYear, s.endYear, s.numVotes, s.genres, r.averageRating 
        FROM shows s
        LEFT JOIN ratings r ON s.tconst = r.tconst 
        WHERE {where_clause} 
        ORDER BY s.numVotes DESC 
        LIMIT 15
    """
    try: 
        df = pd.read_sql_query(sql, conn, params=params)
        return {"status": "success", "data": df.to_dict(orient="records")}
    except Exception as e: 
        return {"status": "error", "message": str(e)}
    finally: 
        conn.close()

# =======================
# SHOW DETAILS
# =======================
@app.get("/api/show/{tconst}")
def get_show(tconst: str):
    conn = sqlite3.connect(DB_FILE)
    sql = """
        SELECT s.tconst, s.primaryTitle, s.startYear, s.endYear, s.numVotes, s.genres, r.averageRating 
        FROM shows s 
        LEFT JOIN ratings r ON s.tconst = r.tconst 
        WHERE s.tconst = ?
        LIMIT 1
    """
    try:
        df = pd.read_sql_query(sql, conn, params=(tconst,))
        if df.empty:
            return {"status": "error", "message": "Show not found"}
        return {"status": "success", "data": df.to_dict(orient="records")[0]}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

# =======================
# HEATMAP (WITH SELENIUM FOR LIVE MODE)
# =======================
@app.get("/api/heatmap")
def get_heatmap(id: str, mode: str = "db"):
    
    # ─── DATABASE MODE ───────────────────────────────────────────────
    if mode == "db":
        conn = sqlite3.connect(DB_FILE)
        sql = """
            SELECT e.tconst as ep_tconst, e.seasonNumber, e.episodeNumber, e.primaryTitle, r.averageRating
            FROM episodes e
            LEFT JOIN ratings r ON e.tconst = r.tconst
            WHERE e.parentTconst = ? AND e.seasonNumber > 0
            ORDER BY e.seasonNumber, e.episodeNumber
        """
        try:
            df = pd.read_sql_query(sql, conn, params=(id,))
            if df.empty:
                return {"status": "error", "message": "No data found in local database."}
            
            seasons_data = {}
            for _, row in df.iterrows():
                season = str(int(row['seasonNumber']))
                if season not in seasons_data:
                    seasons_data[season] = []
                
                seasons_data[season].append({
                    "episode": int(row['episodeNumber']),
                    "title": str(row['primaryTitle']) if pd.notna(row['primaryTitle']) else f"Episode {int(row['episodeNumber'])}",
                    "rating": float(row['averageRating']) if pd.notna(row['averageRating']) else 0.0,
                    "ep_tconst": str(row['ep_tconst']) if pd.notna(row['ep_tconst']) else ""
                })
            
            return {"status": "success", "data": seasons_data, "source": "database"}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            conn.close()
    
    # ─── LIVE MODE (SELENIUM) ────────────────────────────────────────
    elif mode == "live":
        print(f"\n{'='*60}")
        print(f"🔴 LIVE SCRAPE: {id}")
        print(f"{'='*60}\n")
        
        # Configure Selenium
        options = Options()
        options.binary_location = r"C:\Users\SUB-ZERO\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe"
        options.add_argument("--headless")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--no-sandbox")
        options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        driver = None
        seasons_data = {}
        
        try:
            driver = webdriver.Chrome(options=options)
            
            # Get season count from database
            conn = sqlite3.connect(DB_FILE)
            try:
                df_eps = pd.read_sql_query(
                    "SELECT MAX(seasonNumber) as max_s FROM episodes WHERE parentTconst=?",
                    conn, params=(id,)
                )
                num_seasons = int(df_eps['max_s'].iloc[0]) if pd.notna(df_eps['max_s'].iloc[0]) else 10
            except:
                num_seasons = 10
            finally:
                conn.close()
            
            num_seasons = min(num_seasons, 20)  # Cap at 20 seasons
            print(f"📊 Will scrape {num_seasons} seasons\n")
            
            # Scrape each season
            for s in range(1, num_seasons + 1):
                url = f"https://www.imdb.com/title/{id}/episodes/?season={s}"
                print(f"[S{s}] Loading {url}")
                
                try:
                    driver.get(url)
                    time.sleep(random.uniform(2.5, 4))  # Wait for JavaScript to load
                    
                    soup = BeautifulSoup(driver.page_source, "html.parser")
                    season_episodes = []
                    
                    # ═══ METHOD 1: Try __NEXT_DATA__ JSON (MOST RELIABLE) ═══
                    next_data_tag = soup.find("script", id="__NEXT_DATA__")
                    if next_data_tag:
                        try:
                            print(f"[S{s}] Found __NEXT_DATA__, parsing JSON...")
                            next_data = json.loads(next_data_tag.string)
                            
                            # Navigate the JSON structure
                            page_props = next_data.get("props", {}).get("pageProps", {})
                            content_data = page_props.get("contentData", {})
                            section = content_data.get("section", {})
                            episodes_list = section.get("episodes", {}).get("items", [])
                            
                            print(f"[S{s}] Found {len(episodes_list)} episodes in JSON")
                            
                            for ep_data in episodes_list:
                                try:
                                    ep_num = ep_data.get("episodeNumber")
                                    title_data = ep_data.get("titleText", {})
                                    title = title_data.get("text", f"Episode {ep_num}")
                                    
                                    # Get rating
                                    rating_data = ep_data.get("ratingsSummary", {})
                                    rating = rating_data.get("aggregateRating")
                                    
                                    # Get tconst
                                    ep_tconst = ep_data.get("id", "")
                                    
                                    if ep_num and rating:
                                        season_episodes.append({
                                            "episode": int(ep_num),
                                            "title": str(title),
                                            "rating": float(rating),
                                            "ep_tconst": str(ep_tconst)
                                        })
                                except Exception as e:
                                    print(f"[S{s}] Error parsing episode: {e}")
                                    continue
                        
                        except json.JSONDecodeError as e:
                            print(f"[S{s}] JSON parse error: {e}")
                    
                    # ═══ METHOD 2: Fallback to HTML scraping ═══
                    if not season_episodes:
                        print(f"[S{s}] Trying HTML scraping fallback...")
                        
                        # Try different selectors
                        episodes = soup.find_all("article", class_=lambda x: x and "episode" in str(x).lower())
                        if not episodes:
                            episodes = soup.find_all("div", attrs={"data-testid": lambda x: x and "episodes-browse-episode" in str(x)})
                        if not episodes:
                            episodes = soup.find_all("div", class_=lambda x: x and "ipc-" in str(x) and "episode" in str(x).lower())
                        
                        print(f"[S{s}] Found {len(episodes)} episode containers")
                        
                        for ep in episodes:
                            try:
                                # Find rating
                                rating_tag = ep.find(class_=re.compile(r'ipc-rating-star|ratingGroup'))
                                if not rating_tag:
                                    continue
                                
                                rating_match = re.search(r'(\d+\.\d+)', rating_tag.get_text())
                                if not rating_match:
                                    continue
                                
                                rating = float(rating_match.group(1))
                                
                                # Find title
                                title_tag = ep.find(class_=re.compile(r'ipc-title__text'))
                                if not title_tag:
                                    title_tag = ep.find("h4") or ep.find("h3")
                                if not title_tag:
                                    continue
                                
                                text = title_tag.get_text().strip()
                                
                                # Extract episode number and title
                                match = re.search(r'[SE]?\d*\.?[Ee](\d+).*?[∙\-:•]\s*(.*)', text)
                                if match:
                                    ep_num = int(match.group(1))
                                    title = match.group(2).strip()
                                else:
                                    match2 = re.search(r'^(\d+)\.\s*(.*)', text)
                                    if match2:
                                        ep_num = int(match2.group(1))
                                        title = match2.group(2).strip()
                                    else:
                                        continue
                                
                                # Try to find tconst
                                link_tag = ep.find('a', href=re.compile(r'/title/tt\d+'))
                                ep_tconst = ""
                                if link_tag and link_tag.get('href'):
                                    tconst_match = re.search(r'/title/(tt\d+)', link_tag['href'])
                                    if tconst_match:
                                        ep_tconst = tconst_match.group(1)
                                
                                season_episodes.append({
                                    "episode": ep_num,
                                    "title": title,
                                    "rating": rating,
                                    "ep_tconst": ep_tconst
                                })
                                
                            except Exception as e:
                                continue
                    
                    if season_episodes:
                        season_episodes.sort(key=lambda x: x['episode'])
                        seasons_data[str(s)] = season_episodes
                        print(f"[S{s}] ✓ Scraped {len(season_episodes)} episodes")
                    else:
                        print(f"[S{s}] ✗ No episodes found - season may not exist")
                
                except Exception as e:
                    print(f"[S{s}] ✗ Error: {e}")
                    continue
            
            print(f"\n{'='*60}")
            print(f"✓ COMPLETE: Scraped {len(seasons_data)} seasons")
            print(f"{'='*60}\n")
            
            if seasons_data:
                return {
                    "status": "success",
                    "data": seasons_data,
                    "source": "selenium_live",
                    "scraped_seasons": len(seasons_data)
                }
            else:
                return {
                    "status": "error",
                    "message": "No episodes found. Try using database mode or check if the show has episode data."
                }
        
        except Exception as e:
            print(f"✗ FATAL ERROR: {e}")
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "message": f"Selenium error: {str(e)}"
            }
        
        finally:
            if driver:
                driver.quit()
                print("🛑 Browser closed\n")

# =======================
# ✅ RECOMMENDATIONS
# =======================
@app.get("/api/recommendations")
def get_recommendations(id: str):
    conn = sqlite3.connect(DB_FILE)
    try:
        target_show = pd.read_sql_query("SELECT genres FROM shows WHERE tconst = ?", conn, params=(id,))
        if target_show.empty or pd.isna(target_show.iloc[0]['genres']) or target_show.iloc[0]['genres'] == "Unknown":
            return {"status": "success", "data": []}

        genres_str = target_show.iloc[0]['genres']
        main_genre = genres_str.split(',')[0].strip()
        target_genres = set([g.strip() for g in genres_str.split(',')])

        sql = """
            SELECT s.tconst, s.primaryTitle, s.startYear, s.endYear, s.numVotes, s.genres, r.averageRating
            FROM shows s
            JOIN ratings r ON s.tconst = r.tconst
            WHERE s.genres LIKE ? AND s.tconst != ?
            ORDER BY s.numVotes DESC
            LIMIT 200
        """
        df = pd.read_sql_query(sql, conn, params=[f"%{main_genre}%", id])

        if not df.empty:
            df['match_score'] = df['genres'].apply(lambda x: len(set([g.strip() for g in str(x).split(',')]) & target_genres))
            df = df.sort_values(by=['match_score', 'numVotes'], ascending=[False, False]).head(12)
            return {"status": "success", "data": df.to_dict(orient="records")}

        return {"status": "success", "data": []}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

# =======================
# ✅ HALL OF FAME
# =======================
@app.get("/api/hall-of-fame")
def get_hall_of_fame():
    conn = sqlite3.connect(DB_FILE)
    try:
        cols = pd.read_sql_query("PRAGMA table_info(ratings)", conn)
        has_ep_votes = 'numVotes' in cols['name'].values
        ep_vote_filter = "AND r.numVotes >= 2000" if has_ep_votes else ""

        best_eps_raw = pd.read_sql_query(f"""
            SELECT e.tconst as ep_tconst, e.primaryTitle as epTitle,
                   e.seasonNumber, e.episodeNumber,
                   r.averageRating,
                   {'r.numVotes as epVotes,' if has_ep_votes else '0 as epVotes,'}
                   s.tconst as showTconst, s.primaryTitle as showTitle,
                   s.startYear, s.numVotes as showVotes, s.averageRating as showRating
            FROM episodes e
            JOIN ratings r ON e.tconst = r.tconst
            JOIN shows s ON e.parentTconst = s.tconst
            WHERE s.numVotes >= 100000
              AND e.seasonNumber > 0 AND e.episodeNumber > 0
              AND r.averageRating IS NOT NULL
              {ep_vote_filter}
            ORDER BY r.averageRating DESC, s.numVotes DESC
            LIMIT 300
        """, conn)

        seen: dict = {}
        best_eps_list = []
        for _, row in best_eps_raw.iterrows():
            k = row['showTconst']
            if seen.get(k, 0) < 2:
                best_eps_list.append(row.to_dict())
                seen[k] = seen.get(k, 0) + 1
            if len(best_eps_list) >= 25: break
        best_eps = pd.DataFrame(best_eps_list) if best_eps_list else pd.DataFrame()

        worst_eps_raw = pd.read_sql_query(f"""
            SELECT e.tconst as ep_tconst, e.primaryTitle as epTitle,
                   e.seasonNumber, e.episodeNumber,
                   r.averageRating,
                   {'r.numVotes as epVotes,' if has_ep_votes else '0 as epVotes,'}
                   s.tconst as showTconst, s.primaryTitle as showTitle,
                   s.startYear, s.numVotes as showVotes, s.averageRating as showRating
            FROM episodes e
            JOIN ratings r ON e.tconst = r.tconst
            JOIN shows s ON e.parentTconst = s.tconst
            WHERE s.numVotes >= 100000
              AND e.seasonNumber > 0 AND e.episodeNumber > 0
              AND r.averageRating IS NOT NULL
              {ep_vote_filter}
            ORDER BY r.averageRating ASC, s.numVotes DESC
            LIMIT 300
        """, conn)

        seen = {}
        worst_eps_list = []
        for _, row in worst_eps_raw.iterrows():
            k = row['showTconst']
            if seen.get(k, 0) < 2:
                worst_eps_list.append(row.to_dict())
                seen[k] = seen.get(k, 0) + 1
            if len(worst_eps_list) >= 25: break
        worst_eps = pd.DataFrame(worst_eps_list) if worst_eps_list else pd.DataFrame()

        best_seasons = pd.read_sql_query("""
            SELECT s.tconst as showTconst, s.primaryTitle as showTitle,
                   s.startYear, s.averageRating as showRating, s.numVotes as showVotes,
                   e.seasonNumber,
                   ROUND(AVG(r.averageRating), 2) as seasonAvg,
                   COUNT(r.averageRating) as ratedEps
            FROM episodes e
            JOIN ratings r ON e.tconst = r.tconst
            JOIN shows s ON e.parentTconst = s.tconst
            WHERE s.numVotes >= 100000 AND e.seasonNumber > 0
              AND r.averageRating IS NOT NULL
            GROUP BY s.tconst, e.seasonNumber
            HAVING ratedEps >= 5
            ORDER BY seasonAvg DESC, s.numVotes DESC
            LIMIT 25
        """, conn)

        worst_seasons = pd.read_sql_query("""
            SELECT s.tconst as showTconst, s.primaryTitle as showTitle,
                   s.startYear, s.averageRating as showRating, s.numVotes as showVotes,
                   e.seasonNumber,
                   ROUND(AVG(r.averageRating), 2) as seasonAvg,
                   COUNT(r.averageRating) as ratedEps
            FROM episodes e
            JOIN ratings r ON e.tconst = r.tconst
            JOIN shows s ON e.parentTconst = s.tconst
            WHERE s.numVotes >= 100000 AND e.seasonNumber > 0
              AND r.averageRating IS NOT NULL
            GROUP BY s.tconst, e.seasonNumber
            HAVING ratedEps >= 5
            ORDER BY seasonAvg ASC, s.numVotes DESC
            LIMIT 25
        """, conn)

        consistent = pd.read_sql_query("""
            SELECT s.tconst as showTconst, s.primaryTitle as showTitle,
                   s.startYear, s.averageRating as showRating, s.numVotes as showVotes,
                   COUNT(r.averageRating) as ratedEps,
                   ROUND(AVG(r.averageRating), 2) as avgRating,
                   ROUND(AVG((r.averageRating - sub.mean) * (r.averageRating - sub.mean)), 4) as variance
            FROM episodes e
            JOIN ratings r ON e.tconst = r.tconst
            JOIN shows s ON e.parentTconst = s.tconst
            JOIN (
                SELECT e2.parentTconst, AVG(r2.averageRating) as mean
                FROM episodes e2 JOIN ratings r2 ON e2.tconst = r2.tconst
                GROUP BY e2.parentTconst
            ) sub ON sub.parentTconst = s.tconst
            WHERE s.numVotes >= 100000 AND e.seasonNumber > 0
              AND r.averageRating IS NOT NULL
            GROUP BY s.tconst
            HAVING ratedEps >= 15 AND avgRating >= 8.0
            ORDER BY variance ASC, avgRating DESC
            LIMIT 25
        """, conn)

        def clean(records):
            out = []
            for row in records:
                clean_row = {}
                for k, v in row.items():
                    if hasattr(v, 'item'): 
                        clean_row[k] = v.item()
                    else: 
                        clean_row[k] = v
                out.append(clean_row)
            return out

        return {
            "status": "success",
            "bestEpisodes":   clean(best_eps.to_dict(orient="records")) if not best_eps.empty else [],
            "worstEpisodes":  clean(worst_eps.to_dict(orient="records")) if not worst_eps.empty else [],
            "bestSeasons":    clean(best_seasons.to_dict(orient="records")),
            "worstSeasons":   clean(worst_seasons.to_dict(orient="records")),
            "mostConsistent": clean(consistent.to_dict(orient="records")),
        }
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "trace": traceback.format_exc()}
    finally:
        conn.close()