'use client';

import { useEffect, useState, use, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from 'recharts';
import { Trophy, TrendingDown, Activity, Download, ArrowLeft, Globe, Star, Users, X, ExternalLink, Film, Clock, Calendar, ChevronLeft, ChevronRight, Share2, Copy, Check, BarChart2, Bookmark, BookmarkCheck, Plus } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';

// ═══════════════════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const API_URL = process.env.NEXT_PUBLIC_API_URL || "${API_URL}";


// ─── Poster fetch with fallback (same as homepage) ──────────────────────────
async function fetchPosterWithFallback(tconst: string, title: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${tconst}`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const d = await r.json(); const img = d?.image?.original || d?.image?.medium; if (img) return img; }
  } catch {}
  try {
    const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { const results = await r.json(); if (results?.length > 0) { const img = results[0]?.show?.image?.original || results[0]?.show?.image?.medium; if (img) return img; } }
  } catch {}
  return null;
}

// ─── Rec Card ────────────────────────────────────────────────────────────────
function RecCard({ show }: { show: any }) {
  const [poster, setPoster] = useState<string | null>(null);
  const { inList, add, remove } = useWatchlist();
  const listed = inList(show.tconst);

  useEffect(() => {
    fetchPosterWithFallback(show.tconst, show.primaryTitle).then(p => { if (p) setPoster(p); });
  }, [show.tconst]);

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
        poster: poster ?? null,
        status: 'want',
        myRating: null,
      });
    }
  };

  return (
    <Link href={`/show/${show.tconst}`} className="group relative flex flex-col cursor-pointer">
      <div className="relative w-full overflow-hidden rounded-xl bg-[#111]" style={{ aspectRatio: '2/3' }}>
        {poster
          ? <img src={poster} alt={show.primaryTitle} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
          : <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]">
              <div className="text-3xl opacity-20">📺</div>
            </div>
        }
        {/* Rating badge */}
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-yellow-500/30 rounded-md px-1.5 py-0.5">
            <span className="text-yellow-400 text-[9px]">★</span>
            <span className="text-white text-[10px] font-bold">{show.averageRating?.toFixed(1)}</span>
          </div>
        </div>
        {/* Watchlist + button */}
        <button
          onClick={handleWatchlist}
          title={listed ? 'Remove from Watchlist' : 'Add to Watchlist'}
          className="absolute bottom-2 left-2 z-30 flex items-center justify-center transition-all duration-200"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: listed ? 'rgba(245,197,24,0.90)' : 'rgba(0,0,0,0.75)',
            border: `1.5px solid ${listed ? '#F5C518' : 'rgba(255,255,255,0.25)'}`,
            backdropFilter: 'blur(8px)',
            boxShadow: listed ? '0 0 10px rgba(245,197,24,0.4)' : 'none',
          }}>
          {listed
            ? <Check size={13} style={{ color: '#000', strokeWidth: 3 }} />
            : <Plus  size={14} style={{ color: '#fff', strokeWidth: 2.5 }} />}
        </button>
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
             style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.15)' }} />
      </div>
      <div className="pt-2.5 px-0.5">
        <h3 className="text-white font-bold text-xs leading-tight truncate group-hover:text-yellow-400 transition-colors">{show.primaryTitle}</h3>
        <p className="text-[#555] text-[11px] mt-0.5">{show.startYear}</p>
      </div>
    </Link>
  );
}

// ─── Episode Modal ──────────────────────────────────────────────────────────
function EpisodeModal({ ep, detail, loading, onClose, onPrev, onNext, hasPrev, hasNext, getRatingHexBox, getTextColor, stripHtml }: any) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const ratingColor = getRatingHexBox(ep?.rating);
  const ratingLabel = !ep?.rating ? 'N/A'
    : ep.rating >= 9.0 ? 'Awesome' : ep.rating >= 8.0 ? 'Great'
    : ep.rating >= 6.0 ? 'Good' : ep.rating >= 5.0 ? 'Bad' : 'Garbage';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)' }}
           onClick={e => e.stopPropagation()}>

        {/* Header image strip — blurred screenshot if available */}
        {detail?.image?.original && (
          <div className="relative h-48 overflow-hidden">
            <img src={detail.image.original} alt="" className="w-full h-full object-cover"
                 style={{ filter: 'blur(2px) brightness(0.5)', transform: 'scale(1.05)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0e0e0e 0%, transparent 60%)' }} />
            {/* Big rating badge over image */}
            <div className="absolute bottom-4 left-6 flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl font-black text-2xl"
                   style={{ backgroundColor: ratingColor, color: getTextColor(ep?.rating) }}>
                {ep?.rating?.toFixed(1) ?? '—'}
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">{ep?.title}</p>
                <p className="text-white/50 text-sm">Season {ep?.season} · Episode {ep?.episode}</p>
              </div>
            </div>
          </div>
        )}

        {/* If no image, show a compact header */}
        {!detail?.image?.original && (
          <div className="px-6 pt-6 pb-4 flex items-start gap-4">
            <div className="px-4 py-3 rounded-xl font-black text-2xl shrink-0"
                 style={{ backgroundColor: ratingColor, color: getTextColor(ep?.rating) }}>
              {ep?.rating?.toFixed(1) ?? '—'}
            </div>
            <div>
              <p className="text-white font-black text-xl leading-tight">{ep?.title}</p>
              <p className="text-white/40 text-sm mt-1">Season {ep?.season} · Episode {ep?.episode}</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 pb-6">
          {/* Rating quality pill */}
          <div className="flex items-center gap-3 mb-5 mt-2">
            <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider"
                  style={{ backgroundColor: ratingColor + '22', color: ratingColor, border: `1px solid ${ratingColor}44` }}>
              {ratingLabel}
            </span>
            {detail?.runtime && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs font-medium">
                <Clock size={11} /> {detail.runtime} min
              </span>
            )}
            {detail?.airdate && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs font-medium">
                <Calendar size={11} /> {detail.airdate}
              </span>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-3 py-6">
              <div className="w-5 h-5 border-2 border-[#222] border-t-white/30 rounded-full animate-spin" />
              <span className="text-[#444] text-sm">Fetching episode details…</span>
            </div>
          )}

          {/* Summary */}
          {!loading && (
            <>
              {detail?.summary ? (
                <p className="text-[#999] text-sm leading-relaxed mb-5">{stripHtml(detail.summary)}</p>
              ) : (
                <p className="text-[#444] text-sm italic mb-5">No synopsis available.</p>
              )}

              {/* Guest cast */}
              {detail?._embedded?.guestcast?.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-black tracking-[3px] text-[#444] uppercase mb-3">Guest Stars</p>
                  <div className="flex flex-wrap gap-2">
                    {detail._embedded.guestcast.slice(0, 8).map((gc: any) => (
                      <div key={gc.person?.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {gc.person?.image?.medium && (
                          <img src={gc.person.image.medium} alt="" className="w-5 h-5 rounded-full object-cover" />
                        )}
                        <div>
                          <p className="text-white text-xs font-bold leading-none">{gc.person?.name}</p>
                          {gc.character?.name && <p className="text-[#555] text-[10px] leading-none mt-0.5">as {gc.character.name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Crew highlights */}
              {detail?._embedded?.crew?.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-black tracking-[3px] text-[#444] uppercase mb-3">Crew</p>
                  <div className="flex flex-wrap gap-2">
                    {detail._embedded.crew
                      .filter((c: any) => ['Director','Writer','Executive Producer'].includes(c.type))
                      .slice(0, 6)
                      .map((c: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 rounded-xl"
                           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-[#555] text-[10px] leading-none">{c.type}</p>
                        <p className="text-white text-xs font-bold leading-none mt-0.5">{c.person?.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <button onClick={onPrev} disabled={!hasPrev}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-20"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <ChevronLeft size={16} className="text-white" />
              </button>
              <button onClick={onNext} disabled={!hasNext}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-20"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <ChevronRight size={16} className="text-white" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {ep?.ep_tconst && (
                <a href={`https://www.imdb.com/title/${ep.ep_tconst}`} target="_blank" rel="noreferrer"
                   className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                   style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.2)', color: '#F5C518' }}>
                  <ExternalLink size={11} /> IMDb
                </a>
              )}
              <button onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}>
                <X size={11} /> Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Share Card Modal ────────────────────────────────────────────────────────
