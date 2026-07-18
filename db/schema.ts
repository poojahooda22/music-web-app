import {
  pgTable,
  bigserial,
  bigint,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Users are provisioned by Neon Auth into the neon_auth schema.
// App tables reference the Neon Auth user id as text (no local users table).

export const artists = pgTable(
  'artists',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: text('name').notNull(),
    bio: text('bio'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('artists_name_idx').on(t.name)],
);

export const albums = pgTable('albums', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  title: text('title').notNull(),
  artistId: bigint('artist_id', { mode: 'number' }).references(() => artists.id),
  releaseDate: date('release_date'),
  coverUrl: text('cover_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const songs = pgTable(
  'songs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    title: text('title').notNull(),
    albumId: bigint('album_id', { mode: 'number' }).references(() => albums.id),
    durationS: integer('duration_s'),
    genre: text('genre'),
    fileUrl: text('file_url').notNull(), // R2 object key / CDN path
    imageUrl: text('image_url'), // Jamendo cover-art URL (hot-linked; only audio is re-hosted)
    releaseDate: date('release_date'),
    jamendoId: text('jamendo_id').unique(), // idempotent ingest key
    license: text('license').notNull(), // CC license string
    attribution: text('attribution').notNull(), // rendered on display
    playCount: bigint('play_count', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('songs_genre_idx').on(t.genre),
    index('songs_ingested_at_idx').on(t.ingestedAt),
    index('songs_album_idx').on(t.albumId),
  ],
);

export const artistSongs = pgTable(
  'artist_songs',
  {
    songId: bigint('song_id', { mode: 'number' })
      .notNull()
      .references(() => songs.id),
    artistId: bigint('artist_id', { mode: 'number' })
      .notNull()
      .references(() => artists.id),
  },
  (t) => [primaryKey({ columns: [t.songId, t.artistId] })],
);

export const playlists = pgTable(
  'playlists',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ownerId: text('owner_id').notNull(), // Neon Auth user id
    name: text('name').notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('playlists_owner_idx').on(t.ownerId)],
);

export const playlistItems = pgTable(
  'playlist_items',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    playlistId: bigint('playlist_id', { mode: 'number' })
      .notNull()
      .references(() => playlists.id),
    songId: bigint('song_id', { mode: 'number' })
      .notNull()
      .references(() => songs.id),
    position: integer('position').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('playlist_items_playlist_idx').on(t.playlistId, t.position),
    // A song appears at most once per playlist — enforced by the database, not
    // by a check-then-insert (which races under concurrent adds).
    uniqueIndex('playlist_items_playlist_song_uq').on(t.playlistId, t.songId),
  ],
);

export const likes = pgTable(
  'likes',
  {
    userId: text('user_id').notNull(), // Neon Auth user id
    songId: bigint('song_id', { mode: 'number' })
      .notNull()
      .references(() => songs.id),
    likedAt: timestamp('liked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.songId] }),
    index('likes_user_idx').on(t.userId, t.likedAt),
  ],
);

export const follows = pgTable(
  'follows',
  {
    userId: text('user_id').notNull(), // Neon Auth user id
    artistId: bigint('artist_id', { mode: 'number' })
      .notNull()
      .references(() => artists.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId] })],
);

// App-owned profile (display name + avatar). Decoupled from Neon Auth so we
// control edits and photo storage; the UI falls back to the auth name/email
// when no profile row exists. avatarUrl holds a small client-resized data URL.
export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey(), // Neon Auth user id
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// One row per play (recorded when a track starts). Powers "top tracks this
// month". Append-only, event-style — at scale this rolls up into an aggregate;
// at this tier the (user_id, played_at) index serves the windowed top query.
export const plays = pgTable(
  'plays',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: text('user_id').notNull(), // Neon Auth user id
    songId: bigint('song_id', { mode: 'number' })
      .notNull()
      .references(() => songs.id),
    playedAt: timestamp('played_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('plays_user_played_idx').on(t.userId, t.playedAt)],
);

// ── Audiobooks (LibriVox, public domain) ────────────────────────────────────
// A book is the album-equivalent; a chapter is the track-equivalent. LibriVox
// recordings are public domain, so the audio is re-hosted in R2 (same as music)
// — unlike podcasts/radio, which will stream from source.

export const books = pgTable(
  'books',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    librivoxId: text('librivox_id').unique(), // idempotent ingest key
    title: text('title').notNull(),
    author: text('author'),
    reader: text('reader'), // LibriVox volunteer narrator(s)
    description: text('description'),
    coverUrl: text('cover_url'),
    language: text('language'),
    totalDurationS: integer('total_duration_s'), // set once at ingest (sum of chapters)
    license: text('license').notNull(), // public-domain mark
    attribution: text('attribution').notNull(), // rendered on display
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('books_ingested_at_idx').on(t.ingestedAt)],
);

export const bookChapters = pgTable(
  'book_chapters',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    bookId: bigint('book_id', { mode: 'number' })
      .notNull()
      .references(() => books.id),
    title: text('title').notNull(),
    position: integer('position').notNull(),
    durationS: integer('duration_s'),
    fileUrl: text('file_url').notNull(), // R2 object key / CDN path
    librivoxSectionId: text('librivox_section_id'), // source section id (provenance)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Ordering + idempotency: one chapter per position per book.
    uniqueIndex('book_chapters_book_position_uq').on(t.bookId, t.position),
  ],
);

export const syncState = pgTable('sync_state', {
  source: text('source').primaryKey(), // 'jamendo' | 'librivox'
  lastSynced: timestamp('last_synced', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});