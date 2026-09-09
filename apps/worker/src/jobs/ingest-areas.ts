import type { Database } from "@sports-insights/db";
import type { CacheClient } from "@sports-insights/cache";
import { createSportsDataIoProvider } from "@sports-insights/provider";
import {
  buildAreasCatalogResponse,
  ingestAreasCatalog,
  writeAuditLog,
} from "@sports-insights/evidence";
import { CACHE_TTL } from "@sports-insights/shared";

function getProvider() {
  const apiKey = process.env.SPORTSDATAIO_API_KEY ?? "";
  const baseUrl = process.env.SPORTSDATAIO_BASE_URL ?? "https://api.sportsdata.io/v4/soccer";

  if (!apiKey) {
    throw new Error("SPORTSDATAIO_API_KEY is required for ingest-areas");
  }

  return createSportsDataIoProvider({ apiKey, baseUrl });
}

export async function runIngestAreasJob(db: Database, cache: CacheClient) {
  const provider = getProvider();
  const catalog = await provider.getAreas();
  const counts = await ingestAreasCatalog(db, catalog);
  const response = await buildAreasCatalogResponse(db);

  await cache.setAreasCatalog(response, CACHE_TTL.areasCatalog);
  await writeAuditLog(db, "ingest_areas", "areas", undefined, counts);

  console.log(
    `Ingested Areas catalog: ${counts.areas} areas, ${counts.competitions} competitions, ${counts.seasons} seasons, ${counts.rounds} rounds`,
  );

  return counts;
}
