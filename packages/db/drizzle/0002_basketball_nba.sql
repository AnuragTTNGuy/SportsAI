-- NBA / Basketball POC schema
CREATE TABLE IF NOT EXISTS "nba_venues" (
  "venue_id" integer PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "city" text,
  "state" text,
  "country" text DEFAULT 'USA',
  "capacity" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "nba_team_profiles" (
  "team_id" integer PRIMARY KEY NOT NULL,
  "team_uuid" uuid,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "city" text,
  "conference" text,
  "division" text,
  "primary_color" text,
  "secondary_color" text,
  "head_coach" text,
  "venue_id" integer REFERENCES "nba_venues"("venue_id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "nba_team_profiles_team_uuid_idx" ON "nba_team_profiles" ("team_uuid");

CREATE TABLE IF NOT EXISTS "nba_players" (
  "player_id" integer PRIMARY KEY NOT NULL,
  "team_id" integer REFERENCES "nba_team_profiles"("team_id"),
  "first_name" text,
  "last_name" text,
  "full_name" text NOT NULL,
  "position" text,
  "jersey_number" integer,
  "height_inches" integer,
  "weight_lbs" integer,
  "birth_date" date,
  "college" text,
  "experience" integer,
  "status" text,
  "injury_status" text,
  "injury_body_part" text,
  "injury_note" text,
  "headshot_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "nba_players_team_idx" ON "nba_players" ("team_id");

CREATE TABLE IF NOT EXISTS "nba_games" (
  "game_id" integer PRIMARY KEY NOT NULL,
  "event_id" uuid,
  "season_year" integer NOT NULL,
  "season_type" text NOT NULL,
  "game_date" date NOT NULL,
  "game_datetime" timestamp with time zone,
  "home_team_id" integer REFERENCES "nba_team_profiles"("team_id"),
  "away_team_id" integer REFERENCES "nba_team_profiles"("team_id"),
  "venue_id" integer REFERENCES "nba_venues"("venue_id"),
  "home_score" integer,
  "away_score" integer,
  "status" text,
  "current_quarter" integer,
  "time_remaining" text,
  "attendance" integer,
  "is_overtime" boolean DEFAULT false,
  "overtime_periods" integer DEFAULT 0,
  "neutral_venue" boolean DEFAULT false,
  "channel" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "nba_games_event_idx" ON "nba_games" ("event_id");
CREATE INDEX IF NOT EXISTS "nba_games_date_idx" ON "nba_games" ("game_date");

CREATE TABLE IF NOT EXISTS "nba_player_game_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "game_id" integer NOT NULL REFERENCES "nba_games"("game_id"),
  "player_id" integer NOT NULL REFERENCES "nba_players"("player_id"),
  "team_id" integer NOT NULL REFERENCES "nba_team_profiles"("team_id"),
  "opponent_team_id" integer REFERENCES "nba_team_profiles"("team_id"),
  "season_year" integer NOT NULL,
  "game_date" date NOT NULL,
  "home_or_away" text,
  "is_starter" boolean,
  "did_not_play" boolean DEFAULT false,
  "minutes" numeric(5, 2),
  "points" integer,
  "rebounds" integer,
  "assists" integer,
  "steals" integer,
  "blocks" integer,
  "turnovers" integer,
  "field_goals_made" integer,
  "field_goals_attempted" integer,
  "three_pointers_made" integer,
  "three_pointers_attempted" integer,
  "free_throws_made" integer,
  "free_throws_attempted" integer,
  "plus_minus" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "nba_player_game_stats_game_player_unique" UNIQUE("game_id","player_id")
);

CREATE INDEX IF NOT EXISTS "nba_player_game_stats_player_idx" ON "nba_player_game_stats" ("player_id");

CREATE TABLE IF NOT EXISTS "nba_team_game_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "game_id" integer NOT NULL REFERENCES "nba_games"("game_id"),
  "team_id" integer NOT NULL REFERENCES "nba_team_profiles"("team_id"),
  "opponent_team_id" integer REFERENCES "nba_team_profiles"("team_id"),
  "season_year" integer NOT NULL,
  "game_date" date NOT NULL,
  "home_or_away" text,
  "won" boolean,
  "points" integer,
  "opponent_points" integer,
  "rebounds" integer,
  "assists" integer,
  "field_goals_pct" numeric(5, 4),
  "three_pointers_pct" numeric(5, 4),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "nba_team_game_stats_game_team_unique" UNIQUE("game_id","team_id")
);

CREATE INDEX IF NOT EXISTS "nba_team_game_stats_team_idx" ON "nba_team_game_stats" ("team_id");

CREATE TABLE IF NOT EXISTS "nba_team_season_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "nba_team_profiles"("team_id"),
  "season_year" integer NOT NULL,
  "season_type" text DEFAULT 'REG',
  "games_played" integer,
  "wins" integer,
  "losses" integer,
  "points_per_game" numeric(6, 2),
  "opponent_points_per_game" numeric(6, 2),
  "point_differential" numeric(6, 2),
  "rebounds_per_game" numeric(5, 2),
  "assists_per_game" numeric(5, 2),
  "home_wins" integer,
  "home_losses" integer,
  "away_wins" integer,
  "away_losses" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "nba_team_season_stats_team_season_unique" UNIQUE("team_id","season_year","season_type")
);

CREATE TABLE IF NOT EXISTS "nba_standings" (
  "id" serial PRIMARY KEY NOT NULL,
  "team_id" integer NOT NULL REFERENCES "nba_team_profiles"("team_id"),
  "season_year" integer NOT NULL,
  "season_type" text DEFAULT 'REG',
  "wins" integer,
  "losses" integer,
  "win_pct" numeric(5, 4),
  "games_back" numeric(5, 1),
  "conference_rank" integer,
  "division_rank" integer,
  "league_rank" integer,
  "home_wins" integer,
  "home_losses" integer,
  "away_wins" integer,
  "away_losses" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "nba_standings_team_season_unique" UNIQUE("team_id","season_year","season_type")
);

CREATE INDEX IF NOT EXISTS "competitions_sport_idx" ON "competitions" ("sport");
CREATE INDEX IF NOT EXISTS "events_sport_idx" ON "events" ("sport");
