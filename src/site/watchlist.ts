export type Priority = 0 | 1 | 2 | 3;

export interface WatchEntry {
  id: string;
  priority: Priority;
  addedAt: string;
}

export type Watchlist = Record<string, WatchEntry>;

const STORAGE_KEY = 'big-deal-radar-watchlist-v1';

export function loadWatchlist(): Watchlist {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Watchlist;
  } catch {
    return {};
  }
}

export function saveWatchlist(watchlist: Watchlist): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  } catch {
    // Ha a böngésző tiltja a localStorage-ot, a lista csak az adott oldalon él.
  }
}

export function watchCount(watchlist: Watchlist): number {
  return Object.keys(watchlist).length;
}

export function priorityLabel(priority: Priority): string {
  if (priority >= 3) return 'Kiemelt';
  if (priority === 2) return 'Fontos';
  if (priority === 1) return 'Követem';
  return 'Nincs';
}
