# Sports Insights Platform

Evidence-backed sports insights API for football events. The platform ingests match data, computes insights (form, head-to-head, trends, stats, lineups), and serves them through a REST API.

## Prerequisites

- **Node.js** 22 or later
- **npm** (workspaces)
- **Docker** for PostgreSQL and Redis

On macOS without Docker Desktop, you can use [Colima](https://github.com/abiosoft/colima):

```bash
brew install colima docker docker-compose
colima start
docker context use colima
```

If using Docker Desktop, install it and ensure `docker compose` is available.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SPORTSDATAIO_API_KEY` | API key from [SportsDataIO](https://sportsdata.io/) (required for live ingest) |
| `SPORTSDATAIO_BASE_URL` | SportsDataIO soccer API base URL |
| `API_KEYS` | Comma-separated API keys accepted by the REST API |
| `PORT` | API server port (default: `5000`) |

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts:

- **PostgreSQL** on port `5432`
- **Redis** on port `6379`

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Seed demo data

Loads a sample Arsenal vs Chelsea match with insights, stats, and lineups:

```bash
npm run seed
```

> **Note:** Seeded evidence expires after 15–120 minutes. Re-run `npm run seed` if insights return empty.

### 6. Start the API

```bash
npm run dev
```

The API runs at [http://localhost:5000](http://localhost:5000).

### 7. (Optional) Start the worker

For live data ingestion and insight computation from SportsDataIO:

```bash
npm run dev:worker
```

The worker schedules jobs to ingest areas, schedules, standings, and compute insights.

## API Documentation

Swagger UI is available at:

**[http://localhost:5000/docs](http://localhost:5000/docs)**

### Authentication

All `/v1/*` endpoints require an `X-API-Key` header.

1. Click **Authorize** in Swagger UI
2. Enter one of your configured keys (e.g. `dev-key-1` from `.env`)
3. Click **Authorize**, then **Close**

### Health check

```bash
curl http://localhost:5000/health
```

### List events

```bash
curl -H "X-API-Key: dev-key-1" \
  "http://localhost:5000/v1/events?date=2026-09-08&sport=football"
```

Use `sport=football` (not `soccer`). Date format is `YYYY-MM-DD`.

### Get full insights for an event

```bash
curl -H "X-API-Key: dev-key-1" \
  "http://localhost:5000/v1/events/{eventId}/insights"
```

### Other endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/events/{eventId}/insights/cards` | Insight cards only |
| `GET /v1/events/{eventId}/stats` | Team stats |
| `GET /v1/events/{eventId}/lineup` | Lineups |
| `GET /v1/competitions/{compId}/ladder` | Competition standings |
| `GET /v1/areas` | Areas, competitions, seasons catalog |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API in watch mode |
| `npm run dev:worker` | Start background worker |
| `npm run build` | Build all workspaces |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:generate` | Generate new Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run seed` | Seed demo match and insights |
| `npm run ingest:areas` | One-off ingest of areas catalog |
| `npm run typecheck` | Type-check all workspaces |

## Project Structure

```
sports-insights-platform/
├── apps/
│   ├── api/          # Fastify REST API
│   └── worker/       # BullMQ ingest & compute jobs
├── packages/
│   ├── cache/        # Redis client
│   ├── db/           # Drizzle schema & migrations
│   ├── derive/       # Insight derivation logic
│   ├── evidence/     # Evidence storage & API helpers
│   ├── normalise/    # Canonical data models
│   ├── provider/     # SportsDataIO adapter
│   └── shared/       # Shared types & schemas
└── docker-compose.yml
```

## Data Flow

1. **Ingest** — Worker pulls schedules, standings, and areas from SportsDataIO
2. **Compute** — Worker derives form, H2H, trends, stats, and lineups per event
3. **Store** — Evidence is saved to PostgreSQL with TTL-based expiry
4. **Serve** — API reads evidence (with Redis caching) and returns insight payloads

For local development without live ingest, `npm run seed` provides a fully populated demo event.

## Troubleshooting

### `docker: command not found`

Install Docker Desktop or Colima (see Prerequisites).

### `docker compose` fails with socket error

If using Colima:

```bash
colima start
docker context use colima
```

### `DATABASE_URL is required` when seeding

Ensure `.env` exists at the repo root. Scripts load it via `--env-file=../../.env`.

### Empty insights / stats

Evidence expires quickly. Re-seed:

```bash
npm run seed
```

### Events list returns `[]`

- Use `sport=football`
- Try the next calendar day if the match was seeded with a UTC timestamp near midnight in your timezone
- Re-run seed to refresh the scheduled date

### Swagger returns 401 Unauthorized

Authorize in Swagger UI with `dev-key-1` (or another key from `API_KEYS` in `.env`).
