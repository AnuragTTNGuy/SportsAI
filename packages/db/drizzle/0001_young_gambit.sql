CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"sport" text DEFAULT 'football' NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_provider_provider_id_unique" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"round_type" text,
	"current_round" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_provider_provider_id_unique" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"season_year" integer NOT NULL,
	"name" text NOT NULL,
	"current_season" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_provider_provider_id_unique" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "area_id" uuid;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "competition_key" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "competition_type" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "areas_provider_idx" ON "areas" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "rounds_season_idx" ON "rounds" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "rounds_provider_idx" ON "rounds" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "seasons_competition_idx" ON "seasons" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "seasons_provider_idx" ON "seasons" USING btree ("provider","provider_id");--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitions_area_idx" ON "competitions" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "stat_snapshots_type_idx" ON "stat_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_provider_provider_id_unique" UNIQUE("provider","provider_id");