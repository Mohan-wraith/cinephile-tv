'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Skull, TrendingDown, Zap, BarChart2 } from 'lucide-react';

const API = '${API_URL}';

const ratingColor = (r: number) => {
  if (!r) return '#282828';
  if (r >= 9.0) return '#006400';
  if (r >= 8.0) return '#90EE90';
  if (r >= 6.0) return '#D4AF37';
  if (r >= 5.0) return '#DC143C';
  return '#800080';
};
const ratingTextColor = (r: number) =>
  (r >= 8.0 && r < 9.0) || (r >= 6.0 && r < 8.0) ? '#000' : '#fff';

type Tab = 'bestEps' | 'worstEps' | 'bestSeasons' | 'worstSeasons' | 'consistent';

interface TabDef { id: Tab; label: string; accent: string; glow: string; }
const TABS: TabDef[] = [
  { id: 'bestEps',      label: 'Greatest Episodes', accent: '#F5C518', glow: 'rgba(245,197,24,0.12)' },
  { id: 'worstEps',     label: 'Worst Episodes',    accent: '#800080', glow: 'rgba(128,0,128,0.12)' },
  { id: 'bestSeasons',  label: 'Best Seasons',      accent: '#4ade80', glow: 'rgba(74,222,128,0.10)' },
  { id: 'worstSeasons', label: 'Worst Seasons',     accent: '#DC143C', glow: 'rgba(220,20,60,0.10)' },
  { id: 'consistent',   label: 'Most Consistent',   accent: '#60a5fa', glow: 'rgba(96,165,250,0.10)' },
];

function TabIcon({ id, size = 14, color }: { id: Tab; size?: number; color?: string }) {
  const style = { color: color || 'currentColor' };
  if (id === 'bestEps')      return <Zap size={size} style={style} />;
  if (id === 'worstEps')     return <Skull size={size} style={style} />;
  if (id === 'bestSeasons')  return <Trophy size={size} style={style} />;
  if (id === 'worstSeasons') return <TrendingDown size={size} style={style} />;
  return <BarChart2 size={size} style={style} />;
}

