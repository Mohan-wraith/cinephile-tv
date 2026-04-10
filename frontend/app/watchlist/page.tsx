'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Star, Trash2, ChevronDown, Filter, SlidersHorizontal, BookmarkCheck, Eye, Clock, X, Check } from 'lucide-react';
import { useWatchlist, WatchStatus, WatchlistEntry } from '@/hooks/useWatchlist';

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<WatchStatus, { label: string; color: string; icon: string }> = {
  want:      { label: 'Want to Watch', color: '#60a5fa', icon: '🔖' },
  watching:  { label: 'Watching',      color: '#4ade80', icon: '👁️' },
  completed: { label: 'Completed',     color: '#F5C518', icon: '✅' },
  dropped:   { label: 'Dropped',       color: '#DC143C', icon: '❌' },
};

const ratingColor = (r: number) => {
  if (r >= 9)   return '#006400';
  if (r >= 8)   return '#90EE90';
  if (r >= 6)   return '#D4AF37';
  if (r >= 5)   return '#DC143C';
  return '#800080';
};
const ratingText = (r: number) => (r >= 6 && r < 9) ? '#000' : '#fff';

// ── Star rater ───────────────────────────────────────────────────────────────
function StarRater({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => {
        const v = i + 1;
        return (
          <button key={v}
            onClick={() => onChange(value === v ? null : v)}
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover(null)}
            className="transition-transform hover:scale-125"
            title={`Rate ${v}/10`}>
            <Star size={12}
              fill={v <= display ? '#F5C518' : 'none'}
              stroke={v <= display ? '#F5C518' : '#333'}
              strokeWidth={1.5} />
          </button>
        );
      })}
      {value !== null && (
        <span className="ml-1 text-xs font-black" style={{ color: '#F5C518' }}>{value}/10</span>
      )}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status, onChange }: { status: WatchStatus; onChange: (s: WatchStatus) => void }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
        style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30`, color: meta.color }}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-20 min-w-max"
             style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 32px rgba(0,0,0,0.8)' }}>
          {(Object.entries(STATUS_META) as [WatchStatus, typeof STATUS_META[WatchStatus]][]).map(([s, m]) => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
              style={{ color: s === status ? m.color : '#555' }}>
              <span>{m.icon}</span>
              <span className="font-semibold">{m.label}</span>
              {s === status && <Check size={10} style={{ color: m.color, marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Show card ─────────────────────────────────────────────────────────────────
function WatchCard({ entry, onRemove, onStatus, onRate, onClick }: {
  entry: WatchlistEntry;
  onRemove: () => void;
  onStatus: (s: WatchStatus) => void;
  onRate: (v: number | null) => void;
  onClick: () => void;
}) {
  const meta = STATUS_META[entry.status];
  return (
    <div className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:translate-y-[-2px]"
         style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Poster */}
      <div className="relative cursor-pointer" style={{ aspectRatio: '2/3' }} onClick={onClick}>
        {entry.poster
          ? <img src={entry.poster} alt={entry.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: '#111' }}>
              <span className="text-4xl opacity-10">📺</span>
            </div>}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,13,13,0.95) 0%, transparent 50%)' }} />

        {/* Status badge top-left */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-black"
             style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40`, color: meta.color, backdropFilter: 'blur(8px)' }}>
          {meta.icon}
        </div>

        {/* Remove button top-right (visible on hover) */}
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Trash2 size={12} style={{ color: '#DC143C' }} />
        </button>

        {/* IMDb rating bottom-right */}
        {entry.imdbRating > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-xs font-black"
               style={{ background: ratingColor(entry.imdbRating), color: ratingText(entry.imdbRating) }}>
            {entry.imdbRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2">
        <div>
          <p className="text-white font-bold text-sm leading-tight truncate">{entry.title}</p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: '#333' }}>{entry.year} · {(typeof entry.genres === 'string' ? entry.genres : '').split(',')[0] || 'TV'}</p>
        </div>

        <StatusPill status={entry.status} onChange={onStatus} />
        <StarRater value={entry.myRating} onChange={onRate} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type FilterStatus = WatchStatus | 'all';
type SortKey = 'recent' | 'title' | 'rating' | 'myrating';

