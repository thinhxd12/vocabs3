CREATE TABLE IF NOT EXISTS "dictionary" ("word" text PRIMARY KEY, "pro" text, "mean" text NOT NULL);
ALTER TABLE "dictionary" ALTER COLUMN "mean" SET DATA TYPE jsonb USING to_jsonb("mean");