function ShareCardModal({ metadata, dbStats, chartData, volatility, onClose }: {
  metadata: any; dbStats: { rating: string; votes: number | null };
  chartData: any; volatility: any; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);

  const colorForScore = (r: number) => r >= 9 ? '#006400' : r >= 8 ? '#90EE90' : r >= 6 ? '#D4AF37' : r >= 5 ? '#DC143C' : '#800080';
  const fmt = (d: string | null | undefined, e: string | null | undefined) => {
    const s = d ? d.substring(0,4) : null; const en = e ? e.substring(0,4) : null;
    if (!s) return ''; if (!en || en === s) return s; return `${s}–${en}`;
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !metadata) return;
    const ctx = canvas.getContext('2d')!;
    const CARD_W = 1200, CARD_H = 630, POSTER_W = 340;
    canvas.width = CARD_W; canvas.height = CARD_H;

    const drawRightPanel = () => {
      const LEFT = 420, RIGHT_W = CARD_W - LEFT - 50;

      // Branding
      ctx.fillStyle = '#e53e3e';
      ctx.beginPath(); ctx.roundRect(LEFT, 48, 30, 30, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('C', LEFT + 15, 48 + 20); ctx.textAlign = 'left';
      ctx.fillStyle = '#444'; ctx.font = '700 12px sans-serif';
      ctx.fillText('CINEPHILE  ·  TV ANALYTICS', LEFT + 42, 68);

      // Title with word wrap
      ctx.fillStyle = '#fff'; ctx.font = '900 54px sans-serif';
      const words = (metadata.name as string).split(' ');
      let line = ''; const lines: string[] = [];
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > RIGHT_W && line) { lines.push(line); line = w; } else { line = test; }
      }
      if (line) lines.push(line);
      let ty = 130;
      for (const l of lines.slice(0, 2)) { ctx.fillText(l, LEFT, ty); ty += 60; }

      // Year · Genre
      ctx.fillStyle = '#666'; ctx.font = '400 17px sans-serif';
      const yearStr = fmt(metadata?.premiered, metadata?.ended);
      const genreStr = metadata.genres?.slice(0, 2).join(' · ') || '';
      ctx.fillText(`${yearStr}  ·  ${genreStr}`, LEFT, ty + 6); ty += 40;

      // Rating
      ctx.fillStyle = '#F5C518'; ctx.font = '700 20px sans-serif'; ctx.fillText('★', LEFT, ty + 34);
      ctx.fillStyle = '#fff'; ctx.font = '900 52px sans-serif'; ctx.fillText(dbStats.rating, LEFT + 28, ty + 40);
      const rW = ctx.measureText(dbStats.rating).width;
      ctx.fillStyle = '#444'; ctx.font = '400 22px sans-serif'; ctx.fillText('/10', LEFT + 28 + rW + 6, ty + 30);

      // Volatility badge
      if (volatility) {
        const bx = LEFT + 28 + rW + 76, by = ty + 10;
        ctx.fillStyle = volatility.color + '25'; ctx.beginPath(); ctx.roundRect(bx, by, 130, 30, 7); ctx.fill();
        ctx.fillStyle = volatility.color; ctx.font = '700 14px sans-serif';
        ctx.fillText(`${volatility.icon}  ${volatility.label}`, bx + 10, by + 20);
      }
      ty += 72;

      // Season rating bars
      const seasons = chartData.seasons;
      if (seasons.length > 0) {
        ctx.fillStyle = '#2a2a2a'; ctx.font = '700 11px sans-serif'; ctx.fillText('SEASON RATINGS', LEFT, ty); ty += 16;
        const barH = 30, gap = 5;
        const barW = Math.min(58, (RIGHT_W - (seasons.length - 1) * gap) / seasons.length);
        seasons.forEach((s: any, i: number) => {
          const x = LEFT + i * (barW + gap);
          ctx.fillStyle = colorForScore(s.rating); ctx.beginPath(); ctx.roundRect(x, ty, barW, barH, 5); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(s.rating.toFixed(1), x + barW / 2, ty + barH / 2 + 4);
          ctx.fillStyle = '#444'; ctx.font = '10px sans-serif';
          ctx.fillText(`S${s.rawSeason}`, x + barW / 2, ty + barH + 14);
          ctx.textAlign = 'left';
        });
        ty += barH + 28;
      }

      // Top episode
      const top = chartData.topEps?.[0];
      if (top) {
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.roundRect(LEFT, ty, RIGHT_W, 58, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(245,197,24,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#F5C518'; ctx.font = '700 10px sans-serif'; ctx.fillText('⭐ TOP EPISODE', LEFT + 16, ty + 18);
        ctx.fillStyle = '#fff'; ctx.font = '700 15px sans-serif';
        const epTitle = top.title ? (top.title.length > 40 ? top.title.slice(0, 38) + '…' : top.title) : `S${top.season}E${top.episode}`;
        ctx.fillText(epTitle, LEFT + 16, ty + 40);
        ctx.fillStyle = '#90EE90'; ctx.font = '700 15px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(`★ ${top.rating}`, LEFT + RIGHT_W - 16, ty + 40); ctx.textAlign = 'left';
      }

      // Footer
      ctx.fillStyle = '#2a2a2a'; ctx.font = '12px sans-serif'; ctx.fillText('cinephile.app', LEFT, CARD_H - 28);

      setGenerating(false); setGenerated(true);
    };

    // Dark background
    ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.015)'; ctx.lineWidth = 1;
    for (let x = 0; x < CARD_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke(); }
    for (let y = 0; y < CARD_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke(); }

    // Red accent glow top-left
    const glow = ctx.createRadialGradient(200, 0, 0, 200, 0, 400);
    glow.addColorStop(0, 'rgba(229,62,62,0.08)'); glow.addColorStop(1, 'rgba(229,62,62,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Load + draw poster
    const posterUrl = metadata?.image?.original || metadata?.image?.medium || null;
    if (posterUrl) {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.save();
        const r = 14;
        ctx.beginPath();
        ctx.moveTo(40 + r, 40); ctx.lineTo(40 + POSTER_W - r, 40);
        ctx.quadraticCurveTo(40 + POSTER_W, 40, 40 + POSTER_W, 40 + r);
        ctx.lineTo(40 + POSTER_W, CARD_H - 40 - r);
        ctx.quadraticCurveTo(40 + POSTER_W, CARD_H - 40, 40 + POSTER_W - r, CARD_H - 40);
        ctx.lineTo(40 + r, CARD_H - 40);
        ctx.quadraticCurveTo(40, CARD_H - 40, 40, CARD_H - 40 - r);
        ctx.lineTo(40, 40 + r);
        ctx.quadraticCurveTo(40, 40, 40 + r, 40);
        ctx.closePath(); ctx.clip();
        ctx.drawImage(img, 40, 40, POSTER_W, CARD_H - 80);
        ctx.restore();
        // Fade edge
        const fade = ctx.createLinearGradient(40 + POSTER_W - 100, 0, 40 + POSTER_W, 0);
        fade.addColorStop(0, 'rgba(8,8,8,0)'); fade.addColorStop(1, 'rgba(8,8,8,1)');
        ctx.fillStyle = fade; ctx.fillRect(40, 40, POSTER_W, CARD_H - 80);
        drawRightPanel();
      };
      img.onerror = () => {
        ctx.fillStyle = '#111'; ctx.fillRect(40, 40, POSTER_W, CARD_H - 80);
        drawRightPanel();
      };
      img.src = posterUrl;
    } else {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(40, 40, POSTER_W, CARD_H - 80, 14); ctx.fill();
      drawRightPanel();
    }
  }, [metadata, dbStats, chartData, volatility]);

  const download = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${(metadata?.name || 'show').replace(/[^a-z0-9]/gi, '_')}_card.png`;
    a.href = canvas.toDataURL('image/png'); a.click();
  };

  const copyImage = async () => {
    const canvas = canvasRef.current; if (!canvas) return;
    try {
      canvas.toBlob(async blob => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden"
           style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2"><Share2 size={16} className="text-purple-400" /> Share Card</h2>
            <p className="text-[#444] text-xs mt-0.5">1200 × 630 · optimized for Twitter / Open Graph</p>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-white transition-colors p-1"><X size={20} /></button>
        </div>
        {/* Preview */}
        <div className="p-6 pb-4">
          <div className="relative rounded-xl overflow-hidden bg-[#111] border border-white/5" style={{ aspectRatio: '1200/630' }}>
            <canvas ref={canvasRef} className="w-full h-full" />
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#222] border-t-purple-400 rounded-full animate-spin" />
                  <p className="text-[#555] text-sm">Generating…</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-3 px-6 pb-6">
          <button onClick={download} disabled={!generated}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-30"
            style={{ background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}>
            <Download size={14} /> Download PNG
          </button>
          <button onClick={copyImage} disabled={!generated}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: copied ? '#4ade80' : '#888' }}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Image</>}
          </button>
          <div className="ml-auto">
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${metadata?.name || ''} on CINEPHILE 📺`)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
               target="_blank" rel="noreferrer"
               className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all"
               style={{ background: 'rgba(29,161,242,0.08)', borderColor: 'rgba(29,161,242,0.2)', color: '#1DA1F2' }}>
              𝕏 Share on Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ShowAnalytics({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { inList, getEntry, add, remove, setStatus, setMyRating } = useWatchlist();
  const [wlOpen, setWlOpen] = useState(false);

  const [heatmap, setHeatmap] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [dbStats, setDbStats] = useState<{ rating: string; votes: number | null }>({ rating: "0.0", votes: null });
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [viewMode, setViewMode] = useState<'Episodes' | 'Seasons'>('Episodes');
  const [showTrendline, setShowTrendline] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const [selectedEp, setSelectedEp] = useState<any>(null);
  const [epDetail, setEpDetail] = useState<any>(null);
  const [epDetailLoading, setEpDetailLoading] = useState(false);
  const [allEpisodesList, setAllEpisodesList] = useState<any[]>([]);

  // ── helpers ──
  const getRatingHexBox = (rating: number) => {
    if (!rating) return '#282828';
    if (rating >= 9.0) return '#006400';   // dark green  — Awesome
    if (rating >= 8.0) return '#90EE90';   // light green — Great
    if (rating >= 6.0) return '#D4AF37';   // gold        — Good (6–7.9)
    if (rating >= 5.0) return '#DC143C';   // red         — Bad (5–5.9)
    return '#800080';                       // purple      — Garbage (<5)
  };
  const getTextColor = (rating: number) => {
    if (!rating) return '#888888';
    if (rating >= 9.0) return '#ffffff';
    if (rating >= 8.0) return '#000000';
    if (rating >= 6.0) return '#000000';   // gold bg — dark text
    if (rating >= 5.0) return '#ffffff';
    return '#ffffff';
  };
  const formatYearRange = (premiered?: string, ended?: string) => {
    const s = premiered ? premiered.substring(0, 4) : null;
    const e = ended ? ended.substring(0, 4) : null;
    if (!s) return "????";
    if (!e) return `${s}–`;
    if (s === e) return s;
    return `${s}–${e}`;
  };
  const stripHtml = (html: string) => html ? html.replace(/<[^>]*>?/gm, '') : "";

  // ── derived ──
  const posterSrc = metadata?.image?.original || metadata?.image?.medium || null;
  const yearRange = formatYearRange(metadata?.premiered, metadata?.ended);

  // ── fetchData ──
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };



// REPLACE your fetchData function with this (around line 600 in page.tsx)

const fetchData = useCallback((mode: 'db' | 'live') => {
  if (mode === 'live') setIsScraping(true);
  
  fetch(`${API_URL}/api/heatmap?id=${id}&mode=${mode}`)
    .then(res => res.json())
    .then(data => {
      console.log('Backend response:', data);
      
      if (data.status === 'success' && data.data) {
        setHeatmap(data.data);
        if (mode === 'live') {
          showToast('IMDb ratings updated to latest!', 'success');
        }
      } else {
        console.warn("Backend returned:", data);
        if (mode === 'live') {
          showToast(data.message || 'Live refresh failed — showing cached data');
        }
      }
    })
    .catch(err => { 
      console.error("Network error:", err);
      if (mode === 'live') showToast('Could not reach backend'); 
    })
    .finally(() => {
      setLoading(false); 
      setIsScraping(false);
    });
}, [id]); // Add dependency array

// Then in useEffect, wrap it properly:
useEffect(() => {
  if (id) {
    setLoading(true);
    fetchData('db');
  }
}, [id, fetchData]);    // Add fetchData to dependencies
  


  // ── useEffect ──
  useEffect(() => {
    // Primary: fetch rating directly by tconst — no vote filter, no title ambiguity
    fetch(`${API_URL}/api/show/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.data?.averageRating) {
          setDbStats({ rating: Number(data.data.averageRating).toFixed(1), votes: data.data.numVotes ?? null });
        }
      }).catch(() => {});

    fetch(`https://api.tvmaze.com/lookup/shows?imdb=${id}`)
      .then(res => res.json())
      .then(tvmazeData => {
        setMetadata(tvmazeData);
      }).catch(() => {});
    fetch(`${API_URL}/api/recommendations?id=${id}`)
      .then(res => res.json()).then(data => { if (data.status === 'success') setRecs(data.data); }).catch(() => {});
    fetchData('db');
  }, [id]);

  // ── maxEpisodes ──
  const maxEpisodes = useMemo(() => {
    if (!heatmap) return 0;
    let max = 0;
    Object.values(heatmap).forEach((season: any) => { season.forEach((ep: any) => { if (ep.episode > max) max = ep.episode; }); });
    return max;
  }, [heatmap]);

  // ── chartData ──
  const chartData = useMemo(() => {
    if (!heatmap) return { episodes: [], seasons: [], boundaries: [], yAxisMin: 0, topEps: [], overallRating: "0.0" };
    const flatEps: any[] = []; const boundaries: any[] = [];
    let absCount = 1; let totalRating = 0; let ratingCount = 0;
    Object.keys(heatmap).forEach(season => {
      let seasonStart = absCount; let added = false;
      heatmap[season].forEach((ep: any) => {
        if (ep.rating > 0) {
          flatEps.push({ absolute_episode: absCount, season: parseInt(season), episode: ep.episode, title: ep.title, rating: ep.rating, color: getRatingHexBox(ep.rating), ep_tconst: ep.ep_tconst });
          totalRating += ep.rating; ratingCount++; absCount++; added = true;
        }
      });
      if (added) boundaries.push({ season: parseInt(season), start: seasonStart, end: absCount - 1 });
    });
    const windowSize = Math.max(3, Math.floor(flatEps.length / 15)); const halfWindow = Math.floor(windowSize / 2);
    const episodesWithTrend = flatEps.map((ep, i, arr) => {
      let start = Math.max(0, i - halfWindow); let end = Math.min(arr.length - 1, i + halfWindow);
      let sum = 0; let count = 0;
      for (let j = start; j <= end; j++) { sum += arr[j].rating; count++; }
      return { ...ep, trend: Number((sum / count).toFixed(2)) };
    });
    const seasonAvgs = boundaries.map(b => {
      const eps = flatEps.filter(e => e.season === b.season);
      const avg = eps.reduce((sum, e) => sum + e.rating, 0) / eps.length;
      return { season: `S${b.season}`, rawSeason: b.season, rating: Number(avg.toFixed(1)), color: getRatingHexBox(avg) };
    });
    const minRating = flatEps.length > 0 ? Math.min(...flatEps.map(e => e.rating)) : 0;
    const yAxisMin = Math.max(0, Math.floor(minRating) - 1);
    const overallRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : "0.0";
    // Only use episode average as fallback if we have no real IMDb show-level rating
    if (dbStats.rating === "0.0" && overallRating !== "0.0") setDbStats(prev => prev.rating === "0.0" ? { ...prev, rating: overallRating } : prev);
    return { episodes: episodesWithTrend, seasons: seasonAvgs, boundaries, yAxisMin, topEps: [...flatEps].sort((a, b) => b.rating - a.rating).slice(0, 5), overallRating };
  }, [heatmap, dbStats.rating]);

  // ── lifecycle ──
  const lifecycle = useMemo(() => {
    const sa = chartData.seasons;
    if (sa.length < 2) return null;
    let peak = sa[0]; let downfall = null; let maxDrop = 0;
    for (let i = 0; i < sa.length; i++) {
      if (sa[i].rating > peak.rating) peak = sa[i];
      if (i > 0) { const drop = sa[i - 1].rating - sa[i].rating; if (drop > 0.5 && drop > maxDrop) { maxDrop = drop; downfall = { from: sa[i - 1], to: sa[i], drop }; } }
    }
    return { peak, downfall };
  }, [chartData.seasons]);

  // ── volatility score ──
  const volatility = useMemo(() => {
    const eps = chartData.episodes;
    if (eps.length < 3) return null;
    const ratings = eps.map((e: any) => e.rating);
    const mean = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;
    const variance = ratings.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / ratings.length;
    const stdDev = Math.sqrt(variance);

    // Classify
    let label: string, color: string, icon: string, description: string;
    if (stdDev < 0.4) {
      label = 'Rock Solid'; color = '#4ade80'; icon = '🪨';
      description = `Ratings barely budge — this show is remarkably consistent episode to episode (σ = ${stdDev.toFixed(2)}).`;
    } else if (stdDev < 0.7) {
      label = 'Steady'; color = '#86efac'; icon = '📊';
      description = `Minor ups and downs, but quality stays in a reliable band (σ = ${stdDev.toFixed(2)}).`;
    } else if (stdDev < 1.0) {
      label = 'Uneven'; color = '#D4AF37'; icon = '〰️';
      description = `Noticeable swings between great episodes and weaker ones (σ = ${stdDev.toFixed(2)}).`;
    } else if (stdDev < 1.4) {
      label = 'Volatile'; color = '#f97316'; icon = '🎢';
      description = `Wild rating swings — highs are high, lows are painful (σ = ${stdDev.toFixed(2)}).`;
    } else {
      label = 'Chaotic'; color = '#DC143C'; icon = '🌪️';
      description = `Extreme inconsistency — ratings all over the map (σ = ${stdDev.toFixed(2)}).`;
    }

    // Find biggest episode spike and drop
    let biggestSpike = { delta: 0, ep: null as any };
    let biggestDrop = { delta: 0, ep: null as any };
    for (let i = 1; i < eps.length; i++) {
      const delta = eps[i].rating - eps[i - 1].rating;
      if (delta > biggestSpike.delta) { biggestSpike = { delta, ep: eps[i] }; }
      if (-delta > biggestDrop.delta) { biggestDrop = { delta: -delta, ep: eps[i] }; }
    }

    return { stdDev, label, color, icon, description, biggestSpike, biggestDrop, mean };
  }, [chartData.episodes]);

  // ── watchGuide ──
  const watchGuide = useMemo(() => {
    const seasons = chartData.seasons;
    const eps = chartData.episodes;
    if (seasons.length === 0 || eps.length === 0) return null;

    const s1Eps = eps.filter((e: any) => e.season === 1);
    const s1Season = seasons.find((s: any) => s.rawSeason === 1);

    // Detect anthology using genres from metadata (most reliable signal)
    const genreStr = (metadata?.genres?.join?.(',') || '').toLowerCase();
    const isAnthologyGenre = ['anthology', 'talk-show', 'game-show', 'reality', 'documentary', 'news', 'sport']
      .some(g => genreStr.includes(g));

    // Fallback heuristic: very high variance AND short seasons AND many seasons
    // Use a high threshold (2.5+) to avoid flagging review-bombed narrative shows
    const isLikelyAnthology = (() => {
      if (isAnthologyGenre) return true;
      if (seasons.length < 2) return false;
      const ratings = seasons.map((s: any) => s.rating);
      const max = Math.max(...ratings), min = Math.min(...ratings);
      const avgEpCount = eps.length / seasons.length;
      // Only flag as anthology if variance is extreme (2.5+) AND seasons are very short
      return (max - min) > 2.5 && avgEpCount <= 8 && seasons.length >= 3;
    })();

    // S1 hook analysis
    const s1Ratings = s1Eps.map((e: any) => e.rating);
    const s1OpenerAvg = s1Ratings.slice(0, Math.min(3, s1Ratings.length))
      .reduce((a: number, b: number) => a + b, 0) / Math.min(3, s1Ratings.length) || 0;

    // Find the episode where it "clicks" — first run of 2+ consecutive eps above 8.0
    let clicksAtEp: number | null = null;
    for (let i = 0; i < s1Eps.length - 1; i++) {
      if (s1Eps[i].rating >= 8.0 && s1Eps[i + 1]?.rating >= 8.0) {
        clicksAtEp = s1Eps[i].episode;
        break;
      }
    }
    // Fallback: first episode above 8.0
    if (!clicksAtEp) {
      const firstGood = s1Eps.find((e: any) => e.rating >= 8.0);
      clicksAtEp = firstGood?.episode || null;
    }

    // Best single season (for anthology recommendation)
    const bestSeason = [...seasons].sort((a: any, b: any) => b.rating - a.rating)[0];

    // S1 momentum: does it improve?
    const s1Momentum = s1Ratings.length >= 4
      ? (s1Ratings.slice(Math.floor(s1Ratings.length / 2)).reduce((a: number, b: number) => a + b, 0) / Math.ceil(s1Ratings.length / 2))
      - (s1Ratings.slice(0, Math.floor(s1Ratings.length / 2)).reduce((a: number, b: number) => a + b, 0) / Math.floor(s1Ratings.length / 2))
      : 0;

    // Verdict — brutally honest, based on ACTUAL quality first
    let verdict: string, verdictColor: string, verdictIcon: string;
    const overallAvg = chartData.seasons.reduce((a: number, s: any) => a + s.rating, 0) / Math.max(1, chartData.seasons.length);

    if (!s1Season) {
      verdict = 'Start anywhere'; verdictColor = '#a78bfa'; verdictIcon = '🎲';
    } else if (isLikelyAnthology) {
      verdict = 'Anthology — pick your season'; verdictColor = '#a78bfa'; verdictIcon = '🎲';
    } else if (overallAvg < 5.0) {
      verdict = 'Skip it'; verdictColor = '#800080'; verdictIcon = '💀';
    } else if (overallAvg < 6.0) {
      verdict = 'Not worth your time'; verdictColor = '#DC143C'; verdictIcon = '👎';
    } else if (overallAvg < 6.8) {
      // Mediocre — only say "gets better" if it genuinely does
      if (s1Momentum > 0.5 && overallAvg >= 6.3) {
        verdict = 'Starts weak, improves'; verdictColor = '#f97316'; verdictIcon = '📈';
      } else {
        verdict = 'Below average throughout'; verdictColor = '#f97316'; verdictIcon = '😐';
      }
    } else if (s1OpenerAvg >= 8.5) {
      verdict = 'Hooks you immediately'; verdictColor = '#4ade80'; verdictIcon = '⚡';
    } else if (s1OpenerAvg >= 7.5 || s1Momentum > 0.3) {
      verdict = 'Slow burn — worth it'; verdictColor = '#D4AF37'; verdictIcon = '🔥';
    } else {
      verdict = 'Solid throughout'; verdictColor = '#90EE90'; verdictIcon = '✓';
    }

    return {
      isLikelyAnthology, bestSeason, s1Season, s1OpenerAvg, clicksAtEp,
      s1Momentum, verdict, verdictColor, verdictIcon, s1EpCount: s1Eps.length
    };
  }, [chartData.seasons, chartData.episodes]);

  // ── allEpisodesList: flat sorted list for prev/next navigation ──
  useEffect(() => {
    if (!heatmap) return;
    const flat: any[] = [];
    Object.keys(heatmap).sort((a,b) => Number(a)-Number(b)).forEach(season => {
      heatmap[season].forEach((ep: any) => {
        if (ep.rating > 0) flat.push({ ...ep, season: Number(season) });
      });
    });
    setAllEpisodesList(flat);
  }, [heatmap]);

  // ── openEpisodeModal: fetch TVMaze episode detail ──
  const openEpisodeModal = useCallback(async (ep: any) => {
    setSelectedEp(ep);
    setEpDetail(null);
    setEpDetailLoading(true);
    // Fetch via TVMaze episode tconst lookup
    try {
      if (ep.ep_tconst) {
        const r = await fetch(`https://api.tvmaze.com/lookup/episodes?imdb=${ep.ep_tconst}&embed[]=guestcast&embed[]=crew`);
        if (r.ok) { const d = await r.json(); setEpDetail(d); setEpDetailLoading(false); return; }
      }
    } catch {}
    // Fallback: look up by show + season + episode number via TVMaze
    try {
      const showId = (metadata as any)?._links?.self?.href?.match(/shows\/(\d+)/)?.[1]
                  || (metadata as any)?.id;
      if (showId) {
        const r = await fetch(`https://api.tvmaze.com/shows/${showId}/episodebynumber?season=${ep.season}&number=${ep.episode}&embed[]=guestcast&embed[]=crew`);
        if (r.ok) { const d = await r.json(); setEpDetail(d); }
      }
    } catch {}
    setEpDetailLoading(false);
  }, [metadata]);

  const closeModal = useCallback(() => { setSelectedEp(null); setEpDetail(null); }, []);

  const navigateEp = useCallback((dir: 1 | -1) => {
    if (!selectedEp || !allEpisodesList.length) return;
    const idx = allEpisodesList.findIndex(e => e.season === selectedEp.season && e.episode === selectedEp.episode);
    const next = allEpisodesList[idx + dir];
    if (next) openEpisodeModal(next);
  }, [selectedEp, allEpisodesList, openEpisodeModal]);

  // ── download ──
  const downloadHeatmap = useCallback(async () => {
    if (!metadata || !heatmap || !chartData.seasons.length) return;
    setIsDownloading(true);
    const _posterSrc: string | null = metadata?.image?.original || metadata?.image?.medium || null;
    const _stripHtml = (html: string) => html ? html.replace(/<[^>]*>?/gm, '') : "";
    const _yearRange = (() => {
      const s = metadata?.premiered ? metadata.premiered.substring(0, 4) : null;
      const e = metadata?.ended ? metadata.ended.substring(0, 4) : null;
      if (!s) return "????"; if (!e) return `${s}-`; if (s === e) return s; return `${s}-${e}`;
    })();
    try {
      const colorForScore = (s: number | null): string => {
        if (s === null || isNaN(s)) return '#363636';
        if (s < 5.0) return '#800080'; if (s < 6.0) return '#DC143C'; if (s <= 7.9) return '#D4AF37'; if (s < 9.0) return '#90EE90'; return '#006400';
      };
      const textColorForBg = (hex: string): string => {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return (0.299*r + 0.587*g + 0.114*b) > 150 ? '#000000' : '#ffffff';
      };
      const seasons = Object.keys(heatmap).map(Number).sort((a,b)=>a-b);
      const maxEp = Math.max(...seasons.flatMap(s => heatmap[s].map((e:any)=>e.episode)));
      const SCALE=2, BOX_W=110, BOX_H=42, GAP=12, LABEL_W=56, HEADER_H=90;
      const PAD_LEFT=60, PAD_TOP=60, PAD_RIGHT=120, PAD_BOTTOM=80, LEFT_COL=600, MID_GAP=80;
      const gridW = LABEL_W + GAP + seasons.length * BOX_W + (seasons.length - 1) * GAP;
      const minGridW = Math.max(gridW, 430);
      const gridH = HEADER_H + maxEp * (BOX_H + GAP) + 20 + BOX_H + 40;
      const canvasW = PAD_LEFT + LEFT_COL + MID_GAP + minGridW + PAD_RIGHT;
      const canvasH = Math.max(700, PAD_TOP + gridH + PAD_BOTTOM);
      const canvas = document.createElement('canvas');
      canvas.width = canvasW * SCALE; canvas.height = canvasH * SCALE;
      const ctx = canvas.getContext('2d')!; ctx.scale(SCALE, SCALE);
      const drawPoster = (): Promise<void> => new Promise(resolve => {
        if (!_posterSrc) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,canvasW,canvasH); return resolve(); }
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          const scale = Math.max(canvasW/img.width, canvasH/img.height);
          const nw=img.width*scale, nh=img.height*scale, dx=(canvasW-nw)/2, dy=(canvasH-nh)/2 - nh*0.1;
          ctx.drawImage(img, dx, dy, nw, nh);
          ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0,0,canvasW,canvasH); resolve();
        };
        img.onerror = () => { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,canvasW,canvasH); resolve(); };
        img.src = _posterSrc;
      });
      await drawPoster();
      const roundRect = (x:number,y:number,w:number,h:number,r:number) => {
        ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
        ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
      };
      let ty = PAD_TOP;
      ctx.fillStyle = 'rgba(245,245,245,0.85)'; ctx.font = `500 13px sans-serif`; ctx.fillText('TV Series', PAD_LEFT, ty); ty += 30;
      ctx.fillStyle = '#ffffff'; ctx.font = `900 64px sans-serif`;
      const titleWords = (metadata.name as string).split(' '); let line = ''; const titleLines: string[] = [];
      for (const w of titleWords) { const test = line ? line+' '+w : w; if (ctx.measureText(test).width > 520) { titleLines.push(line); line = w; } else line = test; }
      titleLines.push(line);
      for (const tl of titleLines) { ctx.fillText(tl, PAD_LEFT, ty); ty += 70; }
      ty += 8;
      ctx.fillStyle = 'rgba(245,245,245,0.9)'; ctx.font = `400 26px sans-serif`; ctx.fillText(`(${_yearRange})`, PAD_LEFT, ty); ty += 56;
      ctx.fillStyle = '#FFD700'; ctx.font = `bold 40px sans-serif`; ctx.fillText('★', PAD_LEFT, ty+4);
      ctx.fillStyle = '#ffffff'; ctx.font = `900 48px sans-serif`; ctx.fillText(dbStats.rating, PAD_LEFT+52, ty+4);
      ctx.fillStyle = 'rgba(220,220,220,0.8)'; ctx.font = `400 22px sans-serif`; ctx.fillText('/10', PAD_LEFT+52+ctx.measureText(dbStats.rating).width+8, ty+4);
      if (dbStats.votes) { ctx.fillStyle = 'rgba(180,180,180,0.8)'; ctx.font = `400 18px sans-serif`; ctx.fillText(`(${Number(dbStats.votes).toLocaleString()})`, PAD_LEFT+52+ctx.measureText(dbStats.rating).width+70, ty); }
      ty += 62;
      ctx.fillStyle = 'rgba(210,210,210,0.9)'; ctx.font = `400 13px sans-serif`;
      const summary = _stripHtml(metadata.summary||''); const words = summary.split(' '); let sLine = ''; let lCount = 0;
      for (const w of words) { if (lCount >= 8) break; const test = sLine ? sLine+' '+w : w; if (test.length > 52) { ctx.fillText(sLine, PAD_LEFT, ty); ty+=22; sLine=w; lCount++; } else sLine = test; }
      if (sLine && lCount < 8) ctx.fillText(sLine, PAD_LEFT, ty);
      const gx = PAD_LEFT + LEFT_COL + MID_GAP; let gy = PAD_TOP;
      const legendItems = [['#006400','Awesome'],['#90EE90','Great'],['#D4AF37','Good'],['#DC143C','Bad'],['#800080','Garbage']];
      let lx = gx; ctx.font = `700 11px sans-serif`;
      for (const [col, name] of legendItems) { ctx.fillStyle = col as string; ctx.beginPath(); ctx.arc(lx+5, gy+5, 5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillText(name, lx+14, gy+9); lx += 14 + ctx.measureText(name).width + 20; }
      gy += 28;
      const gridLeft = gx + LABEL_W + GAP; ctx.font = `700 14px sans-serif`;
      for (let si=0; si<seasons.length; si++) { const sx = gridLeft + si*(BOX_W+GAP); roundRect(sx, gy, BOX_W, BOX_H-6, 8); ctx.fillStyle = '#282828'; ctx.fill(); ctx.fillStyle = '#F5F5F5'; ctx.textAlign = 'center'; ctx.fillText(`S${seasons[si]}`, sx+BOX_W/2, gy+(BOX_H-6)/2+5); ctx.textAlign = 'left'; }
      gy += BOX_H + GAP - 6; ctx.font = `700 16px sans-serif`;
      for (let ei=0; ei<maxEp; ei++) {
        const epNum = ei+1; const ry = gy + ei*(BOX_H+GAP);
        roundRect(gx, ry, LABEL_W-4, BOX_H, 6); ctx.fillStyle = '#282828'; ctx.fill(); ctx.fillStyle = '#F5F5F5'; ctx.textAlign = 'center'; ctx.fillText(`E${epNum}`, gx+(LABEL_W-4)/2, ry+BOX_H/2+6); ctx.textAlign = 'left';
        for (let si=0; si<seasons.length; si++) {
          const sx = gridLeft + si*(BOX_W+GAP); const epData = heatmap[seasons[si]]?.find((e:any)=>e.episode===epNum); const val = epData?.rating ?? null;
          const bg = colorForScore(val); const isGolden = val !== null && val >= 9.5;
          roundRect(sx, ry, BOX_W, BOX_H, 8); ctx.fillStyle = bg; ctx.fill();
          ctx.strokeStyle = isGolden ? '#FFD700' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = isGolden ? 2.5 : 1.5;
          roundRect(sx, ry, BOX_W, BOX_H, 8); ctx.stroke();
          ctx.fillStyle = val !== null ? textColorForBg(bg) : '#555555'; ctx.textAlign = 'center';
          ctx.fillText(val !== null ? val.toFixed(1) : '-', sx+BOX_W/2, ry+BOX_H/2+6); ctx.textAlign = 'left';
        }
      }
      const avgY = gy + maxEp*(BOX_H+GAP) + 12; ctx.setLineDash([]);
      roundRect(gx, avgY, LABEL_W-4, BOX_H, 6); ctx.fillStyle = '#282828'; ctx.fill(); ctx.fillStyle = '#F5F5F5'; ctx.font = `700 14px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Avg', gx+(LABEL_W-4)/2, avgY+BOX_H/2+5); ctx.textAlign = 'left';
      for (let si=0; si<seasons.length; si++) {
        const sx = gridLeft + si*(BOX_W+GAP); const avg = chartData.seasons.find(s=>s.rawSeason===seasons[si])?.rating ?? 0; const bg = colorForScore(avg);
        ctx.beginPath(); ctx.roundRect(sx, avgY, BOX_W, BOX_H, BOX_H/2); ctx.fillStyle=bg; ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle = textColorForBg(bg); ctx.font=`700 16px sans-serif`; ctx.textAlign='center'; ctx.fillText(avg>0?avg.toFixed(1):'-', sx+BOX_W/2, avgY+BOX_H/2+6); ctx.textAlign='left';
      }
      const link = document.createElement('a'); link.download = `${(metadata.name as string).replace(/[^a-z0-9]/gi,'_')}_heatmap.png`; link.href = canvas.toDataURL('image/png'); link.click();
    } catch (err) { console.error('Download failed:', err); showToast('Download failed: ' + String(err)); }
    setIsDownloading(false);
  }, [metadata, heatmap, chartData, dbStats]);

  // ── tooltip ──
  const EpTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#111] border border-white/10 p-3 rounded-xl shadow-2xl z-50 relative backdrop-blur-sm">
          <p className="font-bold text-white text-sm mb-1">{data.title}</p>
          <p className="text-[#666] text-xs">Season {data.season || data.rawSeason}{data.episode ? ` · Ep ${data.episode}` : ''}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.color }} />
            <span className="text-yellow-400 font-bold text-sm">{data.rating}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const BOX_W = 110, BOX_H = 42, COL_GAP = 12, ROW_GAP = 12;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white" style={{ background: '#080808', fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif" }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-60 -left-20 w-[700px] h-[700px] rounded-full opacity-[0.035]"
             style={{ background: 'radial-gradient(circle, #e53e3e, transparent 70%)' }} />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full opacity-[0.025]"
             style={{ background: 'radial-gradient(circle, #ffd700, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-8 md:px-12 pb-24">

        {/* ── Toast ── */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 z-[999] -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl transition-all"
               style={{
                 background: toast.type === 'success' ? 'rgba(74,222,128,0.12)' : 'rgba(220,20,60,0.12)',
                 border: `1px solid ${toast.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(220,20,60,0.3)'}`,
                 backdropFilter: 'blur(16px)',
                 color: toast.type === 'success' ? '#4ade80' : '#f87171',
                 fontSize: 13, fontWeight: 700,
               }}>
            <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
            <span>{toast.msg}</span>
          </div>
        )}

        {/* ── NAV BAR ── */}
        <header className="flex items-center justify-between py-7 mb-2">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                 style={{ background: 'linear-gradient(135deg, #e53e3e, #c53030)' }}>
              <span className="text-white text-xs font-black">C</span>
            </div>
            <span className="text-[#444] text-sm font-bold tracking-widest uppercase group-hover:text-white transition-colors">Cinephile</span>
          </Link>
          <Link href="/"
            className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm font-medium group">
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to grid
          </Link>
          <Link href="/compare"
            className="flex items-center gap-2 text-[#333] hover:text-blue-400 transition-colors text-sm font-medium">
            <BarChart2 size={13} />
            Compare
          </Link>
          <Link href="/hall-of-fame"
            className="flex items-center gap-2 text-[#333] hover:text-yellow-400 transition-colors text-sm font-medium ml-auto">
            <Trophy size={13} />
            Hall of Fame
          </Link>

          {/* Watchlist button */}
          {metadata && (() => {
            const listed = inList(id as string);
            const entry  = getEntry(id as string);
            return (
              <div className="relative ml-3">
                <button
                  onClick={() => {
                    if (!listed) {
                      add({
                        tconst: id as string,
                        title: metadata.name,
                        year: metadata.year || '',
                        genres: metadata.genres || '',
                        imdbRating: Number(dbStats.rating) || 0,
                        poster: posterSrc,
                        status: 'want',
                        myRating: null,
                      });
                      setWlOpen(true);
                    } else {
                      setWlOpen(o => !o);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: listed ? 'rgba(245,197,24,0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${listed ? 'rgba(245,197,24,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: listed ? '#F5C518' : '#555',
                  }}>
                  {listed ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                  {listed ? 'Saved' : 'Add'}
                </button>

                {/* Quick panel */}
                {wlOpen && listed && entry && (
                  <div className="absolute top-full right-0 mt-2 p-4 rounded-2xl z-50 min-w-56"
                       style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 48px rgba(0,0,0,0.9)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-white">In your list</span>
                      <button onClick={() => setWlOpen(false)} className="text-[#333] hover:text-white"><X size={12} /></button>
                    </div>
                    {/* Status */}
                    <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#333' }}>STATUS</p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(['want','watching','completed','dropped'] as const).map(s => {
                        const active = entry.status === s;
                        const labels: Record<string,string> = { want:'🔖 Want', watching:'👁️ Watching', completed:'✅ Done', dropped:'❌ Dropped' };
                        const colors: Record<string,string> = { want:'#60a5fa', watching:'#4ade80', completed:'#F5C518', dropped:'#DC143C' };
                        return (
                          <button key={s} onClick={() => setStatus(id as string, s)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                            style={{ background: active ? `${colors[s]}20` : 'transparent', border: `1px solid ${active ? colors[s]+'40' : 'rgba(255,255,255,0.06)'}`, color: active ? colors[s] : '#444' }}>
                            {labels[s]}
                          </button>
                        );
                      })}
                    </div>
                    {/* Rating */}
                    <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#333' }}>MY RATING</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {Array.from({length:10},(_,i)=>i+1).map(v => {
                        const active = entry.myRating === v;
                        return (
                          <button key={v} onClick={() => setMyRating(id as string, active ? null : v)}
                            className="w-7 h-7 rounded-lg text-xs font-black transition-all"
                            style={{ background: active ? '#F5C518' : 'rgba(255,255,255,0.04)', color: active ? '#000' : '#333', border: `1px solid ${active ? '#F5C518' : 'rgba(255,255,255,0.06)'}` }}>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                    {/* Remove + view list */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => { remove(id as string); setWlOpen(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center"
                        style={{ background: 'rgba(220,20,60,0.08)', border: '1px solid rgba(220,20,60,0.15)', color: '#DC143C' }}>
                        <Bookmark size={11} /> Remove
                      </button>
                      <Link href="/watchlist"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 justify-center"
                        style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.15)', color: '#F5C518' }}>
                        View List →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </header>

        {/* ── HERO: Full-width cinematic banner ── */}
        {metadata && (
          <div className="relative w-full rounded-2xl overflow-hidden mb-8" style={{ minHeight: 420 }}>

            {/* Poster blurred background */}
            {posterSrc && (
              <>
                <div className="absolute inset-0 z-0">
                  <img src={posterSrc} alt="" className="w-full h-full object-cover object-center scale-105" style={{ filter: 'blur(32px)', transform: 'scale(1.1)' }} />
                </div>
                <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to right, rgba(8,8,8,0.97) 35%, rgba(8,8,8,0.7) 65%, rgba(8,8,8,0.4) 100%)' }} />
                <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to top, rgba(8,8,8,1) 0%, transparent 40%)' }} />
              </>
            )}
            {!posterSrc && <div className="absolute inset-0 z-0 bg-[#0d0d0d]" />}

            <div className="relative z-10 flex flex-row gap-10 p-10 items-start">

              {/* Poster card */}
              <div className="shrink-0 w-[200px] xl:w-[240px]">
                {posterSrc
                  ? <img src={posterSrc} alt={metadata.name} className="w-full rounded-xl object-contain shadow-2xl"
                         style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.7)", maxHeight: "360px" }} />
                  : <div className="w-full aspect-[2/3] rounded-xl bg-[#1a1a1a] flex items-center justify-center border border-[#222]">
                      <span className="text-4xl opacity-20">📺</span>
                    </div>
                }
              </div>

              {/* Info */}
              <div className="flex flex-col justify-center py-4 flex-1">
                {/* Label */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold tracking-[3px] text-[#555] uppercase">TV Series</span>
                </div>

                {/* Title */}
                <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.0] mb-3" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                  {metadata.name}
                </h1>

                {/* Meta row */}
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <span className="text-[#666] font-medium text-sm">{yearRange}</span>
                  <span className="text-[#333]">·</span>
                  <span className="text-[#666] font-medium text-sm">{metadata.genres?.join(", ")}</span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-4 mb-7">
                  <div className="flex items-center gap-2">
                    <Star size={20} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-black text-3xl">{dbStats.rating}</span>
                    <span className="text-[#444] font-bold text-lg">/10</span>
                  </div>
                  {dbStats.votes && (
                    <div className="flex items-center gap-1.5 text-[#555] text-sm">
                      <Users size={13} />
                      <span>{dbStats.votes.toLocaleString()} votes</span>
                    </div>
                  )}
                  {volatility && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
                         style={{ background: `${volatility.color}12`, borderColor: `${volatility.color}30`, color: volatility.color }}>
                      <span>{volatility.icon}</span>
                      <span>{volatility.label}</span>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <p className="text-[#888] text-sm leading-relaxed max-w-2xl line-clamp-4 mb-8">
                  {stripHtml(metadata.summary)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fetchData('live')}
                    disabled={isScraping}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#aaa' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#aaa'; }}
                  >
                    {isScraping
                      ? <><div className="w-3.5 h-3.5 border-2 border-[#333] border-t-white/50 rounded-full animate-spin" /> Fetching latest IMDb data...</>
                      : <><Globe size={14} /> Refresh IMDb Ratings</>
                    }
                  </button>
                  <a href={`https://www.imdb.com/title/${id}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all"
                     style={{ background: 'rgba(245,197,24,0.08)', borderColor: 'rgba(245,197,24,0.2)', color: '#F5C518' }}>
                    <span className="text-base">🎬</span> IMDb
                  </a>
                  {heatmap && (
                    <button onClick={() => setShowShareModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all"
                      style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.25)', color: '#a78bfa' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.15)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'; }}>
                      <Share2 size={14} /> Share Card
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LOADING STATE ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-8 h-8 border-2 border-[#222] border-t-red-500 rounded-full animate-spin" />
            <p className="text-[#444] text-sm font-medium">Analyzing episode data…</p>
          </div>
        ) : !heatmap ? (
          <div className="text-center py-32">
            <p className="text-[#333] text-xl font-bold mb-2">No data found</p>
            <p className="text-[#555] text-sm">Try refreshing from web using the button above</p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">

            {/* ── LIFECYCLE CARDS ── */}
            {lifecycle && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Peak */}
                <div className="relative overflow-hidden rounded-2xl p-6 border border-yellow-500/15"
                     style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.04), rgba(255,215,0,0.01))' }}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 rounded-l-2xl" />
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={13} className="text-yellow-500" />
                    <span className="text-[10px] font-black tracking-[3px] text-[#555] uppercase">The Golden Age</span>
                  </div>
                  <p className="text-[#aaa] text-sm leading-relaxed">
                    This show peaked in{' '}
                    <span className="text-yellow-400 font-bold">Season {lifecycle.peak.rawSeason}</span>{' '}
                    with an average rating of{' '}
                    <span className="text-white font-bold">{lifecycle.peak.rating}/10</span>.
                  </p>
                </div>
                {/* Downfall / Consistency */}
                {lifecycle.downfall ? (
                  <div className="relative overflow-hidden rounded-2xl p-6 border border-red-500/15"
                       style={{ background: 'linear-gradient(135deg, rgba(229,62,62,0.04), rgba(229,62,62,0.01))' }}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-2xl" />
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown size={13} className="text-red-400" />
                      <span className="text-[10px] font-black tracking-[3px] text-[#555] uppercase">The Downfall</span>
                    </div>
                    <p className="text-[#aaa] text-sm leading-relaxed">
                      Quality dropped in{' '}
                      <span className="text-red-400 font-bold">Season {lifecycle.downfall.to.rawSeason}</span>{', '}
                      plunging <span className="text-white font-bold">{lifecycle.downfall.drop.toFixed(2)} points</span>{' '}
                      from Season {lifecycle.downfall.from.rawSeason}.
                    </p>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl p-6 border border-green-500/15"
                       style={{ background: 'linear-gradient(135deg, rgba(72,187,120,0.04), rgba(72,187,120,0.01))' }}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500 rounded-l-2xl" />
                    <div className="flex items-center gap-2 mb-3">
                      <Activity size={13} className="text-green-400" />
                      <span className="text-[10px] font-black tracking-[3px] text-[#555] uppercase">Consistent</span>
                    </div>
                    <p className="text-[#aaa] text-sm leading-relaxed">
                      This show maintained a <span className="text-green-400 font-bold">stable rating trajectory</span>{' '}
                      without suffering a major seasonal drop.
                    </p>
                  </div>
                )}

                {/* Volatility Card */}
                {volatility && (
                  <div className="relative overflow-hidden rounded-2xl p-6 border"
                       style={{ background: `linear-gradient(135deg, ${volatility.color}06, ${volatility.color}02)`, borderColor: `${volatility.color}20` }}>
                    <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: volatility.color }} />
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">{volatility.icon}</span>
                      <span className="text-[10px] font-black tracking-[3px] text-[#555] uppercase">Rating Volatility</span>
                    </div>
                    <p className="text-[#aaa] text-sm leading-relaxed mb-4">{volatility.description}</p>
                    <div className="flex gap-3">
                      {volatility.biggestSpike.ep && (
                        <div className="flex-1 rounded-xl p-2.5" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
                          <p className="text-[10px] text-[#444] font-bold tracking-widest uppercase mb-1">Biggest Jump</p>
                          <p className="text-green-400 text-xs font-bold">+{volatility.biggestSpike.delta.toFixed(1)} pts</p>
                          <p className="text-[#555] text-[11px]">S{volatility.biggestSpike.ep.season}E{volatility.biggestSpike.ep.episode}</p>
                        </div>
                      )}
                      {volatility.biggestDrop.ep && (
                        <div className="flex-1 rounded-xl p-2.5" style={{ background: 'rgba(220,20,60,0.05)', border: '1px solid rgba(220,20,60,0.1)' }}>
                          <p className="text-[10px] text-[#444] font-bold tracking-widest uppercase mb-1">Biggest Drop</p>
                          <p className="text-red-400 text-xs font-bold">−{volatility.biggestDrop.delta.toFixed(1)} pts</p>
                          <p className="text-[#555] text-[11px]">S{volatility.biggestDrop.ep.season}E{volatility.biggestDrop.ep.episode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── WATCH GUIDE ── */}
            {watchGuide && (
              <div className="relative rounded-2xl overflow-hidden"
                   style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>

                {/* Ambient color glow from verdict */}
                <div className="absolute inset-0 pointer-events-none"
                     style={{ background: `radial-gradient(ellipse at 0% 0%, ${watchGuide.verdictColor}08 0%, transparent 60%)` }} />

                <div className="relative z-10 flex flex-col md:flex-row gap-0 divide-y md:divide-y-0 md:divide-x divide-white/[0.04]">

                  {/* ── Left: Verdict + Hook stats ── */}
                  <div className="flex flex-col justify-between p-8 md:w-80 shrink-0">
                    {/* Label */}
                    <div>
                      <p className="text-[10px] font-black tracking-[4px] text-[#333] uppercase mb-5">Viewer Experience</p>

                      {/* Big verdict */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
                             style={{ background: `${watchGuide.verdictColor}15`, border: `1px solid ${watchGuide.verdictColor}25` }}>
                          {watchGuide.verdictIcon}
                        </div>
                        <div>
                          <p className="text-white font-black text-lg leading-tight">{watchGuide.verdict}</p>
                          <p className="text-[#333] text-xs mt-0.5">
                            {watchGuide.isLikelyAnthology ? 'Anthology · self-contained seasons' : 'Based on S1 episode data'}
                          </p>
                        </div>
                      </div>

                      {/* Hook score meter */}
                      {!watchGuide.isLikelyAnthology && watchGuide.s1OpenerAvg > 0 && (
                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[#444] text-[11px] font-bold uppercase tracking-wider">Hook Strength</span>
                            <span className="font-black text-base" style={{ color: watchGuide.verdictColor }}>
                              {watchGuide.s1OpenerAvg.toFixed(1)}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                 style={{ width: `${Math.min(100, ((watchGuide.s1OpenerAvg - 5) / 5) * 100)}%`,
                                          background: `linear-gradient(90deg, ${watchGuide.verdictColor}88, ${watchGuide.verdictColor})` }} />
                          </div>
                          <p className="text-[#333] text-[11px] mt-1.5">Avg of first 3 episodes</p>
                        </div>
                      )}

                      {/* Anthology top seasons */}
                      {watchGuide.isLikelyAnthology && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {chartData.seasons.slice().sort((a: any, b: any) => b.rating - a.rating).slice(0, 4).map((s: any, i: number) => (
                            <div key={s.rawSeason} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                                 style={{ background: i === 0 ? `${watchGuide.verdictColor}15` : 'rgba(255,255,255,0.03)',
                                          border: `1px solid ${i === 0 ? watchGuide.verdictColor + '30' : 'rgba(255,255,255,0.06)'}` }}>
                              <span className="text-[#555] text-xs">S{s.rawSeason}</span>
                              <span className="font-bold text-xs" style={{ color: i === 0 ? watchGuide.verdictColor : '#666' }}>★{s.rating}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Momentum tag */}
                    {!watchGuide.isLikelyAnthology && (
                      <div className="flex items-center gap-2 mt-6">
                        <div className="w-1.5 h-1.5 rounded-full"
                             style={{ backgroundColor: watchGuide.s1Momentum > 0.2 ? '#4ade80' : watchGuide.s1Momentum < -0.2 ? '#f87171' : '#555' }} />
                        <span className="text-[#555] text-xs">
                          S1 {watchGuide.s1Momentum > 0.2 ? 'builds momentum as it goes' : watchGuide.s1Momentum < -0.2 ? 'peaks early, slows down' : 'stays consistently paced'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Center: Episode spark timeline ── */}
                  {!watchGuide.isLikelyAnthology && (
                    <div className="flex-1 p-8">
                      <p className="text-[10px] font-black tracking-[4px] text-[#333] uppercase mb-6">Season 1 — Episode by Episode</p>

                      {/* Spark bars */}
                      <div className="flex items-end gap-1 h-20 mb-3">
                        {(() => {
                          const s1Eps = chartData.episodes.filter((e: any) => e.season === 1);
                          const maxR = Math.max(...s1Eps.map((e: any) => e.rating), 10);
                          const minR = Math.min(...s1Eps.map((e: any) => e.rating), 5);
                          return s1Eps.map((ep: any, i: number) => {
                            const heightPct = Math.max(8, ((ep.rating - minR) / (maxR - minR + 0.01)) * 100);
                            const isClickEp = ep.episode === watchGuide.clicksAtEp;
                            const barColor = ep.rating >= 9 ? '#006400' : ep.rating >= 8 ? '#4ade80' : ep.rating >= 6 ? '#D4AF37' : ep.rating >= 5 ? '#DC143C' : '#800080';
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                                {isClickEp && (
                                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                    <span className="text-[9px] font-black text-yellow-400 tracking-wider">CLICKS HERE</span>
                                  </div>
                                )}
                                <div className="w-full rounded-sm transition-all duration-300"
                                     style={{ height: `${heightPct}%`, backgroundColor: isClickEp ? '#F5C518' : barColor,
                                              opacity: isClickEp ? 1 : 0.7,
                                              boxShadow: isClickEp ? '0 0 8px rgba(245,197,24,0.5)' : 'none' }} />
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Episode number axis — show every 5th */}
                      <div className="flex items-end gap-1">
                        {chartData.episodes.filter((e: any) => e.season === 1).map((ep: any, i: number) => (
                          <div key={i} className="flex-1 text-center">
                            {(i + 1) % 5 === 0 || i === 0 ? (
                              <span className="text-[9px] text-[#2a2a2a]">{ep.episode}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {/* Click highlight callout */}
                      {watchGuide.clicksAtEp && watchGuide.clicksAtEp > 2 && (
                        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl"
                             style={{ background: 'rgba(245,197,24,0.05)', border: '1px solid rgba(245,197,24,0.12)' }}>
                          <div className="w-0.5 h-8 rounded-full bg-yellow-400 shrink-0" />
                          <div>
                            <p className="text-[#555] text-[11px]">Stick with it until</p>
                            <p className="text-yellow-400 font-black text-sm">Episode {watchGuide.clicksAtEp} — that's where it locks in</p>
                          </div>
                        </div>
                      )}
                      {watchGuide.clicksAtEp && watchGuide.clicksAtEp <= 2 && (
                        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl"
                             style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.12)' }}>
                          <div className="w-0.5 h-8 rounded-full bg-green-400 shrink-0" />
                          <p className="text-green-400 font-black text-sm">Grabs you from the very first episode</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Right: Season quality bars ── */}
                  <div className="p-8 md:w-64 shrink-0">
                    <p className="text-[10px] font-black tracking-[4px] text-[#333] uppercase mb-6">Season Quality</p>
                    <div className="flex flex-col gap-3">
                      {chartData.seasons.map((s: any) => (
                        <div key={s.rawSeason} className="flex items-center gap-3">
                          <span className="text-[#2a2a2a] text-[11px] font-bold w-5 shrink-0">S{s.rawSeason}</span>
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="h-full rounded-full"
                                 style={{ width: `${Math.min(100, ((s.rating - 5) / 5) * 100)}%`, backgroundColor: s.color,
                                          transition: 'width 0.8s ease' }} />
                          </div>
                          <span className="text-[#444] text-[11px] font-bold w-7 text-right shrink-0">{s.rating}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ── CINEMATIC HEATMAP ── */}
            <div ref={heatmapRef}
              className="relative w-full rounded-2xl border border-white/5 overflow-hidden shadow-2xl"
              style={posterSrc ? { backgroundImage: `url(${posterSrc})`, backgroundSize: 'cover', backgroundPosition: 'center 15%' } : { backgroundColor: '#0d0d0d' }}>
              <div className="absolute inset-0 bg-black/70 z-0" />
              <div className="relative z-10 flex flex-row min-h-[520px]">
                {/* Left info */}
                <div className="shrink-0 w-[500px] flex flex-col justify-start px-10 py-10">
                  <p className="text-white/40 font-bold text-[10px] tracking-[3px] uppercase mb-5">TV Series</p>
                  <h1 className="text-5xl leading-tight font-black text-white mb-3 drop-shadow-2xl">{metadata?.name}</h1>
                  <p className="text-white/60 text-lg font-medium mb-7">({yearRange})</p>
                  <div className="flex items-center gap-3 mb-8">
                    <Star size={28} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-black text-4xl">{dbStats.rating}</span>
                    <span className="text-white/40 font-bold text-xl">/10</span>
                    {dbStats.votes && <span className="text-white/30 text-sm ml-1">({dbStats.votes.toLocaleString()})</span>}
                  </div>
                  <p className="text-white/55 text-[13px] leading-[1.7] max-w-[400px] line-clamp-8">{metadata ? stripHtml(metadata.summary) : ""}</p>
                </div>
                {/* Grid */}
                <div className="flex-1 flex items-start justify-start py-10 pr-8 overflow-x-auto">
                  <div className="flex flex-col items-start">
                    {/* Legend */}
                    <div className="flex gap-4 mb-5 text-[10px] font-black tracking-[2px] uppercase text-white/70">
                      {[["#006400","Awesome"],["#90EE90","Great"],["#D4AF37","Good"],["#DC143C","Bad"],["#800080","Garbage"]].map(([color, label]) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          {label}
                        </div>
                      ))}
                    </div>
                    {/* Grid layout */}
                    <div className="flex" style={{ gap: COL_GAP }}>
                      {/* Row labels */}
                      <div className="flex flex-col" style={{ gap: ROW_GAP, marginTop: BOX_H + ROW_GAP }}>
                        {Array.from({ length: maxEpisodes }, (_, i) => (
                          <div key={`lbl-${i}`} className="flex items-center justify-center font-bold text-[13px] text-white/60 bg-white/5 rounded-lg" style={{ width: 44, height: BOX_H }}>
                            E{i + 1}
                          </div>
                        ))}
                        <div className="w-full h-px bg-white/10 my-1" />
                        <div className="flex items-center justify-center font-bold text-[13px] text-white/60 bg-white/5 rounded-lg" style={{ width: 44, height: BOX_H }}>Avg</div>
                      </div>
                      {/* Season columns */}
                      {Object.keys(heatmap).map((season) => {
                        const seasonData = heatmap[season];
                        const seasonAvg = chartData.seasons.find(s => s.rawSeason === parseInt(season))?.rating || 0;
                        return (
                          <div key={`season-${season}`} className="flex flex-col" style={{ gap: ROW_GAP }}>
                            <div className="flex items-center justify-center bg-white/8 font-bold text-[13px] text-white/70 rounded-lg border border-white/5" style={{ width: BOX_W, height: BOX_H }}>
                              S{season}
                            </div>
                            {Array.from({ length: maxEpisodes }, (_, i) => {
                              const epNum = i + 1;
                              const ep = seasonData.find((e: any) => e.episode === epNum);
                              if (ep) {
                                const isGolden = ep.rating >= 9.5;
                                return (
                                  <div key={`ep-${season}-${epNum}`}
                                    className="flex items-center justify-center rounded-lg font-bold text-[16px] cursor-pointer transition-all duration-150 hover:scale-105 hover:z-10 hover:shadow-lg"
                                    style={{ width: BOX_W, height: BOX_H, backgroundColor: getRatingHexBox(ep.rating), color: getTextColor(ep.rating),
                                      border: isGolden ? '2.5px solid #FFD700' : '1.5px solid rgba(0,0,0,0.4)',
                                      boxShadow: isGolden ? '0 0 12px rgba(255,215,0,0.4)' : 'none' }}
                                    title={`${ep.title} — ${ep.rating}`}
                                    onClick={() => openEpisodeModal({ ...ep, season: Number(season) })}>
                                    {ep.rating.toFixed(1)}
                                  </div>
                                );
                              }
                              return (
                                <div key={`empty-${season}-${epNum}`}
                                  className="flex items-center justify-center rounded-lg text-white/20 font-bold text-[16px]"
                                  style={{ width: BOX_W, height: BOX_H, backgroundColor: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.05)' }}>
                                  –
                                </div>
                              );
                            })}
                            <div className="w-full h-px bg-white/10 my-1" />
                            <div className="flex items-center justify-center font-bold text-[16px]"
                              style={{ width: BOX_W, height: BOX_H, borderRadius: BOX_H / 2, backgroundColor: getRatingHexBox(seasonAvg), color: getTextColor(seasonAvg), border: '1.5px solid rgba(0,0,0,0.4)' }}>
                              {seasonAvg > 0 ? seasonAvg.toFixed(1) : '–'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── DOWNLOAD BUTTON ── */}
            <div className="flex justify-end">
              <button onClick={downloadHeatmap} disabled={isDownloading}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#aaa' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background='linear-gradient(135deg,#e53e3e,#c53030)'; el.style.borderColor='#e53e3e'; el.style.color='#fff'; el.style.boxShadow='0 4px 20px rgba(229,62,62,0.3)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.04)'; el.style.borderColor='rgba(255,255,255,0.1)'; el.style.color='#aaa'; el.style.boxShadow='none'; }}>
                {isDownloading
                  ? <><div className="w-3.5 h-3.5 border-2 border-[#333] border-t-white/50 rounded-full animate-spin" /> Generating…</>
                  : <><Download size={14} /> Download High-Res Heatmap</>
                }
              </button>
            </div>

            {/* ── CHART + TOP EPISODES ── */}
            <div className="flex flex-col xl:flex-row gap-6">
              {/* Chart */}
              <div className="w-full xl:w-2/3 rounded-2xl border border-white/5 p-8" style={{ background: '#0d0d0d' }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1 h-4 rounded-full bg-red-500" />
                      <span className="text-[10px] font-black tracking-[3px] text-[#444] uppercase">Analytics</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white">Rating Trajectory</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-xl overflow-hidden border border-white/8 bg-black">
                      <button onClick={() => setViewMode('Episodes')} className={`px-4 py-1.5 text-xs font-black transition-all ${viewMode === 'Episodes' ? 'bg-red-600 text-white' : 'text-[#555] hover:text-white'}`}>Episodes</button>
                      <button onClick={() => setViewMode('Seasons')} className={`px-4 py-1.5 text-xs font-black transition-all ${viewMode === 'Seasons' ? 'bg-red-600 text-white' : 'text-[#555] hover:text-white'}`}>Seasons</button>
                    </div>
                    {viewMode === 'Episodes' && (
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl border border-white/8 bg-black">
                        <input type="checkbox" checked={showTrendline} onChange={e => setShowTrendline(e.target.checked)} className="accent-red-500 w-3.5 h-3.5 cursor-pointer" />
                        <span className="text-[#555] text-xs font-bold">Trendline</span>
                      </label>
                    )}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex gap-5 mb-6 flex-wrap">
                  {[["#006400","Awesome"],["#90EE90","Great"],["#D4AF37","Good"],["#DC143C","Bad"],["#800080","Garbage"]].map(([color,label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{backgroundColor:color}}/>
                      <span className="text-[#444] text-xs font-bold">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="h-[420px] w-full rounded-xl p-3" style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {viewMode === 'Episodes' ? (
                      <ComposedChart data={chartData.episodes} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                        {chartData.boundaries.map((b, i) => i % 2 === 0 && <ReferenceArea key={i} x1={b.start - 0.5} x2={b.end + 0.5} fill="rgba(255,255,255,0.015)" />)}
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="absolute_episode" type="number" domain={['dataMin - 1', 'dataMax + 1']}
                          ticks={chartData.boundaries.map(b => b.start)}
                          tickFormatter={(val) => { const b = chartData.boundaries.find(b => b.start === val); return b ? `S${b.season}` : ''; }}
                          stroke="transparent" tick={{ fill: '#444', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={15} />
                        <YAxis domain={[chartData.yAxisMin, 10.2]} stroke="transparent" tick={{ fill: '#444', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip content={<EpTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Line type="linear" dataKey="rating" stroke="rgba(255,255,255,0.08)" strokeWidth={1}
                          activeDot={{ r: 7, fill: '#fff', stroke: '#080808', strokeWidth: 2, onClick: (e: any, payload: any) => { if (payload?.payload?.ep_tconst) window.open(`https://www.imdb.com/title/${payload.payload.ep_tconst}`, '_blank'); } }}
                          dot={(props: any) => { const { cx, cy, payload } = props; return <circle key={payload.absolute_episode} cx={cx} cy={cy} r={5} fill={payload.color} stroke="#080808" strokeWidth={1.5} style={{ cursor: payload.ep_tconst ? 'pointer' : 'default' }} onClick={() => { if (payload.ep_tconst) window.open(`https://www.imdb.com/title/${payload.ep_tconst}`, '_blank'); }} />; }} />
                        {showTrendline && <Line type="monotone" dataKey="trend" stroke="rgba(255,255,255,0.2)" strokeWidth={3} dot={false} activeDot={false} style={{ pointerEvents: 'none' }} />}
                      </ComposedChart>
                    ) : (
                      <ComposedChart data={chartData.seasons} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="season" stroke="transparent" tick={{ fill: '#444', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={15} />
                        <YAxis domain={[chartData.yAxisMin, 10.2]} stroke="transparent" tick={{ fill: '#444', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip content={<EpTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                        <Line type="monotone" dataKey="rating" stroke="rgba(255,255,255,0.15)" strokeWidth={2} activeDot={false}
                          dot={(props: any) => { const { cx, cy, payload } = props; return <circle key={payload.season} cx={cx} cy={cy} r={7} fill={payload.color} stroke="#080808" strokeWidth={2} />; }} />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top episodes */}
              <div className="w-full xl:w-1/3 rounded-2xl border border-white/5 p-8 flex flex-col" style={{ background: '#0d0d0d' }}>
                <div className="mb-7">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-4 rounded-full bg-yellow-500" />
                    <span className="text-[10px] font-black tracking-[3px] text-[#444] uppercase">Hall of Fame</span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Top Episodes</h2>
                </div>
                <div className="flex flex-col gap-1">
                  {chartData.topEps.map((ep, i) => (
                    <div key={i}
                      className="flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer group transition-colors hover:bg-white/4"
                      onClick={() => openEpisodeModal(ep)}>
                      <span className="text-[#333] font-black text-sm w-5 shrink-0">{i + 1}</span>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ep.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#ccc] text-sm truncate group-hover:text-white transition-colors">{ep.title}</p>
                        <p className="text-[#444] text-xs mt-0.5">S{ep.season}, Ep {ep.episode}</p>
                      </div>
                      <span className="text-yellow-400 font-black text-base shrink-0">{ep.rating.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── MORE LIKE THIS ── */}
            {recs.length > 0 && (
              <div className="pt-6 mt-2">
                <div className="flex items-end justify-between mb-7">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 rounded-full bg-red-500" />
                      <span className="text-[10px] font-black tracking-[3px] text-[#444] uppercase">Recommendations</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white">More Like This</h2>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-7">
                  {recs.map((recShow: any) => <RecCard key={recShow.tconst} show={recShow} />)}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── EPISODE DEEP-DIVE MODAL ── */}
      {showShareModal && <ShareCardModal metadata={metadata} dbStats={dbStats} chartData={chartData} volatility={volatility} onClose={() => setShowShareModal(false)} />}
      {selectedEp && (
        <EpisodeModal
          ep={selectedEp}
          detail={epDetail}
          loading={epDetailLoading}
          onClose={closeModal}
          onPrev={() => navigateEp(-1)}
          onNext={() => navigateEp(1)}
          hasPrev={allEpisodesList.findIndex(e => e.season === selectedEp.season && e.episode === selectedEp.episode) > 0}
          hasNext={allEpisodesList.findIndex(e => e.season === selectedEp.season && e.episode === selectedEp.episode) < allEpisodesList.length - 1}
          getRatingHexBox={getRatingHexBox}
          getTextColor={getTextColor}
          stripHtml={(html: string) => html ? html.replace(/<[^>]*>?/gm, '') : ""}
        />
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #222; }
        .bg-white\/4 { background-color: rgba(255,255,255,0.04); }
        .bg-white\/8 { background-color: rgba(255,255,255,0.08); }
      `}</style>
    </div>
  );
}

