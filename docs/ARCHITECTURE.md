# Architecture

Next.js 16 (App Router, React 19), TypeScript, Drizzle ORM on Postgres, Zod, Biome, Vitest.
One user, one password. Everything runs in the web app plus an hourly cron call.

## Layout

```
src/app/(app)/        Screens: matches, explore, pipeline, cv (new, versions, base, [id]), grow, grow/[slug], companies, settings
src/app/api/          Route handlers (session-checked by `api()` in src/server/http.ts)
src/components/       offers/ (cards, panel, letter dialog), cv/, pipeline/, grow/, companies/, settings/
src/lib/jobs/         Pure rules shared by server and browser: tracks, match, tailor, types, sectors
src/lib/cv/base.ts    The CV studio's rules: base and CV formats, rule checks (sources, statuses, numbers)
src/lib/grow/paths.ts The career-path library behind Grow (content and checked links)
src/server/careers/   sources (feed readers), detect (job boards on company sites), sync, service, digest
src/server/ai/        client (structured Claude calls), score, letters, advisor
src/server/cv/        CV studio: prompts (the Kreator's rules), service (base, versions, steps), docx
src/server/jobs/      tick (the scheduler), lease, budget (spend caps)
src/server/net/       PoliteFetcher (robots.txt, per-host delays) and httpFetch
research/companies.json  Suggested companies, loaded with `pnpm companies:import`
```

## Data

- `companies`: watched companies, group (`sector`), favourite / excluded.
- `job_sources`: one row per feed or company job board, with its last read and next due time.
- `job_offers`: every kept offer: rule match (`match`, `rule_score`, `track`, `field`, `pivot`,
  `figma_share`), Claude's reading (`ai`), the shown `score` (Claude's when present), status and dates,
  note, cover letter, `digested_at`.
- `cv_base` (one row, the experience base as JSON) and `cv_versions` (one CV per posting: the posting,
  the analysis, the CV with fact ids, notes and checks, and its stage: new, analyzed, drafted, done, failed).
  A CV is written in three requests (analyze, draft, verify), so none comes near the function time limit.
- `saved_views`, `advisor_messages`, `settings` (JSON per key), `provider_usage` (spend ledger),
  `leases`, `host_state` (robots cache), `fetch_log`, `app_events`, `sessions`, `login_attempts`.

## The daily cycle

1. **Tick** (`src/server/jobs/tick.ts`), hourly from Vercel Cron, each duty behind its own lease:
   - after the daily refresh time, once a day: mark every feed due;
   - sync: read due sources, look for job boards on company sites, close offers that disappeared;
   - scoring: Claude reads offers that passed the rules, in small batches, inside the caps;
   - housekeeping once a day: delete old closed offers and logs.
2. **Rules** (`src/lib/jobs/match.ts`): place first (Warsaw, elsewhere in Poland, remote open to Poland;
   everything else is dropped), then the title's track (`tracks.ts`), CV and topic words, languages,
   seniority. Junior roles count against design tracks but only warn for new fields.
3. **Claude** (`src/server/ai/score.ts`): a structured answer with score, summary, why, gaps, angle,
   track, pivot and Figma share. The CV and ad are passed as data, never as instructions.
4. **Digest** (`src/server/careers/digest.ts`): fresh, unseen offers at or above the digest score, split
   into Matches and Explore, with health warnings.

## Safety

- Every page and API needs the session cookie, except login, health, the cron endpoint (Bearer
  `CRON_SECRET`) and the digest (Bearer `DIGEST_TOKEN`).
- The crawler obeys robots.txt, waits between requests to the same host, and names itself with a
  contact URL.
- Claude calls reserve budget first and are refused past the daily or monthly cap.
- The CV is stored as text only, in the private database.
