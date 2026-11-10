# LinkTrack

[![CI](https://github.com/SuyashVJain/linktrack/actions/workflows/ci.yml/badge.svg)](https://github.com/SuyashVJain/linktrack/actions/workflows/ci.yml)
[![Go version](https://img.shields.io/github/go-mod/go-version/SuyashVJain/linktrack?filename=backend%2Fgo.mod)](backend/go.mod)
[![License: MIT](https://img.shields.io/github/license/SuyashVJain/linktrack)](LICENSE)

LinkTrack is a self-hosted link shortener with click analytics. Anyone can shorten a URL without an account and get a private stats link; signing up moves those links to an account so they follow you across devices. It is a single Go binary backed by PostgreSQL that serves the API, the redirects and a React frontend.

![Landing page](docs/screenshots/landing.png)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/result.png" alt="Link created, with QR code and private stats link"></td>
    <td width="50%"><img src="docs/screenshots/stats.png" alt="Stats page with 30-day chart and top referrers"></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/my-links.png" alt="My links table with click totals and trend sparklines"></td>
  </tr>
</table>

The screenshots use seeded demo data. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to regenerate them.

## Features

**Guest mode (no account)**
- Shorten a URL with an optional custom slug and label
- Each link gets a private stats URL; anyone holding it can view stats or delete the link
- Guest links are remembered in the browser and listed under "My links"
- QR code with PNG download

**Account mode**
- Register and log in (bcrypt, JWT with 24h expiry)
- Links belong to your account and are available on any device
- On login or register, guest links from the current browser are moved to the account

**Both**
- 302 redirects; clicks are recorded asynchronously so redirects stay fast
- Per-link stats: total clicks, clicks per day for the last 30 days, top referrers
- Per-IP rate limiting on redirects, auth and guest link creation
- Request logging, graceful shutdown, `/healthz`

## Tech stack

- Backend: Go, `net/http` with chi, pgx
- Database: PostgreSQL 16, plain SQL migrations embedded in the binary and applied at startup
- Frontend: React, Vite, Tailwind CSS, qrcode.react; fonts are self-hosted
- Packaging: multi-stage Docker image, Docker Compose
- CI: GitHub Actions (`go vet`, Go tests against Postgres, frontend build)

## Architecture

```mermaid
flowchart LR
    Visitor -->|GET /slug| API
    Browser[Web app] -->|/api/*| API
    Browser -->|/app/*| API
    API[Go server] --> DB[(PostgreSQL)]
    API -.->|goroutine, after the 302| Clicks[clicks table]
    Clicks --- DB
```

One Go binary serves the JSON API, the public redirect, and the built frontend under `/app/`. A redirect looks up the slug, answers with a 302, and writes the click row in a goroutine; shutdown waits for pending writes. Stats are SQL aggregates, with `generate_series` filling days that have no clicks.

```
backend/    Go API (flat package) and migrations/
frontend/   React app, History API router, no UI framework
scripts/    Playwright scripts for screenshots and the social image
docs/       README screenshots
```

## Quick start

```sh
cp .env.example .env     # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
```

Open http://localhost:8080/app/. Short links are served at `http://localhost:8080/{slug}`.

### Running without Docker

Requires Go 1.26+, Node 20+, and Postgres.

```sh
export DATABASE_URL='postgres://user:pass@localhost:5432/linktrack?sslmode=disable'
export JWT_SECRET='a-long-random-string'
cd backend && go run .

# second terminal: dev server on :5173, proxies /api to :8080
cd frontend && npm install && npm run dev
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | | Postgres connection string |
| `JWT_SECRET` | yes | | HMAC key for signing tokens |
| `BASE_URL` | no | `http://localhost:8080` | Public origin used to build `short_url` |
| `TRUST_PROXY` | no | `false` | If `true`, the client IP for rate limiting is the last `X-Forwarded-For` entry |
| `ADDR` | no | `:8080` | Listen address |
| `STATIC_DIR` | no | | Built frontend directory, served at `/app/` (set in the Docker image) |

Docker Compose also reads `POSTGRES_PASSWORD`.

## API

Authenticated routes expect `Authorization: Bearer <token>`. `POST /api/links` accepts requests with or without a token; an invalid token is rejected with 401.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | no | `{email, password}` (8-72 chars) returns `{token}` |
| POST | `/api/auth/login` | no | `{email, password}` returns `{token}` |
| POST | `/api/links` | optional | `{target_url, slug?, label?}` returns `{slug, short_url, stats_token, ...}`. Owned by the caller, or by nobody for guests (rate limited per IP). 409 if the slug is taken |
| GET | `/api/links` | yes | Your links with total click counts |
| DELETE | `/api/links/{id}` | yes | Delete one of your links |
| GET | `/api/links/{id}/stats` | yes | Stats for one of your links |
| POST | `/api/links/claim` | yes | `{tokens: [...]}` assigns ownerless links to you, returns `{claimed}`. Links that already have an owner are never reassigned |
| GET | `/api/stats/{token}` | token | `link`, `total_clicks`, `clicks_per_day` (30 days), `top_referrers` |
| DELETE | `/api/stats/{token}` | token | Delete the link identified by the token |
| GET | `/{slug}` | no | 302 to the target URL, 404 if unknown |
| GET | `/healthz` | no | Liveness and database check |

Slugs are 3-32 characters of letters, digits, `-` and `_`. `app`, `api` and `healthz` are reserved.

## Tests

Integration tests need a Postgres database and reset its `public` schema, so use a throwaway one. Without `TEST_DATABASE_URL` they are skipped.

```sh
docker run -d --rm --name linktrack-testdb -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=linktrack_test -p 55432:5432 postgres:16-alpine

cd backend
TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/linktrack_test?sslmode=disable' go test ./...
```

The frontend has no test suite; `npm run build` in `frontend/` is the check. CI runs both.

## Deployment

- **Database:** create a Neon project and use its connection string as `DATABASE_URL` (keep `sslmode=require`). Migrations run on startup.
- **Container:** build with `docker build -f backend/Dockerfile .` from the repository root. Render (Docker web service) and Fly.io both work; set the environment variables above and expose port 8080.
- **`BASE_URL`:** set to the public origin, for example `https://links.example.com`. It is used for every `short_url` and QR code.
- **`TRUST_PROXY`:** both platforms put a proxy in front of the container. Set `TRUST_PROXY=true` so rate limiting sees real client IPs; leave it `false` if the container is directly exposed, because clients can then forge the header.
- Use a long random `JWT_SECRET`.

## Roadmap

Ideas, not commitments:

- Country on clicks (the `clicks.country` column exists but is not populated)
- Rotate or regenerate a stats token
- Link expiry
- Rate limiting shared across instances
- Password reset and email verification

## Known limitations

- A stats token is a bearer secret: whoever has it can view stats and delete the link. There is no way to rotate it.
- Guest links are tracked in the browser's local storage. Clearing it loses the list (the stats URL still works if saved) until the links are claimed.
- Rate limiting is in memory and per process.
- Redirects are not checked against a blocklist, so the service can link to anything over http or https. Add abuse controls before exposing it publicly.
- The frontend has no automated tests.

## License

[MIT](LICENSE)
