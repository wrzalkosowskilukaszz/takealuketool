# Deployment: Vercel + Neon

The app needs a Next.js host, a Postgres database and an hourly call to `/api/cron/tick`. The plan is
Vercel (Hobby is fine for personal use) and Neon (Free tier), region Frankfurt.

## 1. Database (Neon)

1. Create a Neon project in **AWS Europe Central 1 (Frankfurt)**.
2. Copy the **pooled** connection string (host contains `-pooler`), with `sslmode=require`.
3. From your computer, with the other values in `.env.local`:

   ```bash
   DATABASE_URL='postgres://…-pooler…/neondb?sslmode=require' pnpm db:migrate
   DATABASE_URL='…' pnpm companies:import
   ```

## 2. App (Vercel)

1. Import `wrzalkosowskilukaszz/takealuketool` into Vercel. Framework: Next.js. Region `fra1` is set in
   `vercel.json`.
2. Environment variables (Production):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon pooled string |
   | `APP_URL` | the production URL, e.g. `https://takealuke.vercel.app` |
   | `APP_PASSWORD_HASH` | from `pnpm hash-password` |
   | `SESSION_SECRET` | `openssl rand -base64 48` |
   | `CRON_SECRET` | a random string; Vercel sends it to the cron endpoint itself |
   | `DIGEST_TOKEN` | a random string for the morning digest |
   | `DB_POOL_MAX` | `2` |
   | optional | `ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY` |

3. Deploy. `vercel.json` registers 24 daily cron entries (one per hour at :05), which is how an hourly
   tick works on Hobby, where each cron entry may run once a day.

## 3. Check it

- `https://<app>/api/health` answers `{"ok":true,"db":true}`.
- After the next full hour, **Settings → Health** shows the last tick and which job boards answered.
- `curl -H "Authorization: Bearer $DIGEST_TOKEN" https://<app>/api/digest` returns the digest.

## 4. Morning digest in the project thread

A Claude routine runs every day at 08:30 Warsaw time, reads `GET /api/digest?mark=1` with the
`DIGEST_TOKEN`, and posts the Markdown to the Take a Luke Studio project thread. It needs the production
URL, the token, and network access from the routine's environment to that URL.
