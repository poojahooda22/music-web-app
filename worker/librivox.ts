/**
 * LibriVox API client — read-path for the audiobook ingest worker only.
 * Metadata comes from the LibriVox feed; the audio files live on archive.org.
 * Response shape verified against a live `?id=…&extended=1&format=json` fetch.
 * Docs: https://librivox.org/api/info
 */

const BASE = "https://librivox.org/api/feed/audiobooks";

// LibriVox bot-filters requests without a browser-like User-Agent (bare clients
// get a 403). Identify the app honestly while staying Mozilla-prefixed.
export const USER_AGENT = "Mozilla/5.0 (compatible; MusicWebApp audiobook ingest)";

export interface LibriVoxReader {
  reader_id: string;
  display_name: string;
}

export interface LibriVoxSection {
  id: string;
  section_number: string; // "1", "2", …
  title: string;
  listen_url: string; // archive.org mp3
  language?: string;
  playtime: string; // seconds, as a string
  readers?: LibriVoxReader[];
}

export interface LibriVoxAuthor {
  first_name?: string;
  last_name?: string;
}

export interface LibriVoxBook {
  id: string;
  title: string;
  description?: string;
  language?: string;
  num_sections?: string;
  totaltimesecs?: number;
  url_iarchive?: string;
  authors?: LibriVoxAuthor[];
  sections?: LibriVoxSection[];
}

interface LibriVoxResponse {
  books?: LibriVoxBook[];
  error?: string; // LibriVox returns {"error":"…"} when nothing matches
}

async function fetchFeed(params: Record<string, string>, attempt = 0): Promise<LibriVoxBook[]> {
  const qs = new URLSearchParams({ format: "json", ...params });
  const res = await fetch(`${BASE}/?${qs.toString()}`, { headers: { "User-Agent": USER_AGENT } });
  // LibriVox returns 404 (not an empty list) when a query has no matches.
  if (res.status === 404) return [];
  // Transient 5xx happen mid-catalog — retry with backoff before giving up, so a
  // momentary blip doesn't permanently drop an otherwise-valid book.
  if (res.status >= 500 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt)); // 0.8s, 1.6s, 3.2s
    return fetchFeed(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`LibriVox API HTTP ${res.status}`);
  const json = (await res.json()) as LibriVoxResponse;
  if (json.error) return [];
  return json.books ?? [];
}

/** A lightweight catalog page (no sections) for selection + filtering. */
export async function fetchBookList(opts: { limit: number; offset: number }): Promise<LibriVoxBook[]> {
  return fetchFeed({ limit: String(opts.limit), offset: String(opts.offset) });
}

/** The full record for one book — including sections + archive.org listen URLs. */
export async function fetchBookById(id: string): Promise<LibriVoxBook | null> {
  const list = await fetchFeed({ id, extended: "1", limit: "1" });
  return list[0] ?? null;
}

export function bookAuthor(b: LibriVoxBook): string | null {
  const names = (b.authors ?? [])
    .map((a) => `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim())
    .filter(Boolean);
  return names.length ? names.join(", ") : null;
}

export function bookReader(b: LibriVoxBook): string | null {
  const names = [
    ...new Set((b.sections ?? []).flatMap((s) => (s.readers ?? []).map((r) => r.display_name))),
  ].filter(Boolean);
  if (!names.length) return null;
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} et al.` : names.join(", ");
}

/** archive.org item identifier → its thumbnail service URL (hot-linked cover). */
export function bookCoverUrl(b: LibriVoxBook): string | null {
  const id = b.url_iarchive
    ?.split("/")
    .filter(Boolean)
    .pop();
  return id ? `https://archive.org/services/img/${id}` : null;
}

export function bookAttribution(b: LibriVoxBook): string {
  const author = bookAuthor(b);
  const reader = bookReader(b);
  return (
    `"${b.title.trim()}"` +
    (author ? ` by ${author}` : "") +
    (reader ? `, read by ${reader}` : "") +
    " — public domain, via LibriVox"
  );
}

// LibriVox recordings are dedicated to the public domain (CC Public Domain Mark).
export const LIBRIVOX_LICENSE = "https://creativecommons.org/publicdomain/mark/1.0/";