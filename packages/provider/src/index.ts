export type { SportsDataProvider, ProviderConfig } from "./types.js";
export { createSportsDataIoProvider, deriveHeadToHeadFromGames } from "./sportsdataio/adapter.js";
export { createNbaProvider, deriveBasketballHeadToHeadFromGames } from "./sportsdataio/nba-adapter.js";
export {
  createNbaComProvider,
  getNbaSeasonString,
  getNbaSeasonStartYear,
  type NbaComProvider,
  type NbaComProviderConfig,
  type NbaComPlayerGameStat,
} from "./nba-com/adapter.js";
export {
  createEspnNbaProvider,
  getEspnSeasonYear,
  type EspnNbaProvider,
  type EspnNbaProviderConfig,
} from "./espn-nba/adapter.js";
export {
  NBA_TEAMS,
  findNbaTeamById,
  findNbaTeamByEspnId,
  findNbaTeamByKey,
  nbaTeamFullName,
} from "./nba-com/teams.js";
