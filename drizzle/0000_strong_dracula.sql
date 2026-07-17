CREATE TABLE "albums" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist_id" bigint,
	"release_date" date,
	"cover_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_songs" (
	"song_id" bigint NOT NULL,
	"artist_id" bigint NOT NULL,
	CONSTRAINT "artist_songs_song_id_artist_id_pk" PRIMARY KEY("song_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"user_id" text NOT NULL,
	"artist_id" bigint NOT NULL,
	CONSTRAINT "follows_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"user_id" text NOT NULL,
	"song_id" bigint NOT NULL,
	"liked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_user_id_song_id_pk" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"playlist_id" bigint NOT NULL,
	"song_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"album_id" bigint,
	"duration_s" integer,
	"genre" text,
	"file_url" text NOT NULL,
	"release_date" date,
	"jamendo_id" text,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"play_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "songs_jamendo_id_unique" UNIQUE("jamendo_id")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"source" text PRIMARY KEY NOT NULL,
	"last_synced" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_songs" ADD CONSTRAINT "artist_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_songs" ADD CONSTRAINT "artist_songs_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artists_name_idx" ON "artists" USING btree ("name");--> statement-breakpoint
CREATE INDEX "likes_user_idx" ON "likes" USING btree ("user_id","liked_at");--> statement-breakpoint
CREATE INDEX "playlist_items_playlist_idx" ON "playlist_items" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE INDEX "playlists_owner_idx" ON "playlists" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "songs_genre_idx" ON "songs" USING btree ("genre");--> statement-breakpoint
CREATE INDEX "songs_ingested_at_idx" ON "songs" USING btree ("ingested_at");--> statement-breakpoint
CREATE INDEX "songs_album_idx" ON "songs" USING btree ("album_id");