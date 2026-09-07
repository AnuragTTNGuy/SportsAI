import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const competitions = pgTable("competitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("football"),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("competitions_provider_idx").on(table.provider, table.providerId),
]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  sport: text("sport").notNull().default("football"),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("teams_provider_idx").on(table.provider, table.providerId),
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id").notNull().references(() => competitions.id),
  homeTeamId: uuid("home_team_id").notNull().references(() => teams.id),
  awayTeamId: uuid("away_team_id").notNull().references(() => teams.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  sport: text("sport").notNull().default("football"),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("events_provider_idx").on(table.provider, table.providerId),
  index("events_scheduled_at_idx").on(table.scheduledAt),
  index("events_competition_idx").on(table.competitionId),
]);

export const standings = pgTable("standings", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id").notNull().references(() => competitions.id),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  position: integer("position").notNull(),
  played: integer("played").notNull().default(0),
  won: integer("won").notNull().default(0),
  drawn: integer("drawn").notNull().default(0),
  lost: integer("lost").notNull().default(0),
  goalsFor: integer("goals_for").notNull().default(0),
  goalsAgainst: integer("goals_against").notNull().default(0),
  points: integer("points").notNull().default(0),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("standings_competition_captured_idx").on(table.competitionId, table.capturedAt),
]);

export const lineups = pgTable("lineups", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  formation: text("formation"),
  players: jsonb("players").notNull().$type<Array<{ name: string; position?: string; number?: number }>>(),
  confirmed: integer("confirmed").notNull().default(0),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("lineups_event_idx").on(table.eventId),
]);

export const statSnapshots = pgTable("stat_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id),
  teamId: uuid("team_id").references(() => teams.id),
  snapshotType: text("snapshot_type").notNull(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("stat_snapshots_event_idx").on(table.eventId),
  index("stat_snapshots_team_idx").on(table.teamId),
]);

export const evidenceRecords = pgTable("evidence_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  sourceStatIds: jsonb("source_stat_ids").notNull().$type<string[]>().default([]),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("evidence_event_type_idx").on(table.eventId, table.type),
  index("evidence_expires_at_idx").on(table.expiresAt),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_created_at_idx").on(table.createdAt),
]);
