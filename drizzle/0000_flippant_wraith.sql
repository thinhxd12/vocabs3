CREATE TABLE "dashboard" (
	"user" text PRIMARY KEY NOT NULL,
	"currentHighlightId" uuid,
	"locations" jsonb,
	"progress" jsonb,
	"currentLocationId" uuid,
	"currentForecastModel" text,
	"fsrsparams" jsonb,
	"pomodoroSettings" jsonb,
	"fsrsWordBatchSize" integer DEFAULT 9,
	"words" jsonb
);
--> statement-breakpoint
CREATE TABLE "diary" (
	"user" text PRIMARY KEY NOT NULL,
	"currentHighlightId" uuid,
	"locations" jsonb,
	"progress" jsonb
);
--> statement-breakpoint
CREATE TABLE "fsrs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"word" text NOT NULL,
	"difficulty" double precision NOT NULL,
	"elapsed_days" integer NOT NULL,
	"lapses" integer NOT NULL,
	"learning_steps" integer NOT NULL,
	"reps" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"stability" double precision NOT NULL,
	"state" integer NOT NULL,
	"last_review" bigint NOT NULL,
	"due" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fsrsCompletions" (
	"batchId" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY NOT NULL,
	"authors" text NOT NULL,
	"bookTile" text NOT NULL,
	"page" integer NOT NULL,
	"location" text NOT NULL,
	"dateOfCreation" text NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"like" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pomodoro" (
	"date" date PRIMARY KEY NOT NULL,
	"time" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"index" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saddays" (
	"created_at" timestamp with time zone PRIMARY KEY NOT NULL
);
