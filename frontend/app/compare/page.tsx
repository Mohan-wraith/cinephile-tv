'use client';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, X, Search, ArrowRight, BarChart2, Star, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const API = 'http://127.0.0.1:8000';

// ── helpers ──────────────────────────────────────────────────────────────────
const ratingColor = (r: number) => {
  if (!r) return '#282828';
  if (r >= 9.0) return '#006400';
  if (r >= 8.0) return '#90EE90';
  if (r >= 6.0) return '#D4AF37';
  if (r >= 5.0) return '#DC143C';
  return '#800080';
};
const ratingText = (r: number) =>
  (r >= 8.0 && r < 9.0) || (r >= 6.0 && r < 8.0) ? '#000' : '#fff';

const fmtVotes = (v: number) => {
  if (!v) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
};

async function fetchPosterFast(tconst: string, title: string): Promise<string | null> {
  const tryF = async (url: string, ex: (d: any) => string | null) => {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); if (!r.ok) return null; return ex(await r.json()); } catch { return null; }
  };
  const [a, b, c] = await Promise.all([
    tryF(`https://api.tvmaze.com/lookup/shows?imdb=${tconst}`, d => d?.image?.original || d?.image?.medium || null),
    tryF(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, d => Array.isArray(d) && d.length > 0 ? (d[0]?.show?.image?.original || d[0]?.show?.image?.medium || null) : null),
    tryF(`https://www.omdbapi.com/?i=${tconst}&apikey=trilogy`, d => (d?.Poster && d.Poster !== 'N/A') ? d.Poster : null),
  ]);
  return a ?? b ?? c ?? null;
}

