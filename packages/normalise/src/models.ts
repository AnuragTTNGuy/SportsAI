export interface CanonicalTeam {
  provider: string;
  providerId: string;
  name: string;
  shortName?: string;
  sport: string;
}

export interface CanonicalCompetition {
  provider: string;
  providerId: string;
  name: string;
  sport: string;
}

export interface CanonicalEvent {
  provider: string;
  providerId: string;
  competitionProviderId: string;
  homeTeam: CanonicalTeam;
  awayTeam: CanonicalTeam;
  scheduledAt: Date;
  status: string;
  sport: string;
  homeScore?: number;
  awayScore?: number;
}

export interface CanonicalStanding {
  team: CanonicalTeam;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface MatchResult {
  opponent: string;
  result: "W" | "D" | "L";
  goalsFor: number;
  goalsAgainst: number;
  date: string;
}

export interface CanonicalTeamStats {
  team: CanonicalTeam;
  recentResults: MatchResult[];
  goalsScored: number;
  goalsConceded: number;
  bothTeamsScoredRate: number;
}

export interface CanonicalLineup {
  team: CanonicalTeam;
  formation?: string;
  players: Array<{ name: string; position?: string; number?: number }>;
  confirmed: boolean;
}

export interface HeadToHeadMeeting {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner?: "home" | "away" | "draw";
}

export interface HeadToHeadStats {
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  meetings: HeadToHeadMeeting[];
}
