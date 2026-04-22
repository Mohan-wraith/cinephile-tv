'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X, ChevronDown, RotateCcw, Trophy, BarChart2, Bookmark, Plus, Check } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';

interface Show {
  tconst: string;
  primaryTitle: string;
  startYear: string;
  endYear: string;
  numVotes: number;
  genres: string;
  averageRating: number;
}
interface ShowWithPoster extends Show {
  poster: string | null;
  posterLoaded: boolean;
}

// Fetch poster for grid cards (sequential, batched — quality over speed)
async function fetchPoster(tconst: string, title: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${tconst}`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const d = await r.json(); const img = d?.image?.original || d?.image?.medium; if (img) return img; }
  } catch {}
  try {
    const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const results = await r.json(); if (results?.length > 0) { const img = results[0]?.show?.image?.original || results[0]?.show?.image?.medium; if (img) return img; } }
  } catch {}
  try {
    const r = await fetch(`https://www.omdbapi.com/?i=${tconst}&apikey=trilogy`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const d = await r.json(); if (d?.Poster && d.Poster !== 'N/A') return d.Poster; }
  } catch {}
  return null;
}

// Fast parallel poster fetch for search dropdown — races all 3 sources simultaneously
async function fetchPosterFast(tconst: string, title: string): Promise<string | null> {
  const tryFetch = async (url: string, extract: (d: any) => string | null): Promise<string | null> => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return null;
      const d = await r.json();
      return extract(d);
    } catch { return null; }
  };

  // Race all three sources in parallel — first non-null wins
  const results = await Promise.all([
    tryFetch(
      `https://api.tvmaze.com/lookup/shows?imdb=${tconst}`,
      d => d?.image?.original || d?.image?.medium || null
    ),
    tryFetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`,
      d => Array.isArray(d) && d.length > 0 ? (d[0]?.show?.image?.original || d[0]?.show?.image?.medium || null) : null
    ),
    tryFetch(
      `https://www.omdbapi.com/?i=${tconst}&apikey=trilogy`,
      d => (d?.Poster && d.Poster !== 'N/A') ? d.Poster : null
    ),
  ]);

  return results.find(r => r !== null) ?? null;
}

function ShowCard({ show, rank }: { show: ShowWithPoster; rank: number }) {
  const firstGenre = show.genres?.split(',')[0]?.trim() || 'Drama';
  const year = show.startYear || '????';
  const { inList, add, remove } = useWatchlist();
  const listed = inList(show.tconst);

  const handleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (listed) {
      remove(show.tconst);
    } else {
      add({
        tconst: show.tconst,
        title: show.primaryTitle,
        year: show.startYear || '',
        genres: typeof show.genres === 'string' ? show.genres : '',
        imdbRating: Number(show.averageRating) || 0,
        poster: show.poster ?? null,
        status: 'want',
        myRating: null,
      });
    }
  };

  return (
    <Link href={`/show/${show.tconst}`} className="group relative flex flex-col cursor-pointer card-enter">
      <div className="relative w-full overflow-hidden rounded-xl bg-[#111]" style={{ aspectRatio: '2/3' }}>
        {show.poster
          ? <img src={show.poster} alt={show.primaryTitle} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" loading="lazy" />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]">
              <div className="text-4xl opacity-20">📺</div>
              <p className="text-[#444] text-xs font-medium tracking-widest uppercase">{show.primaryTitle.slice(0, 12)}</p>
            </div>
        }
        {/* Rank badge */}
        <div className="absolute top-3 left-3 z-20">
          <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-md px-2 py-0.5">
            <span className="text-[10px] font-black tracking-widest text-white/50">#{rank}</span>
          </div>
        </div>
        {/* Rating badge */}
        <div className="absolute top-3 right-3 z-20">
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-yellow-500/30 rounded-md px-2 py-0.5">
            <span className="text-yellow-400 text-[10px]">★</span>
            <span className="text-white text-[11px] font-bold">{show.averageRating?.toFixed(1)}</span>
          </div>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' }}>
          <div className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <p className="text-white font-bold text-sm leading-tight mb-1">{show.primaryTitle}</p>
            <p className="text-white/60 text-xs mb-3">{year} · {firstGenre}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-[2px] bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full"
                     style={{ width: `${Math.min(100, ((show.averageRating - 7) / 3) * 100)}%` }} />
              </div>
              <span className="text-yellow-400 text-xs font-bold">{show.averageRating?.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* ── Watchlist + button (bottom-left, always visible) ── */}
        <button
          onClick={handleWatchlist}
          title={listed ? 'Remove from Watchlist' : 'Add to Watchlist'}
          className="absolute bottom-3 left-3 z-30 flex items-center justify-center transition-all duration-200"
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: listed ? 'rgba(245,197,24,0.90)' : 'rgba(0,0,0,0.75)',
            border: `1.5px solid ${listed ? '#F5C518' : 'rgba(255,255,255,0.25)'}`,
            backdropFilter: 'blur(8px)',
            boxShadow: listed ? '0 0 12px rgba(245,197,24,0.4)' : 'none',
          }}>
          {listed
            ? <Check size={15} style={{ color: '#000', strokeWidth: 3 }} />
            : <Plus  size={16} style={{ color: '#fff', strokeWidth: 2.5 }} />}
        </button>

        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
             style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.15)' }} />
      </div>
      <div className="pt-3 px-0.5">
        <h3 className="text-white font-bold text-sm leading-tight truncate group-hover:text-yellow-400 transition-colors duration-200">{show.primaryTitle}</h3>
        <p className="text-[#666] text-xs mt-1 font-medium">{year} · {firstGenre}</p>
      </div>
    </Link>
  );
}

