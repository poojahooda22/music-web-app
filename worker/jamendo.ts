/**
 * Jamendo API v3 client — read-path for the ingest worker only.
 * Field names follow the Jamendo v3 `/tracks` response; verified on first real fetch.
 * Docs: https://developer.jamendo.com/v3.0/tracks
 */

const BASE = "https://api.jamendo.com/v3.0";

export interface JamendoTrack {
  id: string;
  name: string;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_name: string;
  duration: number; // seconds
  releasedate: string; // YYYY-MM-DD
  audio: string; // streaming mp3 URL
  audiodownload: string; // downloadable mp3 URL (when the track allows it)
  license_ccurl: string; // Creative Commons license URL
  image: string; // cover art
  musicinfo?: { tags?: { genres?: string[] } };
}

interface JamendoResponse {
  headers: { status: string; error_message?: string; results_count?: number };
  results: JamendoTrack[];
}

export async function fetchTracks(opts: {
  limit: number;
  offset?: number;
  /** Jamendo fuzzy genre tag (e.g. "rock"). Do NOT combine with an `order` — that returns 0. */
  genre?: string;
}): Promise<JamendoTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) throw new Error("JAMENDO_CLIENT_ID is not set in .env");

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: String(opts.limit),
    offset: String(opts.offset ?? 0),
    include: "musicinfo licenses",
    audioformat: "mp32",
    audiodlformat: "mp32",
  });
  if (opts.genre) params.set("fuzzytags", opts.genre);

  const res = await fetch(`${BASE}/tracks/?${params.toString()}`);
  if (!res.ok) throw new Error(`Jamendo API HTTP ${res.status}`);

  const json = (await res.json()) as JamendoResponse;
  if (json.headers?.status !== "success") {
    throw new Error(`Jamendo API error: ${json.headers?.error_message ?? "unknown"}`);
  }
  return json.results ?? [];
}

export function firstGenre(t: JamendoTrack): string | null {
  return t.musicinfo?.tags?.genres?.[0] ?? null;
}

export function attribution(t: JamendoTrack): string {
  return `"${t.name}" by ${t.artist_name} — licensed under ${t.license_ccurl}, via Jamendo`;
}

/** Guard against Jamendo's "0000-00-00" and malformed dates before writing a DATE column. */
export function safeReleaseDate(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw === "0000-00-00") return null;
  return raw;
}