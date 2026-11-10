# Contributing

Bug reports and pull requests are welcome.

## Setup

```sh
cp .env.example .env
docker compose up --build
```

For development without Docker, see "Running without Docker" in the README.

## Before you open a pull request

```sh
cd backend && go vet ./... && TEST_DATABASE_URL=... go test ./...
cd frontend && npm run build
```

CI runs the same checks. The test database URL must point at a throwaway Postgres, because the tests reset the `public` schema.

## Guidelines

- Keep changes small and focused. One topic per pull request.
- Add or update a test for backend behavior you change.
- Keep the backend as a flat Go package and the frontend free of UI frameworks, unless there is a clear reason.
- Use plain, descriptive commit messages.

## Screenshots and social image

`scripts/` holds Playwright scripts that regenerate `docs/screenshots` and `frontend/public/og.png`. They are developer tools and not part of the app.
