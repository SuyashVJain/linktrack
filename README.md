# linktrack

A link shortener with click analytics. Create short links, share them, and see how many people clicked, when, and from where.

## Features

- Register and log in (bcrypt password hashing, JWT with 24h expiry)
- Create short links with a random 6-character slug or a custom one; target URLs are validated
- Public `/{slug}` redirect (302) that records each click without slowing the redirect
- Per-link stats: total clicks, clicks per day for the last 30 days, top referrers
- Per-IP rate limiting on auth and redirect routes
- Request logging, graceful shutdown, `/healthz`

## Tech stack

- Backend: Go, `net/http` with chi, pgx
- Database: PostgreSQL 16, plain SQL migrations embedded in the binary
- Frontend: React, Vite, Tailwind CSS (stats chart is plain SVG)
- Docker: multi-stage image, Docker Compose

## Architecture

A single Go binary serves the JSON API, the public redirect route, and the built frontend (under `/app/`). Migrations in `backend/migrations` run at startup. A redirect looks up the slug, responds with a 302, and writes the click row in a goroutine; shutdown waits for pending writes. Stats come from SQL aggregates (`generate_series` fills days with no clicks).

```
backend/    Go API (flat package: server, auth, links, middleware, migrations/)
frontend/   React app (hash-routed, no router dependency)
```

## Run with Docker

```sh
cp .env.example .env     # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build
```

Open http://localhost:8080/app/. Short links are served at `http://localhost:8080/{slug}`.

## Run locally

Requires Go 1.26+, Node 20+, and a Postgres instance.

```sh
# backend
export DATABASE_URL='postgres://user:pass@localhost:5432/linktrack?sslmode=disable'
export JWT_SECRET='a-long-random-string'
cd backend && go run .

# frontend (separate terminal; proxies /api to :8080)
cd frontend && npm install && npm run dev
```

The dev frontend runs at http://localhost:5173/app/. Short links copied from it point at the dev server origin, so test redirects against the backend on port 8080.

### Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | | Postgres connection string |
| `JWT_SECRET` | yes | | HMAC key for signing tokens |
| `ADDR` | no | `:8080` | Listen address |
| `STATIC_DIR` | no | | Directory with the built frontend, served at `/app/` |

## API

Authenticated routes expect `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | no | `{email, password}` (8-72 chars) returns `{token}` |
| POST | `/api/auth/login` | no | `{email, password}` returns `{token}` |
| POST | `/api/links` | yes | `{target_url, slug?, label?}`; 409 if the slug is taken |
| GET | `/api/links` | yes | Your links with total click counts |
| DELETE | `/api/links/{id}` | yes | Delete a link and its clicks |
| GET | `/api/links/{id}/stats` | yes | `total_clicks`, `clicks_per_day` (30 days), `top_referrers` |
| GET | `/{slug}` | no | 302 to the target URL, 404 if unknown |
| GET | `/healthz` | no | Liveness and database check |

## Tests

Integration tests need a Postgres database. They reset the `public` schema, so use a throwaway database. Without `TEST_DATABASE_URL` they are skipped.

```sh
docker run -d --rm --name linktrack-testdb -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=linktrack_test -p 55432:5432 postgres:16-alpine

cd backend
TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/linktrack_test?sslmode=disable' go test ./...
```

## Notes

- Rate limiting keys on the connection's remote address. Behind a reverse proxy, configure trusted forwarded headers first or all clients share one limit.
- The `clicks.country` column exists but is not populated; there is no geo lookup.
