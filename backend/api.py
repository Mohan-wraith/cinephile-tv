"""
CINEPHILE TV BACKEND - EXACT COLUMN NAMES FROM SCHEMA
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
import re
from supabase import create_client, Client
import json
import httpx
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup
import time
import random

app = FastAPI(title="Cinephile TV API")

def load_local_env():
    env_paths = [
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]

    for env_path in env_paths:
        if not env_path.exists():
            continue

        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_local_env()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_KEY. Add them to .env, backend/.env, "
        "or your shell environment before starting the API."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_chrome_driver():
    """
    Create and configure Chrome WebDriver for Railway/production environment
    """
    options = Options()
    
    # Essential headless arguments
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-software-rasterizer")
    
    # Performance and stability
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-tools")
    options.add_argument("--disable-web-security")
    options.add_argument("--ignore-certificate-errors")
    
    # User agent to avoid detection
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    # Memory optimization
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--disable-breakpad")
    options.add_argument("--disable-client-side-phishing-detection")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-hang-monitor")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-prompt-on-repost")
    options.add_argument("--disable-sync")
    options.add_argument("--metrics-recording-only")
    options.add_argument("--no-first-run")
    options.add_argument("--safebrowsing-disable-auto-update")
    
    # Try to create driver - let Selenium auto-detect Chrome
    try:
        # In Railway/production, Chrome is at standard location
        driver = webdriver.Chrome(options=options)
        print("[OK] Chrome driver created successfully")
        return driver
    except Exception as e:
        print(f"[ERROR] Chrome driver creation failed: {e}")
        raise

def first_present(*values):
    for value in values:
        if value is not None and value != "":
            return value
    return None

def text_value(value, default=""):
    if isinstance(value, dict):
        return first_present(
            value.get("text"),
            value.get("plainText"),
            value.get("originalText"),
            default
        )
    return value if value is not None else default

def nested_value(data, *keys):
    current = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current

def normalize_imdb_episode(ep_data):
    if not isinstance(ep_data, dict):
        return None

    ep_data = ep_data.get("node", ep_data)
    if not isinstance(ep_data, dict):
        return None

    ep_num = first_present(
        ep_data.get("episodeNumber"),
        ep_data.get("episode"),
        nested_value(ep_data, "episodeNumber", "episodeNumber"),
        nested_value(ep_data, "series", "episodeNumber", "episodeNumber")
    )

    rating = first_present(
        ep_data.get("aggregateRating"),
        nested_value(ep_data, "ratingsSummary", "aggregateRating")
    )

    if not ep_num or rating is None:
        return None

    title = text_value(
        first_present(ep_data.get("titleText"), ep_data.get("title")),
        f"Episode {ep_num}"
    )

    try:
        return {
            "episode": int(ep_num),
            "title": str(title),
            "rating": float(rating),
            "ep_tconst": str(ep_data.get("id", ""))
        }
    except (TypeError, ValueError):
        return None

def normalize_imdb_episode_items(items):
    if isinstance(items, dict):
        if isinstance(items.get("items"), list):
            items = items["items"]
        elif isinstance(items.get("edges"), list):
            items = [edge.get("node") for edge in items["edges"] if isinstance(edge, dict)]
        else:
            items = list(items.values())

    if not isinstance(items, list):
        return []

    episodes = []
    for item in items:
        episode = normalize_imdb_episode(item)
        if episode:
            episodes.append(episode)
    return episodes

OMDB_API_KEY = os.environ.get("OMDB_API_KEY", "trilogy")
OMDB_URL = "https://www.omdbapi.com/"
IMDB_TITLE_RE = re.compile(r"tt\d{7,}")

def clean_value(value, default=None):
    if value in (None, "", "N/A"):
        return default
    return value

def parse_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def parse_int(value, default=0):
    try:
        return int(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return default

def runtime_minutes(value):
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else 0

def split_csv(value):
    if not value or value == "N/A":
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]

def omdb_get(params):
    try:
        with httpx.Client(timeout=12, follow_redirects=True) as client:
            response = client.get(OMDB_URL, params={**params, "apikey": OMDB_API_KEY})
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"Response": "False", "Error": str(e)}

def normalize_movie(data):
    if not data or data.get("Response") == "False":
        return None

    imdb_id = clean_value(data.get("imdbID"))
    title = clean_value(data.get("Title"))
    if not imdb_id or not title:
        return None

    poster = clean_value(data.get("Poster"))
    year = clean_value(data.get("Year"), "")
    rating = parse_float(data.get("imdbRating"))
    votes = parse_int(data.get("imdbVotes"))

    return {
        "tconst": imdb_id,
        "imdbID": imdb_id,
        "contentType": "movie",
        "type": clean_value(data.get("Type"), "movie"),
        "primaryTitle": title,
        "title": title,
        "startYear": str(year).split("-")[0] if year else "",
        "year": year,
        "rated": clean_value(data.get("Rated")),
        "released": clean_value(data.get("Released")),
        "runtime": clean_value(data.get("Runtime")),
        "genres": clean_value(data.get("Genre"), ""),
        "genreList": split_csv(data.get("Genre")),
        "director": clean_value(data.get("Director")),
        "writer": clean_value(data.get("Writer")),
        "actors": clean_value(data.get("Actors")),
        "plot": clean_value(data.get("Plot")),
        "language": clean_value(data.get("Language")),
        "country": clean_value(data.get("Country")),
        "awards": clean_value(data.get("Awards")),
        "poster": poster,
        "averageRating": rating,
        "imdbRating": rating,
        "numVotes": votes,
        "imdbVotes": clean_value(data.get("imdbVotes")),
        "boxOffice": clean_value(data.get("BoxOffice")),
        "production": clean_value(data.get("Production")),
        "metascore": clean_value(data.get("Metascore")),
        "ratings": data.get("Ratings", []),
    }

def fetch_movie_detail(imdb_id):
    return normalize_movie(omdb_get({"i": imdb_id, "plot": "short", "type": "movie"}))

def imdb_more_like_this_ids(imdb_id):
    try:
        with httpx.Client(timeout=14, follow_redirects=True) as client:
            response = client.get(
                f"https://www.imdb.com/title/{imdb_id}/",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            response.raise_for_status()
            html = response.text
    except Exception:
        return []

    ids = []
    lower = html.lower()
    anchors = [
        lower.find("morelikethis"),
        lower.find("more like this"),
        lower.find("recommend"),
        lower.find("similar"),
    ]

    for anchor in [a for a in anchors if a >= 0]:
        segment = html[anchor:anchor + 300000]
        for match in IMDB_TITLE_RE.findall(segment):
            if match != imdb_id and match not in ids:
                ids.append(match)
            if len(ids) >= 18:
                return ids

    return ids

MOVIE_GENRE_SEARCHES = {
    "Action": ["Mad Max Fury Road", "John Wick", "Mission Impossible", "The Dark Knight", "Heat"],
    "Adventure": ["Dune", "Lord of the Rings", "Indiana Jones", "Avatar", "Gladiator"],
    "Animation": ["Spider-Verse", "Toy Story", "How to Train Your Dragon", "WALL-E", "Coco"],
    "Biography": ["Oppenheimer", "The Social Network", "A Beautiful Mind", "The Imitation Game", "Ford v Ferrari"],
    "Comedy": ["The Grand Budapest Hotel", "Superbad", "The Big Lebowski", "Groundhog Day", "Knives Out"],
    "Crime": ["The Departed", "Goodfellas", "Se7en", "Zodiac", "Prisoners"],
    "Drama": ["The Shawshank Redemption", "Forrest Gump", "The Prestige", "Whiplash", "The Social Network"],
    "Fantasy": ["Harry Potter", "Lord of the Rings", "Pan's Labyrinth", "Stardust", "The Green Knight"],
    "Horror": ["Get Out", "Hereditary", "The Conjuring", "A Quiet Place", "The Babadook"],
    "Mystery": ["Knives Out", "Zodiac", "Prisoners", "Gone Girl", "The Girl with the Dragon Tattoo"],
    "Romance": ["La La Land", "Before Sunrise", "Eternal Sunshine", "Pride and Prejudice", "Titanic"],
    "Sci-Fi": ["Interstellar", "The Matrix", "Arrival", "Blade Runner 2049", "Tenet", "Minority Report"],
    "Thriller": ["Shutter Island", "Gone Girl", "Nightcrawler", "Prisoners", "Memento"],
}

MOVIE_CREATOR_SEARCHES = {
    "Christopher Nolan": ["Interstellar", "Tenet", "Memento", "The Prestige", "The Dark Knight"],
    "Denis Villeneuve": ["Arrival", "Blade Runner 2049", "Dune", "Sicario", "Prisoners"],
    "David Fincher": ["Gone Girl", "Zodiac", "Se7en", "Fight Club", "The Social Network"],
    "Martin Scorsese": ["The Departed", "Shutter Island", "Goodfellas", "The Wolf of Wall Street", "Casino"],
    "Quentin Tarantino": ["Pulp Fiction", "Django Unchained", "Kill Bill", "Inglourious Basterds", "Reservoir Dogs"],
    "Steven Spielberg": ["Jurassic Park", "Saving Private Ryan", "Minority Report", "Catch Me If You Can", "Raiders of the Lost Ark"],
    "Leonardo DiCaprio": ["Shutter Island", "The Departed", "The Wolf of Wall Street", "Django Unchained", "Catch Me If You Can"],
    "Christian Bale": ["The Dark Knight", "The Prestige", "American Psycho", "Ford v Ferrari", "The Big Short"],
    "Tom Hardy": ["Mad Max Fury Road", "The Dark Knight Rises", "Warrior", "Legend", "Dunkirk"],
    "Ryan Gosling": ["Blade Runner 2049", "Drive", "La La Land", "The Nice Guys", "First Man"],
}

def score_movie_similarity(source, candidate):
    source_genres = set(source.get("genreList") or split_csv(source.get("genres")))
    candidate_genres = set(candidate.get("genreList") or split_csv(candidate.get("genres")))
    overlap = source_genres & candidate_genres
    union = source_genres | candidate_genres
    if not overlap:
        return 0

    score = (len(overlap) / max(1, len(union))) * 70

    source_year = parse_int(source.get("startYear"))
    candidate_year = parse_int(candidate.get("startYear"))
    if source_year and candidate_year:
        distance = abs(source_year - candidate_year)
        score += max(0, 18 - min(distance, 18))

    source_rating = parse_float(source.get("averageRating"))
    candidate_rating = parse_float(candidate.get("averageRating"))
    if source_rating and candidate_rating:
        score += max(0, 8 - abs(source_rating - candidate_rating) * 2)

    votes = parse_int(candidate.get("numVotes"))
    if votes >= 250000:
        score += 6
    elif votes >= 50000:
        score += 3

    source_directors = set(split_csv(source.get("director")))
    candidate_directors = set(split_csv(candidate.get("director")))
    if source_directors and source_directors & candidate_directors:
        score += 40

    source_actors = set(split_csv(source.get("actors"))[:4])
    candidate_actors = set(split_csv(candidate.get("actors"))[:4])
    score += len(source_actors & candidate_actors) * 7

    return score

def fallback_movie_candidates(source):
    queries = []
    for creator in split_csv(source.get("director"))[:2] + split_csv(source.get("actors"))[:3]:
        queries.extend(MOVIE_CREATOR_SEARCHES.get(creator, []))

    for genre in source.get("genreList", [])[:3]:
        queries.extend(MOVIE_GENRE_SEARCHES.get(genre, []))

    title_words = [
        word for word in re.findall(r"[A-Za-z0-9]+", source.get("title", ""))
        if len(word) > 3 and word.lower() not in {"movie", "film", "part", "chapter"}
    ]
    queries.extend(title_words[:2])

    candidates = {}
    seen_queries = []
    for query in queries:
        if query and query not in seen_queries:
            seen_queries.append(query)

    for query in seen_queries[:16]:
        result = omdb_get({"s": query, "type": "movie"})
        for item in result.get("Search", [])[:4]:
            imdb_id = item.get("imdbID")
            if not imdb_id or imdb_id == source.get("imdbID") or imdb_id in candidates:
                continue
            detail = fetch_movie_detail(imdb_id)
            if detail and runtime_minutes(detail.get("runtime")) >= 60:
                candidates[imdb_id] = detail

    return list(candidates.values())

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

@app.get("/api/movie/search")
def search_movies(q: str):
    if not q or len(q.strip()) < 2:
        return {"status": "success", "data": []}

    result = omdb_get({"s": q.strip(), "type": "movie"})
    if result.get("Response") == "False":
        return {"status": "success", "data": []}

    movies = []
    for item in result.get("Search", [])[:8]:
        imdb_id = item.get("imdbID")
        detail = fetch_movie_detail(imdb_id) if imdb_id else None
        if detail:
            movies.append(detail)
        elif imdb_id:
            movies.append({
                "tconst": imdb_id,
                "imdbID": imdb_id,
                "contentType": "movie",
                "type": "movie",
                "primaryTitle": item.get("Title", ""),
                "title": item.get("Title", ""),
                "startYear": str(item.get("Year", "")).split("-")[0],
                "year": item.get("Year", ""),
                "genres": "",
                "genreList": [],
                "averageRating": 0,
                "imdbRating": 0,
                "numVotes": 0,
                "poster": clean_value(item.get("Poster")),
                "boxOffice": None,
            })

    return {"status": "success", "data": movies}

@app.get("/api/movie/{imdb_id}")
def get_movie(imdb_id: str):
    movie = fetch_movie_detail(imdb_id)
    if not movie:
        return {"status": "error", "message": "Movie not found"}
    return {"status": "success", "data": movie}

@app.get("/api/movie/recommendations")
def get_movie_recommendations(id: str):
    source = fetch_movie_detail(id)
    if not source:
        return {"status": "success", "data": []}

    candidates = {}
    for rec_id in imdb_more_like_this_ids(id):
        detail = fetch_movie_detail(rec_id)
        if detail and detail.get("type") == "movie":
            candidates[detail["imdbID"]] = detail
        if len(candidates) >= 18:
            break

    if len(candidates) < 8:
        for detail in fallback_movie_candidates(source):
            candidates.setdefault(detail["imdbID"], detail)

    scored = []
    for candidate in candidates.values():
        if candidate.get("imdbID") == id:
            continue
        score = score_movie_similarity(source, candidate)
        if score > 0:
            scored.append((score, candidate))

    scored.sort(
        key=lambda item: (
            item[0],
            parse_float(item[1].get("averageRating")),
            parse_int(item[1].get("numVotes")),
        ),
        reverse=True,
    )

    return {"status": "success", "data": [item[1] for item in scored[:12]]}

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
        response = supabase.rpc(
            'get_recommendations',
            {'show_id': id},
        ).execute()
        return {"status": "success", "data": response.data or []}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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
        print(f"\n{'='*60}\nLIVE SCRAPE: {id}\n{'='*60}\n")

        driver = None
        seasons_data = {}

        try:
            # Create Chrome driver using our helper function
            driver = get_chrome_driver()

            # Determine number of seasons to scrape
            try:
                response = supabase.table('episodes').select(
                    'seasonNumber'
                ).eq(
                    'parentTconst',
                    id
                ).order(
                    'seasonNumber',
                    desc=True
                ).limit(1).execute()

                num_seasons = int(
                    response.data[0]['seasonNumber']
                ) if response.data else 10

            except:
                num_seasons = 10

            num_seasons = min(num_seasons, 20)
            print(f"Scraping {num_seasons} seasons...")

            for s in range(1, num_seasons + 1):
                url = f"https://www.imdb.com/title/{id}/episodes/?season={s}"
                print(f"[Season {s}] Fetching: {url}")

                try:
                    driver.get(url)
                    
                    # Wait for page to load
                    time.sleep(random.uniform(2.5, 4))

                    soup = BeautifulSoup(driver.page_source, "html.parser")
                    season_episodes = []

                    # Find the __NEXT_DATA__ script tag
                    next_data_tag = soup.find("script", id="__NEXT_DATA__")

                    if next_data_tag:
                        next_data = json.loads(next_data_tag.string)

                        page_props = next_data.get("props", {}).get("pageProps", {})
                        episodes_list = page_props.get("contentData", {}).get("section", {}).get("episodes", {}).get("items", [])
                        season_episodes = normalize_imdb_episode_items(episodes_list)

                    if season_episodes:
                        season_episodes.sort(key=lambda x: x['episode'])
                        seasons_data[str(s)] = season_episodes
                        print(f"[Season {s}] Found {len(season_episodes)} episodes")
                    else:
                        print(f"[Season {s}] No episodes found")

                except Exception as e:
                    print(f"[Season {s}] Error: {e}")
                    continue

            if seasons_data:
                return {
                    "status": "success",
                    "data": seasons_data,
                    "source": "selenium_live",
                    "scraped_seasons": len(seasons_data)
                }

            return {
                "status": "error",
                "message": "No episodes found during scraping."
            }

        except Exception as e:
            print(f"Selenium error: {str(e)}")
            import traceback
            traceback.print_exc()
            
            return {
                "status": "error",
                "message": f"Selenium error: {str(e)}. Try using 'db' mode instead."
            }

        finally:
            if driver:
                try:
                    driver.quit()
                    print("[OK] Chrome driver closed")
                except Exception as e:
                    print(f"Error closing driver: {e}")

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
