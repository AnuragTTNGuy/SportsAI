import type {
  AreasCatalog,
  CanonicalCompetition,
  CanonicalEvent,
  CanonicalLineup,
  CanonicalStanding,
  CanonicalTeamStats,
} from "@sports-insights/normalise";

export interface SportsDataProvider {
  readonly name: string;
  getAreas(): Promise<AreasCatalog>;
  getCompetitions(): Promise<CanonicalCompetition[]>;
  getSchedules(competitionProviderId: string, date: Date): Promise<CanonicalEvent[]>;
  getSchedulesByDate(date: Date): Promise<CanonicalEvent[]>;
  getStandings(competitionProviderId: string): Promise<CanonicalStanding[]>;
  getTeamStats(teamProviderId: string, lastN: number): Promise<CanonicalTeamStats>;
  getLineups(eventProviderId: string): Promise<CanonicalLineup[]>;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
}