export default function WatchlistPage() {
  const router = useRouter();
  const { entries, remove, setStatus, setMyRating } = useWatchlist();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let out = [...entries];
    if (filterStatus !== 'all') out = out.filter(e => e.status === filterStatus);
    if (search.trim()) out = out.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
    if (sortKey === 'title')    out.sort((a, b) => a.title.localeCompare(b.title));
    if (sortKey === 'rating')   out.sort((a, b) => b.imdbRating - a.imdbRating);
    if (sortKey === 'myrating') out.sort((a, b) => (b.myRating ?? -1) - (a.myRating ?? -1));
    return out;
  }, [entries, filterStatus, sortKey, search]);

  // Stats
  const stats = useMemo(() => ({
    total:     entries.length,
    want:      entries.filter(e => e.status === 'want').length,
    watching:  entries.filter(e => e.status === 'watching').length,
    completed: entries.filter(e => e.status === 'completed').length,
    dropped:   entries.filter(e => e.status === 'dropped').length,
    avgMyRating: (() => {
      const rated = entries.filter(e => e.myRating !== null);
      return rated.length ? (rated.reduce((s, e) => s + e.myRating!, 0) / rated.length).toFixed(1) : null;
    })(),
  }), [entries]);

  return (
    <div className="min-h-screen" style={{ background: '#080808', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeUp 0.35s ease both; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#0a0a0a; }
        ::-webkit-scrollbar-thumb { background:#1e1e1e; border-radius:2px; }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <button onClick={() => router.push('/')} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: '#DC143C' }}>C</div>
          <span style={{ color: '#444', letterSpacing: 2, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Cinephile</span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
             style={{ background: 'rgba(245,197,24,0.07)', border: '1px solid rgba(245,197,24,0.15)' }}>
          <Bookmark size={12} style={{ color: '#F5C518' }} />
          <span style={{ color: '#F5C518', fontSize: 11, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>Watchlist</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10">

        {/* Hero */}
        <div className="mb-10">
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 5, color: '#1e1e1e', textTransform: 'uppercase', marginBottom: 10 }}>My Library</p>
          <h1 style={{ fontSize: 'clamp(36px,5vw,56px)', fontWeight: 900, lineHeight: 1, letterSpacing: -2, marginBottom: 8 }}>
            Your<br /><span style={{ color: '#F5C518' }}>Watchlist</span>
          </h1>

          {/* Stats row */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-6">
              {[
                { label: 'Total', value: stats.total, color: '#fff' },
                { label: STATUS_META.want.icon + ' Want', value: stats.want, color: STATUS_META.want.color },
                { label: STATUS_META.watching.icon + ' Watching', value: stats.watching, color: STATUS_META.watching.color },
                { label: STATUS_META.completed.icon + ' Completed', value: stats.completed, color: STATUS_META.completed.color },
                { label: STATUS_META.dropped.icon + ' Dropped', value: stats.dropped, color: STATUS_META.dropped.color },
                ...(stats.avgMyRating ? [{ label: '⭐ Avg Rating', value: stats.avgMyRating, color: '#F5C518' }] : []),
              ].map(s => (
                <div key={s.label} className="flex flex-col px-4 py-3 rounded-xl"
                     style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-[10px] font-semibold mt-0.5" style={{ color: '#2a2a2a' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                 style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.12)' }}>
              <Bookmark size={32} style={{ color: '#F5C518', opacity: 0.4 }} />
            </div>
            <div className="text-center">
              <p className="text-white font-black text-xl mb-2">Nothing here yet</p>
              <p style={{ color: '#2a2a2a', fontSize: 14 }}>Open any show and hit the bookmark button to add it</p>
            </div>
            <button onClick={() => router.push('/')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(245,197,24,0.1)', border: '1px solid rgba(245,197,24,0.2)', color: '#F5C518' }}>
              Browse Shows →
            </button>
          </div>
        )}

        {/* Controls */}
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-8">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-48 max-w-64"
                 style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Filter size={12} style={{ color: '#333' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search your list…"
                className="bg-transparent text-white text-xs outline-none flex-1 placeholder-[#2a2a2a]" />
              {search && <button onClick={() => setSearch('')}><X size={10} style={{ color: '#333' }} /></button>}
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-1.5">
              {(['all', 'want', 'watching', 'completed', 'dropped'] as FilterStatus[]).map(s => {
                const active = filterStatus === s;
                const meta = s !== 'all' ? STATUS_META[s] : null;
                return (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? (meta ? `${meta.color}15` : 'rgba(255,255,255,0.08)') : 'transparent',
                      border: `1px solid ${active ? (meta ? `${meta.color}30` : 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.04)'}`,
                      color: active ? (meta ? meta.color : '#fff') : '#2a2a2a',
                    }}>
                    {s === 'all' ? 'All' : `${meta!.icon} ${meta!.label}`}
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 ml-auto">
              <SlidersHorizontal size={11} style={{ color: '#333' }} />
              {([['recent', 'Recent'], ['title', 'A–Z'], ['rating', 'IMDb'], ['myrating', 'My Rating']] as [SortKey, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setSortKey(k)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: sortKey === k ? 'rgba(255,255,255,0.07)' : 'transparent',
                    border: `1px solid ${sortKey === k ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}`,
                    color: sortKey === k ? '#fff' : '#2a2a2a',
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {filtered.map(entry => (
              <WatchCard key={entry.tconst} entry={entry}
                onRemove={() => remove(entry.tconst)}
                onStatus={s => setStatus(entry.tconst, s)}
                onRate={v => setMyRating(entry.tconst, v)}
                onClick={() => router.push(`/show/${entry.tconst}`)} />
            ))}
          </div>
        )}

        {filtered.length === 0 && entries.length > 0 && (
          <div className="text-center py-20">
            <p style={{ color: '#2a2a2a', fontSize: 14 }}>No shows match your filter</p>
          </div>
        )}
      </div>
    </div>
  );
}