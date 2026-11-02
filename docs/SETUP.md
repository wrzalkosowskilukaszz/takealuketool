# Setup

## What you need

- Node 22 and pnpm 10.
- Postgres 16 or newer (local, Docker, or Neon).
- Optional: an Anthropic API key (Claude), Adzuna and Jooble keys (Polish offers).

## Steps

1. `pnpm install`
2. `cp .env.example .env.local` and fill in:
   - `DATABASE_URL`: e.g. `postgres://tals:tals@localhost:5432/tals_dev`
   - `SESSION_SECRET`: `openssl rand -base64 48`
   - `CRON_SECRET`: any random string of 12+ characters
   - `APP_PASSWORD_HASH`: run `pnpm hash-password` and paste the result
   - `DIGEST_TOKEN`: a random string, if you want the morning digest
3. `pnpm db:migrate` creates the tables.
4. `pnpm companies:import` loads the 334 suggested companies. Safe to run again; your favourites and
   exclusions are kept.
5. `pnpm dev`, open http://localhost:3000 and sign in.
6. In **Settings → Your CV**, upload the CV (PDF or DOCX). Only its text is kept.
7. Press **Refresh now** on Matches, or run `pnpm worker tick --seconds 300`.

## Keys worth adding

| Key | Why | Where |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude's fit scores, cover letters, the Grow advisor | console.anthropic.com. Set a monthly spend limit there too. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | The best free source of Polish offers | developer.adzuna.com |
| `JOOBLE_API_KEY` | More Polish offers | jooble.org/api/about |

## Tests

- `pnpm verify` runs Biome, the TypeScript check and Vitest.
- Integration tests use a disposable database in `TEST_DATABASE_URL` (they wipe it) and are skipped
  without it.
- `pnpm e2e` runs Playwright smoke tests against `E2E_BASE_URL` with `E2E_PASSWORD`.
