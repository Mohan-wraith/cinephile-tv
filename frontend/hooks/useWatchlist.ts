// hooks/useWatchlist.ts
// Drop this in your app's hooks/ directory and import from there.

'use client';
import { useState, useEffect, useCallback } from 'react';

export type WatchStatus = 'want' | 'watching' | 'completed' | 'dropped';

export interface WatchlistEntry {
  tconst: string;
  title: string;
  year: string;
  genres: string;
  imdbRating: number;
  poster: string | null;
  status: WatchStatus;
  myRating: number | null;   // 1–10, null = not rated
  addedAt: number;           // Date.now()
  updatedAt: number;
}

const KEY = 'cinephile_watchlist_v1';

function load(): Record<string, WatchlistEntry> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function save(data: Record<string, WatchlistEntry>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function useWatchlist() {
  const [list, setList] = useState<Record<string, WatchlistEntry>>({});

  useEffect(() => { setList(load()); }, []);

  const add = useCallback((entry: Omit<WatchlistEntry, 'addedAt' | 'updatedAt'>) => {
    setList(prev => {
      const next = { ...prev, [entry.tconst]: {
        ...entry,
        genres: typeof entry.genres === 'string' ? entry.genres : String(entry.genres ?? ''),
        addedAt: Date.now(), updatedAt: Date.now()
      }};
      save(next); return next;
    });
  }, []);

  const remove = useCallback((tconst: string) => {
    setList(prev => {
      const next = { ...prev }; delete next[tconst]; save(next); return next;
    });
  }, []);

  const setStatus = useCallback((tconst: string, status: WatchStatus) => {
    setList(prev => {
      if (!prev[tconst]) return prev;
      const next = { ...prev, [tconst]: { ...prev[tconst], status, updatedAt: Date.now() } };
      save(next); return next;
    });
  }, []);

  const setMyRating = useCallback((tconst: string, rating: number | null) => {
    setList(prev => {
      if (!prev[tconst]) return prev;
      const next = { ...prev, [tconst]: { ...prev[tconst], myRating: rating, updatedAt: Date.now() } };
      save(next); return next;
    });
  }, []);

  const inList  = (tconst: string) => !!list[tconst];
  const getEntry = (tconst: string) => list[tconst] ?? null;
  const entries  = Object.values(list).sort((a, b) => b.updatedAt - a.updatedAt);

  return { list, entries, add, remove, setStatus, setMyRating, inList, getEntry };
}