function fmtVotes(v: number) {
  if (!v) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${Math.round(v / 1_000)}K`;
  return String(v);
}

export default function HallOfFame() {
  const router = useRouter();
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('bestEps');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/api/hall-of-fame`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const tab  = TABS.find(t => t.id === activeTab)!;
  const rows: any[] = !data ? [] :
    activeTab === 'bestEps'      ? (data.bestEpisodes   || []) :
    activeTab === 'worstEps'     ? (data.worstEpisodes  || []) :
    activeTab === 'bestSeasons'  ? (data.bestSeasons    || []) :
    activeTab === 'worstSeasons' ? (data.worstSeasons   || []) :
    (data.mostConsistent || []);

  const isEpisode = activeTab === 'bestEps' || activeTab === 'worstEps';
  const isSeason  = activeTab === 'bestSeasons' || activeTab === 'worstSeasons';

  const gridCols = isEpisode ? '44px 1fr 200px 90px 72px'
                 : isSeason  ? '44px 1fr 110px 90px 72px'
                 :             '44px 1fr 100px 72px';

  return (
    <div className="min-h-screen" style={{ background: '#080808', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .row-in { animation: fadeUp 0.28s ease both; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:#0a0a0a; }
        ::-webkit-scrollbar-thumb { background:#1e1e1e; border-radius:2px; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
           className="flex items-center justify-between px-8 py-5">
        <button onClick={() => router.push('/')} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm"
               style={{ background: '#DC143C', color: '#fff' }}>C</div>
          <span style={{ color: '#444', letterSpacing: '2px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            Cinephile
          </span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
             style={{ background: 'rgba(245,197,24,0.07)', border: '1px solid rgba(245,197,24,0.15)' }}>
          <Trophy size={12} style={{ color: '#F5C518' }} />
          <span style={{ color: '#F5C518', fontSize: 11, fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase' }}>
            Hall of Fame
          </span>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative px-8 pt-14 pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(245,197,24,0.04) 0%, transparent 70%)' }} />
        <div className="relative" style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 5, color: '#222', textTransform: 'uppercase', marginBottom: 16 }}>
            IMDb · All-Time Records
          </p>
          <h1 style={{ fontSize: 'clamp(40px,7vw,80px)', fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: '#fff', marginBottom: 12 }}>
            Hall of <span style={{ color: '#F5C518' }}>Fame</span>
            <br />&amp; <span style={{ color: '#DC143C' }}>Shame</span>
          </h1>
          <p style={{ color: '#2e2e2e', maxWidth: 400, fontSize: 14, lineHeight: 1.6 }}>
            The highest peaks and lowest valleys across every rated TV show in the database.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-30 px-8"
           style={{ background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 4, padding: '8px 0', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 12,
                        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                        background: active ? t.glow : 'transparent',
                        color:      active ? t.accent : '#2e2e2e',
                        border:     `1px solid ${active ? t.accent + '28' : 'transparent'}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                <TabIcon id={t.id} size={13} color={active ? t.accent : '#2e2e2e'} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0', gap: 16 }}>
            <div style={{ width: 28, height: 28, border: `2px solid #1a1a1a`, borderTop: `2px solid ${tab.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
            <p style={{ color: '#2a2a2a', fontSize: 13 }}>Loading records…</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <p style={{ color: '#333' }}>Couldn't load data — make sure the API is running.</p>
          </div>
        )}

        {!loading && !error && data && (
          <div key={activeTab}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tab.glow, border: `1px solid ${tab.accent}20` }}>
                <TabIcon id={tab.id} size={15} color={tab.accent} />
              </div>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: '#fff', margin: 0 }}>{tab.label}</h2>
                <p style={{ color: '#222', fontSize: 11, margin: '2px 0 0' }}>{rows.length} entries · ranked by IMDb rating</p>
              </div>
            </div>

            {/* Table */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>

              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '10px 24px', background: '#0a0a0a', fontSize: 10, fontWeight: 900, letterSpacing: 3, color: '#1e1e1e', textTransform: 'uppercase' }}>
                <span>#</span>
                <span>{isEpisode ? 'Episode' : isSeason ? 'Show · Season' : 'Show'}</span>
                {isEpisode && <span>Series</span>}
                {isSeason  && <span>Season avg</span>}
                {!isEpisode && !isSeason && <span>Avg rating</span>}
                {isEpisode && <span>Rating</span>}
                <span style={{ textAlign: 'right' }}>Votes</span>
              </div>

              {/* Data rows */}
              {rows.map((row: any, i: number) => {
                const epR  = isEpisode ? Number(row.averageRating) : 0;
                const seaR = isSeason  ? Number(row.seasonAvg)     : 0;
                const conR = !isEpisode && !isSeason ? Number(row.avgRating || row.showRating) : 0;
                const votes = row.showVotes;
                const hov   = hoveredRow === i;

                return (
                  <div key={`row-${i}`}
                       className="row-in"
                       style={{
                         display: 'grid', gridTemplateColumns: gridCols,
                         alignItems: 'center', padding: '14px 24px', cursor: 'pointer',
                         background: hov ? `${tab.accent}08` : i % 2 === 0 ? '#0a0a0a' : 'transparent',
                         borderTop: '1px solid rgba(255,255,255,0.025)',
                         animationDelay: `${Math.min(i * 22, 350)}ms`,
                         transition: 'background 0.1s',
                       }}
                       onMouseEnter={() => setHoveredRow(i)}
                       onMouseLeave={() => setHoveredRow(null)}
                       onClick={() => router.push(`/show/${row.showTconst}`)}>

                    {/* Rank */}
                    <div>
                      {i === 0 ? <span style={{ fontSize: 18 }}>🥇</span>
                       : i === 1 ? <span style={{ fontSize: 18 }}>🥈</span>
                       : i === 2 ? <span style={{ fontSize: 18 }}>🥉</span>
                       : <span style={{ color: '#1e1e1e', fontWeight: 900, fontSize: 13 }}>{i + 1}</span>}
                    </div>

                    {/* Main title */}
                    <div style={{ minWidth: 0, paddingRight: 16 }}>
                      {isEpisode && <>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.epTitle || `Episode ${row.episodeNumber}`}
                        </p>
                        <p style={{ fontSize: 11, color: '#252525', margin: '2px 0 0' }}>
                          S{row.seasonNumber}E{row.episodeNumber}
                        </p>
                      </>}
                      {isSeason && <>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.showTitle}
                          <span style={{ color: '#444', fontWeight: 400, marginLeft: 8 }}>· Season {row.seasonNumber}</span>
                        </p>
                        <p style={{ fontSize: 11, color: '#252525', margin: '2px 0 0' }}>
                          {row.startYear} · {row.ratedEps} rated eps · show avg ★{Number(row.showRating).toFixed(1)}
                        </p>
                      </>}
                      {!isEpisode && !isSeason && <>
                        <p style={{ fontWeight: 700, fontSize: 13, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.showTitle}
                        </p>
                        <p style={{ fontSize: 11, color: '#252525', margin: '2px 0 0' }}>
                          {row.startYear} · {row.ratedEps} rated eps
                        </p>
                      </>}
                    </div>

                    {/* Series col (episode mode) */}
                    {isEpisode && (
                      <div style={{ minWidth: 0, paddingRight: 16 }}>
                        <p style={{ fontSize: 12, color: '#3a3a3a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.showTitle}
                        </p>
                        <p style={{ fontSize: 11, color: '#1e1e1e', margin: '2px 0 0' }}>{row.startYear}</p>
                      </div>
                    )}

                    {/* Season rating pill */}
                    {isSeason && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ padding: '3px 10px', borderRadius: 8, fontSize: 13, fontWeight: 900, background: ratingColor(seaR), color: ratingTextColor(seaR) }}>
                          {seaR.toFixed(1)}
                        </div>
                        <span style={{ fontSize: 12, color: '#444', fontWeight: 700 }}>S{row.seasonNumber}</span>
                      </div>
                    )}

                    {/* Consistent avg pill */}
                    {!isEpisode && !isSeason && (
                      <div style={{ padding: '3px 10px', borderRadius: 8, fontSize: 13, fontWeight: 900, display: 'inline-flex', background: ratingColor(conR), color: ratingTextColor(conR) }}>
                        {conR.toFixed(1)}
                      </div>
                    )}

                    {/* Episode rating pill */}
                    {isEpisode && (
                      <div style={{
                        padding: '4px 12px', borderRadius: 10, fontSize: 13, fontWeight: 900,
                        background: ratingColor(epR), color: ratingTextColor(epR),
                        display: 'inline-flex',
                        boxShadow: i < 3 ? `0 0 14px ${ratingColor(epR)}60` : 'none',
                      }}>
                        {epR.toFixed(1)}
                      </div>
                    )}

                    {/* Votes */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, color: '#252525', fontWeight: 600 }}>{fmtVotes(votes)}</span>
                    </div>

                  </div>
                );
              })}
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#181818', marginTop: 20 }}>
              {isEpisode  ? 'Episodes ≥ 10,000 votes · Shows ≥ 50,000 votes · max 2 per show'
               : isSeason ? 'Shows ≥ 50,000 votes · Episodes ≥ 1,000 votes · Seasons with ≥ 6 rated episodes'
               :            'Shows ≥ 50,000 votes · ≥ 20 rated episodes (≥1k votes each) · avg ≥ 8.0'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