function SearchResult({ show, poster, onClick }: { show: Show; poster: string | null | undefined; onClick: () => void }) {
  const firstGenre = show.genres?.split(',')[0]?.trim() || '';
  const ratingColor = !show.averageRating ? '#555'
    : show.averageRating >= 9 ? '#006400'
    : show.averageRating >= 8 ? '#4ade80'
    : show.averageRating >= 7 ? '#D4AF37'
    : '#DC143C';

  return (
    <Link href={`/show/${show.tconst}`} onClick={onClick}
          className="flex items-center gap-3.5 px-4 py-3 transition-colors group hover:bg-white/4 relative">
      {/* Poster thumbnail */}
      <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 bg-[#1a1a1a] border border-white/5">
        {poster
          ? <img src={poster} alt={show.primaryTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : poster === null
            ? <div className="w-full h-full flex items-center justify-center"><span className="text-[#333] text-lg">📺</span></div>
            : <div className="w-full h-full bg-[#1a1a1a] animate-pulse" /> /* undefined = still loading */
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate group-hover:text-yellow-400 transition-colors leading-tight">{show.primaryTitle}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[#555] text-xs">{show.startYear}</span>
          {firstGenre && <>
            <span className="text-[#333] text-xs">·</span>
            <span className="text-[#555] text-xs">{firstGenre}</span>
          </>}
        </div>
        {/* Mini rating bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-[3px] rounded-full bg-white/5 overflow-hidden max-w-[80px]">
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${Math.min(100, ((show.averageRating - 5) / 5) * 100)}%`, backgroundColor: ratingColor }} />
          </div>
          <span className="text-[11px] font-bold" style={{ color: ratingColor }}>
            ★ {show.averageRating?.toFixed(1) ?? '—'}
          </span>
        </div>
      </div>

      {/* Votes */}
      <div className="shrink-0 text-right">
        <span className="text-[#333] text-[11px]">{show.numVotes ? (show.numVotes >= 1000 ? `${(show.numVotes/1000).toFixed(0)}k` : show.numVotes) : ''}</span>
        <div className="text-[#222] text-xs mt-1 group-hover:text-[#555] transition-colors">→</div>
      </div>
    </Link>
  );
}

const SORT_OPTIONS = [
  { value: 'rank',   label: 'Top Ranked' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'votes',  label: 'Most Voted' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'az',     label: 'A → Z' },
];
const DECADES = ['All', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

export default function HomePage() {
  const [shows, setShows] = useState<ShowWithPoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Show[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPosters, setSearchPosters] = useState<Record<string, string | null>>({});
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedDecade, setSelectedDecade] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('rank');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    shows.forEach(s => s.genres?.split(',').forEach(g => { const t = g.trim(); if (t && t !== 'N/A') set.add(t); }));
    return Array.from(set).sort();
  }, [shows]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (selectedGenres.length > 0) c++;
    if (selectedDecade !== 'All') c++;
    if (minRating > 0) c++;
    if (sortBy !== 'rank') c++;
    return c;
  }, [selectedGenres, selectedDecade, minRating, sortBy]);

  const filteredShows = useMemo(() => {
    let result = [...shows];
    if (selectedGenres.length > 0) result = result.filter(s => selectedGenres.every(g => s.genres?.includes(g)));
    if (selectedDecade !== 'All') {
      const ds = parseInt(selectedDecade);
      result = result.filter(s => { const y = parseInt(s.startYear); return y >= ds && y < ds + 10; });
    }
    if (minRating > 0) result = result.filter(s => s.averageRating >= minRating);
    switch (sortBy) {
      case 'rating':  result.sort((a, b) => b.averageRating - a.averageRating); break;
      case 'votes':   result.sort((a, b) => b.numVotes - a.numVotes); break;
      case 'newest':  result.sort((a, b) => parseInt(b.startYear||'0') - parseInt(a.startYear||'0')); break;
      case 'oldest':  result.sort((a, b) => parseInt(a.startYear||'0') - parseInt(b.startYear||'0')); break;
      case 'az':      result.sort((a, b) => a.primaryTitle.localeCompare(b.primaryTitle)); break;
    }
    return result;
  }, [shows, selectedGenres, selectedDecade, minRating, sortBy]);

  const resetFilters = () => { setSelectedGenres([]); setSelectedDecade('All'); setMinRating(0); setSortBy('rank'); };
  const toggleGenre = (g: string) => setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  useEffect(() => {
    fetch('https://cinephile-tv-production.up.railway.app').then(r => r.json()).then(data => {
      if (data.status === 'success') {
        const base: ShowWithPoster[] = data.data.map((s: Show) => ({ ...s, poster: null, posterLoaded: false }));
        setShows(base); setLoading(false);
        const fetchBatch = async (startIdx: number) => {
          const batch = base.slice(startIdx, startIdx + 12);
          await Promise.allSettled(batch.map(async show => {
            const poster = await fetchPoster(show.tconst, show.primaryTitle);
            setShows(prev => prev.map(s => s.tconst === show.tconst ? { ...s, poster, posterLoaded: true } : s));
          }));
          if (startIdx + 12 < base.length) setTimeout(() => fetchBatch(startIdx + 12), 100);
        };
        fetchBatch(0);
      }
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); setSearchOpen(false); setSearchPosters({}); return; }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(query)}`).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            const results: Show[] = data.data.slice(0, 8);
            setSearchResults(results);
            setSearchOpen(true);
            setSearchPosters({});
            // Race all 3 poster sources in parallel per show — first non-null wins
            results.forEach(async (show: Show) => {
              const tryGet = async (url: string, extract: (d: any) => string | null) => {
                try {
                  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
                  if (!r.ok) return null;
                  return extract(await r.json());
                } catch { return null; }
              };
              const [byId, byTitle, byOmdb] = await Promise.all([
                tryGet(
                  `https://api.tvmaze.com/lookup/shows?imdb=${show.tconst}`,
                  d => d?.image?.medium || d?.image?.original || null
                ),
                tryGet(
                  `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(show.primaryTitle)}`,
                  d => {
                    if (!Array.isArray(d) || d.length === 0) return null;
                    const match = d.find((h: any) => h.show?.name?.toLowerCase() === show.primaryTitle.toLowerCase()) || d[0];
                    return match?.show?.image?.medium || match?.show?.image?.original || null;
                  }
                ),
                tryGet(
                  `https://www.omdbapi.com/?i=${show.tconst}&apikey=trilogy`,
                  d => (d?.Poster && d.Poster !== 'N/A') ? d.Poster : null
                ),
              ]);
              const poster = byId ?? byTitle ?? byOmdb ?? null;
              setSearchPosters(prev => ({ ...prev, [show.tconst]: poster }));
            });
          }
        setSearchLoading(false);
      }).catch(() => setSearchLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  return (
    <div className="min-h-screen text-white" style={{ background: '#080808', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #e53e3e, transparent 70%)' }} />
        <div className="absolute top-60 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #ffd700, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-8 md:px-12 pb-24">

        {/* Header */}
        <header className="flex items-center justify-between py-8 mb-2">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e53e3e, #c53030)' }}>
              <span className="text-white text-sm font-black">C</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white leading-none">CINEPHILE</h1>
              <p className="text-[10px] tracking-[3px] text-[#444] uppercase font-medium leading-none mt-0.5">TV Analytics</p>
            </div>
          </div>

          <div ref={searchRef} className="relative w-full max-w-md mx-8">

            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${searchOpen || query ? 'border-white/15 bg-[#111]' : 'border-white/8 bg-[#0d0d0d]'}`}>
              <svg className="w-4 h-4 text-[#555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                placeholder="Search shows — Breaking Bad, Arcane..." className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none" />
              {searchLoading && <div className="w-4 h-4 border-2 border-[#333] border-t-white/50 rounded-full animate-spin shrink-0" />}
              {query && !searchLoading && <button onClick={() => { setQuery(''); setSearchResults([]); setSearchOpen(false); }} className="text-[#444] hover:text-white transition-colors text-lg leading-none">×</button>}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                   style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 32px 64px rgba(0,0,0,0.9)' }}>
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-[3px] text-[#333] uppercase">Results</span>
                  <span className="text-[10px] text-[#333]">{searchResults.length} shows</span>
                </div>
                <div className="py-1.5">
                  {searchResults.map(show => <SearchResult key={show.tconst} show={show} poster={searchPosters[show.tconst]} onClick={() => { setQuery(''); setSearchOpen(false); setSearchPosters({}); }} />)}
                </div>
                <div className="px-4 py-2.5 border-t border-white/5">
                  <p className="text-[#333] text-xs">Top {searchResults.length} matches · click to explore</p>
                </div>
              </div>
            )}
          </div>

          <div ref={sortRef} className="relative shrink-0">
            <button onClick={() => setSortOpen(p => !p)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all"
              style={{ background: sortBy !== 'rank' ? 'rgba(229,62,62,0.08)' : 'rgba(255,255,255,0.04)', borderColor: sortBy !== 'rank' ? 'rgba(229,62,62,0.3)' : 'rgba(255,255,255,0.08)', color: sortBy !== 'rank' ? '#e53e3e' : '#666' }}>
              {currentSortLabel} <ChevronDown size={13} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute top-full right-0 mt-2 w-44 bg-[#111] border border-white/8 rounded-xl overflow-hidden shadow-2xl z-50">
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ color: sortBy === opt.value ? '#e53e3e' : '#888' }}>
                    {sortBy === opt.value && <span className="mr-2">✓</span>}{opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link href="/compare"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0"
            style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', color: '#888' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(96,165,250,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(96,165,250,0.15)'; }}>
            <BarChart2 size={13} />
            Compare
          </Link>
          <Link href="/hall-of-fame"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0"
            style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.15)', color: '#888' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F5C518'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,197,24,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,197,24,0.15)'; }}>
            <Trophy size={13} />
            Hall of Fame
          </Link>
          <Link href="/watchlist"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0"
            style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.15)', color: '#888' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F5C518'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,197,24,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,197,24,0.15)'; }}>
            <Bookmark size={13} />
            Watchlist
          </Link>
        </header>

        {/* Section header + filter toggle */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1 h-4 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold tracking-[3px] text-[#555] uppercase">Ranked by rating</span>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black tracking-tight text-white">IMDb Top 250 <span className="text-[#333]">TV Shows</span></h2>
              {activeFilterCount > 0 && <><span className="text-sm text-[#666]">·</span><span className="text-sm font-bold" style={{ color: '#e53e3e' }}>{filteredShows.length} results</span></>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors font-medium">
                <RotateCcw size={11} /> Reset
              </button>
            )}
            <button onClick={() => setFiltersOpen(p => !p)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all"
              style={{ background: filtersOpen || activeFilterCount > 0 ? 'rgba(229,62,62,0.08)' : 'rgba(255,255,255,0.04)', borderColor: filtersOpen || activeFilterCount > 0 ? 'rgba(229,62,62,0.3)' : 'rgba(255,255,255,0.08)', color: filtersOpen || activeFilterCount > 0 ? '#e53e3e' : '#666' }}>
              <SlidersHorizontal size={13} />
              Filters
              {activeFilterCount > 0 && <span className="w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center" style={{ background: '#e53e3e', color: '#fff' }}>{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="mb-8 rounded-2xl border border-white/6 p-6 space-y-6" style={{ background: '#0d0d0d' }}>

            {/* Genre pills */}
            <div>
              <p className="text-[10px] font-black tracking-[3px] text-[#444] uppercase mb-3">Genre</p>
              <div className="flex flex-wrap gap-2">
                {allGenres.map(g => (
                  <button key={g} onClick={() => toggleGenre(g)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: selectedGenres.includes(g) ? 'rgba(229,62,62,0.15)' : 'rgba(255,255,255,0.04)', border: selectedGenres.includes(g) ? '1px solid rgba(229,62,62,0.4)' : '1px solid rgba(255,255,255,0.07)', color: selectedGenres.includes(g) ? '#e53e3e' : '#666' }}>
                    {selectedGenres.includes(g) && '✓ '}{g}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-white/5" />

            {/* Decade + Rating */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-[3px] text-[#444] uppercase mb-3">Decade</p>
                <div className="flex flex-wrap gap-2">
                  {DECADES.map(d => (
                    <button key={d} onClick={() => setSelectedDecade(d)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: selectedDecade === d ? 'rgba(229,62,62,0.15)' : 'rgba(255,255,255,0.04)', border: selectedDecade === d ? '1px solid rgba(229,62,62,0.4)' : '1px solid rgba(255,255,255,0.07)', color: selectedDecade === d ? '#e53e3e' : '#666' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 max-w-xs">
                <p className="text-[10px] font-black tracking-[3px] text-[#444] uppercase mb-3">
                  Min Rating — <span style={{ color: '#e53e3e' }}>{minRating === 0 ? 'Any' : `${minRating.toFixed(1)}+`}</span>
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[#555] text-xs font-bold">0</span>
                  <div className="relative flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="absolute left-0 h-full rounded-full" style={{ width: `${(minRating / 10) * 100}%`, background: 'linear-gradient(90deg, #e53e3e, #ff6b6b)' }} />
                    <input type="range" min={0} max={10} step={0.1} value={minRating} onChange={e => setMinRating(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                  </div>
                  <span className="text-[#555] text-xs font-bold">10</span>
                  {minRating > 0 && <button onClick={() => setMinRating(0)} className="text-[#444] hover:text-white transition-colors"><X size={12} /></button>}
                </div>
                <div className="flex gap-2">
                  {[7, 7.5, 8, 8.5, 9].map(r => (
                    <button key={r} onClick={() => setMinRating(minRating === r ? 0 : r)}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
                      style={{ background: minRating === r ? 'rgba(229,62,62,0.15)' : 'rgba(255,255,255,0.04)', border: minRating === r ? '1px solid rgba(229,62,62,0.4)' : '1px solid rgba(255,255,255,0.07)', color: minRating === r ? '#e53e3e' : '#555' }}>
                      {r}+
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                {selectedGenres.map(g => (
                  <span key={g} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.25)', color: '#e53e3e' }}>
                    {g} <button onClick={() => toggleGenre(g)} className="hover:opacity-70"><X size={10} /></button>
                  </span>
                ))}
                {selectedDecade !== 'All' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.25)', color: '#e53e3e' }}>
                    {selectedDecade} <button onClick={() => setSelectedDecade('All')} className="hover:opacity-70"><X size={10} /></button>
                  </span>
                )}
                {minRating > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.25)', color: '#e53e3e' }}>
                    ★ {minRating.toFixed(1)}+ <button onClick={() => setMinRating(0)} className="hover:opacity-70"><X size={10} /></button>
                  </span>
                )}
                {sortBy !== 'rank' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.25)', color: '#e53e3e' }}>
                    {currentSortLabel} <button onClick={() => setSortBy('rank')} className="hover:opacity-70"><X size={10} /></button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results count */}
        {!loading && activeFilterCount > 0 && (
          <p className="text-[#444] text-sm mb-6 font-medium">
            Showing <span className="text-white font-bold">{filteredShows.length}</span> of {shows.length} shows
            {selectedGenres.length > 0 && <> in <span className="text-white font-bold">{selectedGenres.join(' + ')}</span></>}
            {selectedDecade !== 'All' && <> · <span className="text-white font-bold">{selectedDecade}</span></>}
            {minRating > 0 && <> · <span className="text-white font-bold">★{minRating.toFixed(1)}+</span></>}
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 animate-pulse" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="w-full rounded-xl bg-[#111]" style={{ aspectRatio: '2/3' }} />
                <div className="h-3 bg-[#111] rounded w-3/4" />
                <div className="h-2.5 bg-[#0d0d0d] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="text-5xl opacity-20">🎬</div>
            <p className="text-white font-bold text-lg">No shows match your filters</p>
            <p className="text-[#444] text-sm">Try adjusting or <button onClick={resetFilters} className="text-red-500 hover:text-red-400 underline underline-offset-2">resetting</button> your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
            {filteredShows.map((show) => {
              const globalRank = shows.findIndex(s => s.tconst === show.tconst) + 1;
              return <ShowCard key={show.tconst} show={show} rank={globalRank} />;
            })}
          </div>
        )}

      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px;
          border-radius: 50%; background: #e53e3e; border: 2px solid #080808;
          cursor: pointer; box-shadow: 0 0 8px rgba(229,62,62,0.5); margin-top: -5px;
        }
        input[type=range]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .card-enter { animation: fadeInUp 0.35s ease-out both; }
      `}</style>
    </div>
  );
}