// ── ShowSlot: one side of the comparison ─────────────────────────────────────
function ShowSlot({ side, color, onSelect }: {
  side: 'A' | 'B';
  color: string;
  onSelect: (show: any, heatmap: any, poster: string | null) => void;
}) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setResults((d.data || []).slice(0, 6));
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 320);
  }, []);

  const pick = async (show: any) => {
    setOpen(false);
    setQuery(show.primaryTitle);
    const [heatmapRes, poster] = await Promise.all([
      fetch(`${API}/api/heatmap?id=${show.tconst}&mode=db`).then(r => r.json()),
      fetchPosterFast(show.tconst, show.primaryTitle),
    ]);
    onSelect(show, heatmapRes.data || null, poster);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all"
           style={{ background: '#0d0d0d', borderColor: open || query ? `${color}40` : 'rgba(255,255,255,0.07)' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
             style={{ background: color, color: '#000' }}>{side}</div>
        <input value={query} onChange={e => { setQuery(e.target.value); search(e.target.value); }}
               placeholder={`Search show ${side}…`}
               className="flex-1 bg-transparent text-white text-sm placeholder-[#333] outline-none" />
        {loading && <div className="w-4 h-4 border-2 border-[#333] border-t-white/40 rounded-full animate-spin shrink-0" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
                  className="text-[#333] hover:text-white transition-colors text-lg leading-none">×</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
             style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 48px rgba(0,0,0,0.9)' }}>
          {results.map((show: any) => (
            <button key={show.tconst} onClick={() => pick(show)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{show.primaryTitle}</p>
                <p className="text-[#333] text-xs mt-0.5">{show.startYear} · {show.genres?.split(',')[0]}</p>
              </div>
              <div className="px-2 py-1 rounded-lg text-xs font-black shrink-0"
                   style={{ background: ratingColor(show.averageRating), color: ratingText(show.averageRating) }}>
                {Number(show.averageRating).toFixed(1)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini heatmap ──────────────────────────────────────────────────────────────
function MiniHeatmap({ heatmap, color }: { heatmap: any; color: string }) {
  if (!heatmap) return (
    <div className="flex items-center justify-center h-40 rounded-2xl"
         style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
      <p className="text-[#2a2a2a] text-sm">No data</p>
    </div>
  );

  const seasons = Object.keys(heatmap).sort((a, b) => Number(a) - Number(b));
  const maxEps = Math.max(...seasons.map(s => heatmap[s].length));
  const BOX = 32; const GAP = 3;

  return (
    <div className="rounded-2xl overflow-auto p-4"
         style={{ background: '#0a0a0a', border: `1px solid ${color}18` }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${seasons.length}, ${BOX}px)`, gap: GAP }}>
        {/* Season headers */}
        {seasons.map(s => (
          <div key={s} className="flex items-center justify-center text-[10px] font-black tracking-wider pb-1"
               style={{ color: '#2a2a2a', fontSize: 10 }}>S{s}</div>
        ))}
        {/* Episode rows */}
        {Array.from({ length: maxEps }).map((_, epIdx) => (
          seasons.map(s => {
            const ep = heatmap[s]?.[epIdx];
            const r = ep?.rating || 0;
            return (
              <div key={`${s}-${epIdx}`}
                   title={ep ? `S${s}E${ep.episode}: ${ep.title} — ${r > 0 ? r : 'N/A'}` : ''}
                   style={{
                     width: BOX, height: BOX, borderRadius: 6,
                     background: r > 0 ? ratingColor(r) : '#111',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontSize: 9, fontWeight: 900,
                     color: r > 0 ? ratingText(r) : 'transparent',
                   }}>
                {r > 0 ? r.toFixed(1) : ''}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}

// ── Stat comparison row ───────────────────────────────────────────────────────
function StatRow({ label, valA, valB, higherIsBetter = true, format = (v: number) => v.toFixed(1) }: {
  label: string; valA: number; valB: number; higherIsBetter?: boolean; format?: (v: number) => string;
}) {
  const diff = valA - valB;
  const aWins = higherIsBetter ? valA > valB : valA < valB;
  const bWins = higherIsBetter ? valB > valA : valB < valA;
  const tie   = Math.abs(diff) < 0.05;

  return (
    <div className="grid items-center gap-3 py-3" style={{ gridTemplateColumns: '1fr auto 1fr', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="flex items-center justify-end gap-2">
        <span className="font-black text-base" style={{ color: aWins ? '#fff' : '#2a2a2a' }}>{format(valA)}</span>
        {aWins && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <span className="text-[10px] font-black tracking-[3px] uppercase text-center px-3"
            style={{ color: '#1e1e1e', minWidth: 120 }}>{label}</span>
      <div className="flex items-center gap-2">
        {bWins && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        <span className="font-black text-base" style={{ color: bWins ? '#fff' : '#2a2a2a' }}>{format(valB)}</span>
      </div>
    </div>
  );
}

// ── Season comparison bars ────────────────────────────────────────────────────
function SeasonBars({ heatmapA, heatmapB, colorA, colorB }: { heatmapA: any; heatmapB: any; colorA: string; colorB: string }) {
  const seasonsA = heatmapA ? Object.keys(heatmapA).sort((a, b) => Number(a) - Number(b)) : [];
  const seasonsB = heatmapB ? Object.keys(heatmapB).sort((a, b) => Number(a) - Number(b)) : [];
  const allSeasons = Array.from(new Set([...seasonsA, ...seasonsB])).sort((a, b) => Number(a) - Number(b));

  const avg = (heatmap: any, season: string) => {
    const eps = heatmap?.[season]?.filter((e: any) => e.rating > 0) || [];
    if (!eps.length) return null;
    return eps.reduce((s: number, e: any) => s + e.rating, 0) / eps.length;
  };

  if (!allSeasons.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {allSeasons.map(s => {
        const a = avg(heatmapA, s);
        const b = avg(heatmapB, s);
        return (
          <div key={s} className="flex items-center gap-3">
            <span className="text-[11px] font-black w-6 shrink-0" style={{ color: '#222' }}>S{s}</span>
            <div className="flex-1 flex flex-col gap-1">
              {a !== null && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${Math.min(100, ((a - 5) / 5) * 100)}%`, backgroundColor: colorA, opacity: 0.85 }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-right" style={{ color: colorA }}>{a.toFixed(1)}</span>
                </div>
              )}
              {b !== null && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${Math.min(100, ((b - 5) / 5) * 100)}%`, backgroundColor: colorB, opacity: 0.85 }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-right" style={{ color: colorB }}>{b.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const COLOR_A = '#60a5fa'; // blue
const COLOR_B = '#f97316'; // orange

export default function ComparePage() {
  const router = useRouter();

  const [showA, setShowA]     = useState<any>(null);
  const [showB, setShowB]     = useState<any>(null);
  const [heatA, setHeatA]     = useState<any>(null);
  const [heatB, setHeatB]     = useState<any>(null);
  const [posterA, setPosterA] = useState<string | null>(null);
  const [posterB, setPosterB] = useState<string | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const selectA = async (show: any, heatmap: any, poster: string | null) => {
    setShowA(show); setHeatA(heatmap); setPosterA(poster);
  };
  const selectB = async (show: any, heatmap: any, poster: string | null) => {
    setShowB(show); setHeatB(heatmap); setPosterB(poster);
  };

  // Compute season averages
  const seasonAvgs = (heatmap: any) => {
    if (!heatmap) return {};
    const out: Record<string, number> = {};
    Object.keys(heatmap).forEach(s => {
      const eps = heatmap[s].filter((e: any) => e.rating > 0);
      if (eps.length) out[s] = eps.reduce((a: number, e: any) => a + e.rating, 0) / eps.length;
    });
    return out;
  };

  const avgsA = useMemo(() => seasonAvgs(heatA), [heatA]);
  const avgsB = useMemo(() => seasonAvgs(heatB), [heatB]);

  const overallA = useMemo(() => {
    const vals = Object.values(avgsA);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [avgsA]);

  const overallB = useMemo(() => {
    const vals = Object.values(avgsB);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [avgsB]);

  const stdDev = (heatmap: any) => {
    if (!heatmap) return 0;
    const all = Object.values(heatmap).flatMap((s: any) => s.filter((e: any) => e.rating > 0).map((e: any) => e.rating)) as number[];
    if (!all.length) return 0;
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    return Math.sqrt(all.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / all.length);
  };

  const bestSeason = (avgs: Record<string, number>) => {
    const entries = Object.entries(avgs);
    if (!entries.length) return 0;
    return Math.max(...entries.map(([, v]) => v));
  };

  const stdDevA = useMemo(() => stdDev(heatA), [heatA]);
  const stdDevB = useMemo(() => stdDev(heatB), [heatB]);
  const bestA   = useMemo(() => bestSeason(avgsA), [avgsA]);
  const bestB   = useMemo(() => bestSeason(avgsB), [avgsB]);

  const verdict = useMemo(() => {
    if (!showA || !showB || !overallA || !overallB) return null;

    const winnerShow  = overallA > overallB ? showA : overallB > overallA ? showB : null;
    const winnerColor = overallA > overallB ? COLOR_A : overallB > overallA ? COLOR_B : null;
    const loserShow   = overallA > overallB ? showB : overallB > overallA ? showA : null;
    const diff        = Math.abs(overallA - overallB);
    const tie         = diff < 0.1;

    // Margin label
    const margin = tie ? 'Too close to call'
      : diff < 0.3 ? 'Narrow edge'
      : diff < 0.7 ? 'Clear winner'
      : 'Dominant victory';

    // Category winners
    const betterConsistency = stdDevA < stdDevB ? showA : stdDevB < stdDevA ? showB : null;
    const betterPeak        = bestA   > bestB   ? showA : bestB   > bestA   ? showB : null;
    const moreVoted         = showA.numVotes > showB.numVotes ? showA : showB;

    // Reasons
    const reasons: { text: string; show: any; color: string }[] = [];
    if (!tie && winnerShow) {
      reasons.push({ text: `Higher episode avg (${(overallA > overallB ? overallA : overallB).toFixed(2)})`, show: winnerShow, color: winnerColor! });
    }
    if (betterConsistency) {
      const c = betterConsistency === showA ? COLOR_A : COLOR_B;
      reasons.push({ text: `More consistent (σ ${(betterConsistency === showA ? stdDevA : stdDevB).toFixed(2)})`, show: betterConsistency, color: c });
    }
    if (betterPeak) {
      const c = betterPeak === showA ? COLOR_A : COLOR_B;
      reasons.push({ text: `Higher peak season (${(betterPeak === showA ? bestA : bestB).toFixed(1)})`, show: betterPeak, color: c });
    }
    reasons.push({ text: `More popular (${fmtVotes(moreVoted.numVotes)} votes)`, show: moreVoted, color: moreVoted === showA ? COLOR_A : COLOR_B });

    return { winnerShow, winnerColor, loserShow, diff, margin, tie, reasons };
  }, [showA, showB, overallA, overallB, stdDevA, stdDevB, bestA, bestB, avgsA, avgsB]);

  const winner = overallA > overallB ? 'A' : overallB > overallA ? 'B' : null;
  const ready  = showA && showB;

  return (
    <div className="min-h-screen" style={{ background: '#080808', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeUp 0.4s ease both; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:#0a0a0a; }
        ::-webkit-scrollbar-thumb { background:#1e1e1e; border-radius:2px; }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <button onClick={() => router.push('/')} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm"
               style={{ background: '#DC143C', color: '#fff' }}>C</div>
          <span style={{ color: '#444', letterSpacing: 2, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
            Cinephile
          </span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
             style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <BarChart2 size={12} style={{ color: COLOR_A }} />
          <span style={{ color: COLOR_A, fontSize: 11, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>
            Compare
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* Hero */}
        <div className="mb-10">
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 5, color: '#1e1e1e', textTransform: 'uppercase', marginBottom: 10 }}>
            Head-to-Head
          </p>
          <h1 style={{ fontSize: 'clamp(36px,6vw,64px)', fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: '#fff', marginBottom: 8 }}>
            Show<br />
            <span style={{ color: COLOR_A }}>Comparison</span>
          </h1>
          <p style={{ color: '#2a2a2a', fontSize: 14, maxWidth: 360 }}>
            Pick two shows and see how they stack up episode by episode.
          </p>
        </div>

        {/* Search row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <ShowSlot side="A" color={COLOR_A} onSelect={selectA} />
          <ShowSlot side="B" color={COLOR_B} onSelect={selectB} />
        </div>

        {/* Empty state */}
        {!ready && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="flex items-center gap-4 opacity-20">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl"
                   style={{ background: COLOR_A, color: '#000' }}>A</div>
              <ArrowRight size={20} style={{ color: '#444' }} />
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl"
                   style={{ background: COLOR_B, color: '#000' }}>B</div>
            </div>
            <p style={{ color: '#1a1a1a', fontSize: 14 }}>Search for two shows above to compare</p>
          </div>
        )}

        {/* Comparison content */}
        {ready && (
          <div className="fade-in flex flex-col gap-10">

            {/* ── Show hero banners ── */}
            <div className="grid grid-cols-2 gap-4">
              {[{ show: showA, poster: posterA, heatmap: heatA, color: COLOR_A, side: 'A', overall: overallA },
                { show: showB, poster: posterB, heatmap: heatB, color: COLOR_B, side: 'B', overall: overallB }].map(({ show, poster, heatmap, color, side, overall }) => (
                <div key={side} className="relative rounded-2xl overflow-hidden cursor-pointer"
                     style={{ minHeight: 180, border: `1px solid ${color}20` }}
                     onClick={() => router.push(`/show/${show.tconst}`)}>
                  {poster && (
                    <>
                      <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover"
                           style={{ filter: 'blur(24px)', transform: 'scale(1.1)', opacity: 0.3 }} />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(8,8,8,0.95) 40%, rgba(8,8,8,0.5))' }} />
                    </>
                  )}
                  <div className="relative z-10 flex items-center gap-5 p-6">
                    {poster && (
                      <img src={poster} alt={show.primaryTitle} className="w-16 h-24 object-cover rounded-xl shrink-0"
                           style={{ border: `2px solid ${color}30` }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black"
                             style={{ background: color, color: '#000' }}>{side}</div>
                        <span style={{ color: color, fontSize: 10, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase' }}>
                          {winner === side ? '👑 Winner' : 'Contender'}
                        </span>
                      </div>
                      <h2 className="text-white font-black text-lg truncate mb-1">{show.primaryTitle}</h2>
                      <p style={{ color: '#444', fontSize: 12 }}>{show.startYear} · {show.genres?.split(',').slice(0, 2).join(', ')}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="px-2.5 py-1 rounded-lg text-sm font-black"
                             style={{ background: ratingColor(overall), color: ratingText(overall) }}>
                          {overall.toFixed(1)}
                        </div>
                        <span style={{ color: '#2a2a2a', fontSize: 11 }}>{fmtVotes(show.numVotes)} votes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Stat comparison ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Header */}
              <div className="grid items-center px-6 py-4" style={{ gridTemplateColumns: '1fr auto 1fr', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md" style={{ background: COLOR_A }} />
                  <span className="font-black text-sm truncate">{showA.primaryTitle}</span>
                </div>
                <span style={{ color: '#1a1a1a', fontSize: 10, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', padding: '0 24px' }}>vs</span>
                <div className="flex items-center justify-end gap-2">
                  <span className="font-black text-sm truncate">{showB.primaryTitle}</span>
                  <div className="w-4 h-4 rounded-md" style={{ background: COLOR_B }} />
                </div>
              </div>

              <div className="px-6 py-2">
                <StatRow label="Overall avg"    valA={overallA}                    valB={overallB} />
                <StatRow label="IMDb rating"    valA={Number(showA.averageRating)} valB={Number(showB.averageRating)} />
                <StatRow label="Best season"    valA={bestA}                       valB={bestB} />
                <StatRow label="Consistency σ"  valA={stdDevA}                     valB={stdDevB} higherIsBetter={false} format={v => v.toFixed(2)} />
                <StatRow label="Seasons"        valA={Object.keys(avgsA).length}   valB={Object.keys(avgsB).length} format={v => String(Math.round(v))} />
                <StatRow label="Total votes"    valA={showA.numVotes}              valB={showB.numVotes} format={v => fmtVotes(Math.round(v))} />
              </div>
            </div>

            {/* ── Verdict ── */}
            {verdict && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: `1px solid ${verdict.winnerColor ? verdict.winnerColor + '25' : 'rgba(255,255,255,0.06)'}` }}>
                {/* Crown banner */}
                <div className="px-6 pt-6 pb-5 flex items-center gap-5"
                     style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                       style={{ background: verdict.tie ? 'rgba(255,255,255,0.04)' : `${verdict.winnerColor}15`, border: `1px solid ${verdict.winnerColor ? verdict.winnerColor + '25' : 'rgba(255,255,255,0.08)'}` }}>
                    {verdict.tie ? '🤝' : '👑'}
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 4, color: '#1e1e1e', textTransform: 'uppercase', marginBottom: 4 }}>
                      {verdict.margin}
                    </p>
                    {verdict.tie ? (
                      <p className="text-white font-black text-xl">It's a draw</p>
                    ) : (
                      <p className="text-white font-black text-xl">
                        <span style={{ color: verdict.winnerColor! }}>{verdict.winnerShow.primaryTitle}</span>
                        {' '}wins
                      </p>
                    )}
                    <p style={{ color: '#2a2a2a', fontSize: 12, marginTop: 4 }}>
                      {verdict.tie
                        ? `Both shows scored within ${verdict.diff.toFixed(2)} points of each other`
                        : `Beats ${verdict.loserShow?.primaryTitle} by ${verdict.diff.toFixed(2)} points overall`}
                    </p>
                  </div>
                </div>

                {/* Reason pills */}
                <div className="px-6 py-5 flex flex-wrap gap-3">
                  {verdict.reasons.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                         style={{ background: `${r.color}10`, border: `1px solid ${r.color}20` }}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                      <span style={{ color: r.color, fontSize: 12, fontWeight: 700 }}>{r.show.primaryTitle}</span>
                      <span style={{ color: '#333', fontSize: 12 }}>— {r.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Season-by-season bars ── */}
            <div className="rounded-2xl p-6" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-3 mb-6">
                <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 4, color: '#1e1e1e', textTransform: 'uppercase' }}>Season by Season</p>
                <div className="flex items-center gap-4 ml-auto">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: COLOR_A }} />
                    <span style={{ color: '#333', fontSize: 11 }}>{showA.primaryTitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: COLOR_B }} />
                    <span style={{ color: '#333', fontSize: 11 }}>{showB.primaryTitle}</span>
                  </div>
                </div>
              </div>
              <SeasonBars heatmapA={heatA} heatmapB={heatB} colorA={COLOR_A} colorB={COLOR_B} />
            </div>

            {/* ── Side-by-side heatmaps ── */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 4, color: '#1e1e1e', textTransform: 'uppercase', marginBottom: 16 }}>
                Episode Heatmaps
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-sm" style={{ background: COLOR_A }} />
                    <span className="text-sm font-bold text-white">{showA.primaryTitle}</span>
                  </div>
                  <MiniHeatmap heatmap={heatA} color={COLOR_A} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-sm" style={{ background: COLOR_B }} />
                    <span className="text-sm font-bold text-white">{showB.primaryTitle}</span>
                  </div>
                  <MiniHeatmap heatmap={heatB} color={COLOR_B} />
                </div>
              </div>
            </div>

            {/* ── CTA to full pages ── */}
            <div className="grid grid-cols-2 gap-4">
              {[{ show: showA, color: COLOR_A }, { show: showB, color: COLOR_B }].map(({ show, color }) => (
                <button key={show.tconst} onClick={() => router.push(`/show/${show.tconst}`)}
                        className="flex items-center justify-between px-5 py-4 rounded-2xl transition-all"
                        style={{ background: `${color}08`, border: `1px solid ${color}20` }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${color}14`)}
                        onMouseLeave={e => (e.currentTarget.style.background = `${color}08`)}>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">{show.primaryTitle}</p>
                    <p style={{ color: '#333', fontSize: 11, marginTop: 2 }}>View full analysis →</p>
                  </div>
                  <ArrowRight size={16} style={{ color }} />
                </button>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}