# Embeddable iframe widgets

Partners can embed insight widgets on any site using **HTML iframes** served by the API. No React or platform SDK is required.

## Endpoints

| URL | Description |
|-----|-------------|
| `GET /embed/v1/events/{eventId}/widgets/{cardType}` | Single insight card |
| `GET /embed/v1/events/{eventId}/board` | All cards for the event in one page |

### `cardType` values

`form_guide`, `h2h`, `trend`, `over_under`, `correct_score`, `half_results`, `points_over_under`, `spread_cover`, `team_total`, `player_spotlight`, `game_preview`

## Swagger and copy UI

1. Start the API (`npm run dev` or `npm run swagger`).
2. Open [http://localhost:5000/docs](http://localhost:5000/docs), click **Authorize**, enter your API key.
3. Operations open with **Execute** visible by default (no **Try it out** click). For HTML embed routes, a **Widget preview** iframe appears under the response after you **Execute**.
4. Under **Embed**, call **`GET /v1/embed/events/{eventId}/iframe-snippets`** — copy **`iframeHtml`** from the JSON (preview loads from **`embedUrl`**).
5. Or open the **[iframe widget builder](http://localhost:5000/embed/docs/widget-builder)** for **Copy iframe code** buttons.

## Authentication

Iframe requests cannot set custom headers, so embed URLs accept the same API key as a **query parameter**:

```
https://your-api.example.com/embed/v1/events/{eventId}/widgets/h2h?apiKey=YOUR_KEY
```

You may also use the `X-API-Key` header when loading embed URLs from server-side tools.

Keys are configured via `API_KEYS` in the API environment (comma-separated).

## Example iframe

```html
<iframe
  src="http://127.0.0.1:5000/embed/v1/events/EVENT_UUID/widgets/h2h?apiKey=dev-key-1"
  title="Head to head"
  width="100%"
  height="320"
  style="border:0;border-radius:12px;"
  loading="lazy"
></iframe>
```

Full board:

```html
<iframe
  src="http://127.0.0.1:5000/embed/v1/events/EVENT_UUID/board?apiKey=dev-key-1"
  width="100%"
  height="720"
  style="border:0;"
></iframe>
```

## Cross-origin embedding

Embed responses set `Content-Security-Policy: frame-ancestors *` so parent pages on other domains can host the iframe.

## Demo in this repo

1. Start API and web (`npm run dev`, `npm run dev:web`).
2. Open a match’s **API insights** page.
3. Use **View embeddable iframe widgets** to preview each widget and copy iframe HTML.

The demo page loads widgets from the API; the standard insights page still uses JSON REST (`/v1/events/:id/insights`).

## Security notes

- Treat embed URLs like API credentials when `apiKey` is in the query string (visible in page source and browser history).
- For production, prefer **partner-specific keys**, rate limits (already enabled on the API), and HTTPS only.
- Insights must be computed first (worker, `compute:nba` / `compute:football`, or on-demand via the REST insights endpoint).
