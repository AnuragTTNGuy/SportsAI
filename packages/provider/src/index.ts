export type { SportsDataProvider, ProviderConfig } from "./types.js";
export { createSportsDataIoProvider, deriveHeadToHeadFromGames } from "./sportsdataio/adapter.js";
export { createNbaProvider, deriveBasketballHeadToHeadFromGames } from "./sportsdataio/nba-adapter.js";
