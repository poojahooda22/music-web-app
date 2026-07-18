CREATE TABLE "book_chapters" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"book_id" bigint NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"duration_s" integer,
	"file_url" text NOT NULL,
	"librivox_section_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"librivox_id" text,
	"title" text NOT NULL,
	"author" text,
	"reader" text,
	"description" text,
	"cover_url" text,
	"language" text,
	"total_duration_s" integer,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_librivox_id_unique" UNIQUE("librivox_id")
);
--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_chapters_book_position_uq" ON "book_chapters" USING btree ("book_id","position");--> statement-breakpoint
CREATE INDEX "books_ingested_at_idx" ON "books" USING btree ("ingested_at");