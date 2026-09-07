import type { HeadToHeadStats } from "@sports-insights/normalise";

export interface H2HPayload {
  summary: string;
  stats: {
    homeTeamWins: number;
    awayTeamWins: number;
    draws: number;
  };
  meetings: HeadToHeadStats["meetings"];
}

export function deriveH2H(
  homeTeamName: string,
  awayTeamName: string,
  h2h: HeadToHeadStats,
): H2HPayload {
  const total = h2h.meetings.length;
  const summary = total
    ? `${homeTeamName} has won ${h2h.homeTeamWins} of the last ${total} meetings against ${awayTeamName}`
    : `No recent head-to-head meetings found between ${homeTeamName} and ${awayTeamName}`;

  return {
    summary,
    stats: {
      homeTeamWins: h2h.homeTeamWins,
      awayTeamWins: h2h.awayTeamWins,
      draws: h2h.draws,
    },
    meetings: h2h.meetings,
  };
}
