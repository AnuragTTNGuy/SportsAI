/** Static NBA team catalog (stats.nba.com IDs + ESPN site API ids/abbreviations). */
export const NBA_TEAMS = [
  { teamId: 1610612737, espnId: 1, key: "ATL", espnKey: "ATL", city: "Atlanta", name: "Hawks", conference: "East", division: "Southeast" },
  { teamId: 1610612738, espnId: 2, key: "BOS", espnKey: "BOS", city: "Boston", name: "Celtics", conference: "East", division: "Atlantic" },
  { teamId: 1610612739, espnId: 5, key: "CLE", espnKey: "CLE", city: "Cleveland", name: "Cavaliers", conference: "East", division: "Central" },
  { teamId: 1610612740, espnId: 3, key: "NOP", espnKey: "NO", city: "New Orleans", name: "Pelicans", conference: "West", division: "Southwest" },
  { teamId: 1610612741, espnId: 4, key: "CHI", espnKey: "CHI", city: "Chicago", name: "Bulls", conference: "East", division: "Central" },
  { teamId: 1610612742, espnId: 6, key: "DAL", espnKey: "DAL", city: "Dallas", name: "Mavericks", conference: "West", division: "Southwest" },
  { teamId: 1610612743, espnId: 7, key: "DEN", espnKey: "DEN", city: "Denver", name: "Nuggets", conference: "West", division: "Northwest" },
  { teamId: 1610612744, espnId: 9, key: "GSW", espnKey: "GS", city: "Golden State", name: "Warriors", conference: "West", division: "Pacific" },
  { teamId: 1610612745, espnId: 10, key: "HOU", espnKey: "HOU", city: "Houston", name: "Rockets", conference: "West", division: "Southwest" },
  { teamId: 1610612746, espnId: 12, key: "LAC", espnKey: "LAC", city: "LA", name: "Clippers", conference: "West", division: "Pacific" },
  { teamId: 1610612747, espnId: 13, key: "LAL", espnKey: "LAL", city: "Los Angeles", name: "Lakers", conference: "West", division: "Pacific" },
  { teamId: 1610612748, espnId: 14, key: "MIA", espnKey: "MIA", city: "Miami", name: "Heat", conference: "East", division: "Southeast" },
  { teamId: 1610612749, espnId: 15, key: "MIL", espnKey: "MIL", city: "Milwaukee", name: "Bucks", conference: "East", division: "Central" },
  { teamId: 1610612750, espnId: 16, key: "MIN", espnKey: "MIN", city: "Minnesota", name: "Timberwolves", conference: "West", division: "Northwest" },
  { teamId: 1610612751, espnId: 17, key: "BKN", espnKey: "BKN", city: "Brooklyn", name: "Nets", conference: "East", division: "Atlantic" },
  { teamId: 1610612752, espnId: 18, key: "NYK", espnKey: "NY", city: "New York", name: "Knicks", conference: "East", division: "Atlantic" },
  { teamId: 1610612753, espnId: 19, key: "ORL", espnKey: "ORL", city: "Orlando", name: "Magic", conference: "East", division: "Southeast" },
  { teamId: 1610612754, espnId: 11, key: "IND", espnKey: "IND", city: "Indiana", name: "Pacers", conference: "East", division: "Central" },
  { teamId: 1610612755, espnId: 20, key: "PHI", espnKey: "PHI", city: "Philadelphia", name: "76ers", conference: "East", division: "Atlantic" },
  { teamId: 1610612756, espnId: 21, key: "PHX", espnKey: "PHX", city: "Phoenix", name: "Suns", conference: "West", division: "Pacific" },
  { teamId: 1610612757, espnId: 22, key: "POR", espnKey: "POR", city: "Portland", name: "Trail Blazers", conference: "West", division: "Northwest" },
  { teamId: 1610612758, espnId: 23, key: "SAC", espnKey: "SAC", city: "Sacramento", name: "Kings", conference: "West", division: "Pacific" },
  { teamId: 1610612759, espnId: 24, key: "SAS", espnKey: "SA", city: "San Antonio", name: "Spurs", conference: "West", division: "Southwest" },
  { teamId: 1610612760, espnId: 25, key: "OKC", espnKey: "OKC", city: "Oklahoma City", name: "Thunder", conference: "West", division: "Northwest" },
  { teamId: 1610612761, espnId: 28, key: "TOR", espnKey: "TOR", city: "Toronto", name: "Raptors", conference: "East", division: "Atlantic" },
  { teamId: 1610612762, espnId: 26, key: "UTA", espnKey: "UTAH", city: "Utah", name: "Jazz", conference: "West", division: "Northwest" },
  { teamId: 1610612763, espnId: 29, key: "MEM", espnKey: "MEM", city: "Memphis", name: "Grizzlies", conference: "West", division: "Southwest" },
  { teamId: 1610612764, espnId: 27, key: "WAS", espnKey: "WSH", city: "Washington", name: "Wizards", conference: "East", division: "Southeast" },
  { teamId: 1610612765, espnId: 8, key: "DET", espnKey: "DET", city: "Detroit", name: "Pistons", conference: "East", division: "Central" },
  { teamId: 1610612766, espnId: 30, key: "CHA", espnKey: "CHA", city: "Charlotte", name: "Hornets", conference: "East", division: "Southeast" },
] as const;

export function findNbaTeamById(teamId: number | string) {
  const id = Number(teamId);
  return NBA_TEAMS.find((team) => team.teamId === id);
}

export function findNbaTeamByEspnId(espnId: number | string) {
  const id = Number(espnId);
  return NBA_TEAMS.find((team) => team.espnId === id);
}

export function findNbaTeamByKey(key: string) {
  const normalized = key.trim().toUpperCase();
  return NBA_TEAMS.find(
    (team) => team.key === normalized || team.espnKey === normalized,
  );
}

export function nbaTeamFullName(team: { city: string; name: string }) {
  return `${team.city} ${team.name}`.trim();
}
