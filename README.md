# 🎬 Cinephile TV

> **A comprehensive TV show analytics platform powered by IMDb data, featuring advanced episode heatmaps, intelligent recommendations, and a Hall of Fame for the greatest and worst moments in television history.**

[![Live Demo](https://img.shields.io/badge/demo-live-success?style=for-the-badge)](https://cinephile-tv.vercel.app)
[![API Status](https://img.shields.io/badge/API-online-success?style=for-the-badge)](https://cinephile-tv-production.up.railway.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-316192?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

---

## 📊 **Database Scale**

```
4,601 TV Shows  •  406,782 Episodes  •  1,645,145 Ratings
```

**Last Updated**: May 2026 | **Data Source**: IMDb Non-Commercial Datasets

---

## ✨ **Features**

### 🏆 **Top 250 Shows**
Discover the highest-rated TV shows of all time, ranked by IMDb's weighted rating algorithm with vote count thresholds for statistical significance.

### 🔍 **Advanced Search**
Lightning-fast full-text search across all show titles with intelligent ranking based on popularity and relevance.

### 🎯 **Smart Recommendations**
Genre-based recommendation engine that suggests similar shows based on your viewing preferences.

### 🔥 **Episode Heatmaps**
Interactive season-by-season rating visualizations with two modes:
- **Database Mode**: Instant loading from PostgreSQL for 4,600+ shows
- **Live Scraping Mode**: Real-time data fetching for shows not in the database

### 🏅 **Hall of Fame & Shame**
Curated lists of television's finest and most controversial moments:
- **Greatest Episodes**: The highest-rated individual episodes across all TV
- **Worst Episodes**: The most critically panned moments in TV history
- **Best Seasons**: Entire seasons that maintained exceptional quality
- **Worst Seasons**: Seasons that disappointed fans and critics
- **Most Consistent**: Shows that maintained high quality throughout their run

### 📱 **Responsive Design**
Fully optimized for desktop, tablet, and mobile devices with a sleek dark theme.

---

## 🛠️ **Tech Stack**

### **Frontend**
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React Icons
- **Deployment**: Vercel

### **Backend**
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (Supabase)
- **ORM**: Supabase Python Client
- **Web Scraping**: Selenium + BeautifulSoup4
- **Deployment**: Railway

### **Infrastructure**
- **Database Hosting**: Supabase (500MB PostgreSQL)
- **Backend Hosting**: Railway (Auto-deploy from GitHub)
- **Frontend Hosting**: Vercel (Auto-deploy from GitHub)
- **CDN**: Vercel Edge Network

---

## 🏗️ **Architecture**

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Next.js Frontend (Vercel)      │
│  - SSR/SSG Pages                │
│  - Client Components            │
│  - API Route Handlers           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  FastAPI Backend (Railway)      │
│  - RESTful API Endpoints        │
│  - Selenium Scraper             │
│  - Rate Limiting                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  PostgreSQL (Supabase)          │
│  - 3 Tables (shows/episodes/    │
│    ratings)                     │
│  - Custom SQL Functions         │
│  - RLS Policies                 │
└─────────────────────────────────┘
```

---

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ and npm/yarn
- Python 3.10+
- PostgreSQL database (or Supabase account)
- Chrome/Chromium (for scraping)

### **Clone Repository**
```bash
git clone https://github.com/Mohan-wraith/cinephile-tv.git
cd cinephile-tv
```

### **Frontend Setup**

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Run development server**
```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

### **Backend Setup**

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
Create `.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

5. **Run development server**
```bash
uvicorn api:app --reload --port 8000
```

API will be available at `http://localhost:8000`

---

## 📡 **API Documentation**

### **Base URL**
```
Production: https://cinephile-tv-production.up.railway.app
Local: http://localhost:8000
```

### **Endpoints**

#### **GET /api/top250**
Returns top 250 TV shows ranked by IMDb rating.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "tconst": "tt0903747",
      "primaryTitle": "Breaking Bad",
      "startYear": "2008",
      "endYear": "2013",
      "genres": "Crime,Drama,Thriller",
      "averageRating": 9.5,
      "numVotes": 2000000
    }
  ]
}
```

#### **GET /api/search?q={query}**
Search TV shows by title.

**Parameters:**
- `q` (string): Search query

**Response:**
```json
{
  "status": "success",
  "data": [...]
}
```

#### **GET /api/show/{tconst}**
Get detailed information about a specific show.

**Parameters:**
- `tconst` (string): IMDb show ID (e.g., "tt0903747")

**Response:**
```json
{
  "status": "success",
  "data": {
    "tconst": "tt0903747",
    "primaryTitle": "Breaking Bad",
    "startYear": "2008",
    "endYear": "2013",
    "genres": "Crime,Drama,Thriller",
    "averageRating": 9.5,
    "numVotes": 2000000
  }
}
```

#### **GET /api/recommendations?id={tconst}**
Get recommended shows based on genre similarity.

**Parameters:**
- `id` (string): IMDb show ID

**Response:**
```json
{
  "status": "success",
  "data": [...]
}
```

#### **GET /api/heatmap?id={tconst}&mode={mode}**
Get episode ratings for heatmap visualization.

**Parameters:**
- `id` (string): IMDb show ID
- `mode` (string): "db" (database) or "live" (scrape)

**Response:**
```json
{
  "status": "success",
  "data": {
    "1": [
      {
        "episode": 1,
        "title": "Pilot",
        "rating": 8.2,
        "ep_tconst": "tt0959621"
      }
    ]
  },
  "source": "database"
}
```

#### **GET /api/hall-of-fame**
Get curated lists of best/worst episodes and seasons.

**Response:**
```json
{
  "status": "success",
  "bestEpisodes": [...],
  "worstEpisodes": [...],
  "bestSeasons": [...],
  "worstSeasons": [...],
  "mostConsistent": [...]
}
```

---

## 🗄️ **Database Schema**

### **Tables**

#### **shows**
```sql
CREATE TABLE shows (
  tconst TEXT PRIMARY KEY,
  primaryTitle TEXT NOT NULL,
  startYear TEXT,
  endYear TEXT,
  genres TEXT,
  averageRating FLOAT,
  numVotes INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **episodes**
```sql
CREATE TABLE episodes (
  tconst TEXT PRIMARY KEY,
  parentTconst TEXT REFERENCES shows(tconst),
  seasonNumber INT,
  episodeNumber INT,
  primaryTitle TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **ratings**
```sql
CREATE TABLE ratings (
  tconst TEXT PRIMARY KEY,
  averageRating FLOAT,
  numvotes INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **SQL Functions**

#### **get_top_250()**
Returns top 250 shows with minimum vote threshold.

#### **search_shows_by_title(search_query TEXT)**
Full-text search with line-by-line matching.

#### **get_recommendations(show_id TEXT)**
Genre-based recommendation algorithm.

#### **get_show_by_id(show_id TEXT)**
Single show lookup with all metadata.

---

## 🚢 **Deployment**

### **Frontend (Vercel)**

1. Connect GitHub repository to Vercel
2. Configure environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL
3. Deploy from `main` branch
4. Auto-deploys on every push

### **Backend (Railway)**

1. Connect GitHub repository to Railway
2. Configure environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
3. Set start command: `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. Auto-deploys on every push to `main`

### **Database (Supabase)**

1. Create new Supabase project
2. Run SQL schema from `database/schema.sql`
3. Import IMDb data using `scripts/import_data.py`
4. Create SQL functions from `database/functions.sql`

---

## 📊 **Data Pipeline**

### **IMDb Dataset Import**

1. **Download IMDb datasets** (updated daily):
   - `title.basics.tsv.gz`
   - `title.episode.tsv.gz`
   - `title.ratings.tsv.gz`

2. **Process and filter data**:
```bash
python scripts/process_imdb_data.py
```

3. **Import to PostgreSQL**:
```bash
python scripts/import_to_supabase.py
```

### **Scraping Pipeline**

For shows not in the database:
```python
# Selenium headless Chrome scraper
# Extracts data from IMDb's __NEXT_DATA__ JSON
# Rate-limited to avoid IP bans
# Fallback to database mode if scraping fails
```

---

## 🧪 **Testing**

### **Frontend Tests**
```bash
npm test
```

### **Backend Tests**
```bash
pytest backend/tests/
```

### **API Load Testing**
```bash
locust -f backend/tests/load_test.py
```

---

## 🤝 **Contributing**

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### **Code Style**
- **Frontend**: ESLint + Prettier
- **Backend**: Black + Flake8
- **Commits**: Conventional Commits format

---

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **IMDb** for providing non-commercial datasets
- **Supabase** for database hosting
- **Vercel** for frontend hosting
- **Railway** for backend hosting
- **The open-source community** for amazing tools and libraries

---

## 📧 **Contact**

**Project Maintainer**: Mohan Wraith

**Live Demo**: [https://cinephile-tv.vercel.app](https://cinephile-tv.vercel.app)

**API Endpoint**: [https://cinephile-tv-production.up.railway.app](https://cinephile-tv-production.up.railway.app)

---

## 🔮 **Roadmap**

- [ ] User authentication and watchlists
- [ ] Real-time rating updates via WebSocket
- [ ] Advanced filtering (genre, year, network)
- [ ] Episode discussion threads
- [ ] Actor/director database integration
- [ ] Custom user reviews and ratings
- [ ] GraphQL API endpoint
- [ ] Mobile apps (iOS/Android)
- [ ] Browser extension for quick lookups
- [ ] AI-powered recommendation engine

---

<div align="center">

**Made with ❤️ by TV enthusiasts, for TV enthusiasts**

⭐ **Star this repo if you found it helpful!** ⭐

</div>
