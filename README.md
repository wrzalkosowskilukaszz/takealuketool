# Take a Luke Studio

Łukasz's private job-search studio. Every morning it collects new offers from public job boards and
company career pages, keeps the ones in Warsaw, Poland or remote-open-to-Poland, scores each one against
his CV, and posts the best new matches to the project thread. Built from a one-time copy of Mind the Gap's
codebase and design, with the contact database and outreach removed.

## Screens

| Screen | What it does |
|---|---|
| **Matches** | Creative, design and AI roles: *Core creative* (Creative Designer, Senior Graphic Designer, AI Designer, Art Director) and *Beyond Figma* (AI Creative Lead, Creative Technologist, AI product and prompt roles, creative strategy). Filters, saved views, Claude's fit notes, pivot and Figma-share flags. |
| **Explore** | Roles in other fields where the same skills count: real estate, sales, partnerships, brand and marketing, product, consulting, teaching. Each says how big a pivot it is. |
| **Pipeline** | Saved → Applied → Interview → Offer / Rejected, with follow-up reminders a week after applying. |
| **CV** | The CV studio from the "Kreator CV pod oferty": an experience base of single facts (confirmed, to confirm, interpretation), and CVs written for one posting from confirmed facts only. Claude analyzes the posting, writes the CV with a fact id on every line, then fact-checks each line; numbers must appear in the cited facts. Edit on the page, download Word or print to PDF. |
| **Grow** | Eight career paths beyond design (why they suit him, what the work is, pay, gaps, a 30/60/90-day plan, checked links) and a career advisor chat with Claude. |
| **Companies** | 334 suggested companies in six groups whose own career pages are watched. Favourite or exclude any. |
| **Settings** | CV, what to look for, Claude's spend caps, the morning digest, the daily refresh time, profile for letters, and source health. |

Each offer opens in a panel with Claude's reading of the fit (why, gaps, the angle to take), a cover
letter Claude drafts in English or Polish and you edit in place (Word download), and **Tailor CV**, which
opens the CV studio with the offer filled in.

Without an uploaded CV, fit scores, cover letters and the advisor read the confirmed facts of the experience
base instead.

## How it works

- **Sources**: Himalayas, Arbeitnow, Remotive, Remote OK, Jobicy, We Work Remotely and Working Nomads
  (free, no keys), Adzuna and Jooble for Poland (free keys), and the public job boards of companies in
  `research/companies.json` (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Personio,
  Teamtailor and others, found automatically). Polish portals without a public API (JustJoin.it, No Fluff
  Jobs, Pracuj.pl, Rocket Jobs) are not scraped; use **Add an offer** for those.
- **Rules first, Claude second**: a free rule engine (`src/lib/jobs/match.ts`, `tracks.ts`) decides the
  place, the track, the pivot level and a first score. Offers above a threshold are then read by Claude
  (Haiku, cheap) against the CV, at most 150 a day, inside daily and monthly USD caps.
- **Schedule**: Vercel Cron calls `/api/cron/tick` hourly. Once a day after 06:00 Warsaw time every board
  is marked due; each tick reads sources, scores, and cleans up, all lease-protected.
- **Digest**: `GET /api/digest` (Bearer `DIGEST_TOKEN`, `?mark=1`) returns the best new offers as Markdown.
  A project routine reads it at 08:30 and posts it to the thread.

## Run it locally

```bash
pnpm install
cp .env.example .env.local      # fill DATABASE_URL, SESSION_SECRET, CRON_SECRET, APP_PASSWORD_HASH
pnpm hash-password              # prints APP_PASSWORD_HASH
pnpm db:migrate
pnpm companies:import
pnpm dev                        # http://localhost:3000
pnpm worker tick --seconds 300  # one full tick from the terminal
```

Checks: `pnpm verify` (Biome, TypeScript, Vitest; integration tests run when `TEST_DATABASE_URL` is set),
`pnpm e2e` (Playwright, against a running app with `E2E_PASSWORD`), `pnpm links:check` (Grow links).

More: [docs/SETUP.md](docs/SETUP.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) ·
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/COSTS.md](docs/COSTS.md)
