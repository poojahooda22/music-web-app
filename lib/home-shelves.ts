import type { Track } from "./player-store";

/**
 * Pure, deterministic home-shelf selections over the song catalog. Each shelf
 * uses DISTINCT real logic — no fake personalization: Discover = genre variety,
 * Top Mixes = the biggest genres, Today = a stable daily rotation, Recent =
 * your actual play history. At scale these move server-side (compute-once /
 * serve-many); at this tier deriving them client-side from the catalog is fine.
 */

/** mulberry32 seeded from a string — stable output for a given seed. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates — same seed ⇒ same order (stable across renders). */
function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  const rnd = seededRandom(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function byGenre(songs: Track[]): Map<string, Track[]> {
  const m = new Map<string, Track[]>();
  for (const s of songs) {
    const g = s.genre || "other";
    if (!m.has(g)) m.set(g, []);
    m.get(g)!.push(s);
  }
  return m;
}

/** DISCOVER — maximum variety: round-robin one track per genre, cycling. */
export function discoverMix(songs: Track[], limit = 20): Track[] {
  const groups = [...byGenre(songs).values()].map((g) => seededShuffle(g, "discover"));
  const out: Track[] = [];
  for (let round = 0; out.length < limit; round++) {
    let advanced = false;
    for (const g of groups) {
      if (g[round]) {
        out.push(g[round]);
        advanced = true;
        if (out.length >= limit) break;
      }
    }
    if (!advanced) break;
  }
  return out;
}

/** TOP MIXES — the biggest genres first, a few tracks from each (depth). */
export function topMixes(songs: Track[], limit = 20): Track[] {
  const groups = [...byGenre(songs).entries()].sort((a, b) => b[1].length - a[1].length);
  const out: Track[] = [];
  for (const [, list] of groups) {
    for (const t of list.slice(0, 6)) {
      out.push(t);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** RECOMMENDED FOR TODAY — a stable daily rotation, seeded by the date. */
export function todayPicks(songs: Track[], dateKey: string, limit = 20): Track[] {
  return seededShuffle(songs, `today-${dateKey}`).slice(0, limit);
}

/** BASED ON RECENT — more songs in the genres/by the artists you play most,
 *  excluding what you've already heard. Empty when there's no history. */
export function basedOnRecent(catalog: Track[], recent: Track[], limit = 20): Track[] {
  if (!recent.length) return [];
  const played = new Set(recent.map((t) => t.id));
  const genres = new Set(recent.map((t) => t.genre || "other"));
  const artists = new Set(recent.map((t) => t.artist));
  const pool = catalog.filter(
    (t) => !played.has(t.id) && (genres.has(t.genre || "other") || artists.has(t.artist)),
  );
  return seededShuffle(pool, "recent").slice(0, limit);
}