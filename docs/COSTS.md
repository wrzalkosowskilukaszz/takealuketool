# Costs

| Item | Expected cost | Notes |
|---|---|---|
| Vercel Hobby | $0 | Personal, non-commercial use. |
| Neon Free | $0 | 0.5 GB is plenty; the hourly tick wakes the database briefly. |
| Job boards | $0 | Public feeds; Adzuna and Jooble keys are free. |
| Claude | about $5–20 a month | Depends on volume. Capped in the app. |

## Claude, in detail

- **Scoring** uses the fast model (`AI_MODEL_FAST`, default claude-haiku-5-5), only for offers whose rule
  score passes the threshold (default 40), at most 150 a day (Settings → Claude).
- **Cover letters and the advisor** use `AI_MODEL` (default claude-opus-5-5) and only run when you press
  a button.
- **Caps**: default $2 a day and $25 a month. Every call, automatic or yours, counts. When a cap is
  reached, scoring pauses until the next day or month and the buttons say why; nothing is charged past
  it.
- The cost estimate uses a blended price per million tokens (Settings → Claude, default $6). Check
  current prices at https://www.anthropic.com/pricing and adjust. Also set a monthly limit in the
  Anthropic Console as a second safety net.
