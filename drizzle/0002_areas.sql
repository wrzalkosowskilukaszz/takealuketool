-- Matches tabs (Poland / European Union / Rest of the world): store the tab on every open offer.
-- Mirrors areaOf() in src/lib/jobs/match.ts for offers scored before it existed.
UPDATE "job_offers" SET "match" = jsonb_set("match", '{area}', to_jsonb(
  CASE
    WHEN "match"->>'region' IN ('warsaw', 'poland') THEN 'pl'
    WHEN "match"->>'region' IN ('eu', 'europe') THEN 'eu'
    WHEN "match"->>'region' = 'remote_ok' AND coalesce("location", '') ~* '(warsaw|warszaw|poland|polska|polsce|krak[oó]w|wroc[lł]aw|pozna[nń]|gda[nń]sk|[lł][oó]d[zź]|katowice)' THEN 'pl'
    WHEN "match"->>'region' = 'remote_ok' AND coalesce("location", '') ~* '(emea|europe|european union|\meu\M|\mcet\M|\mcest\M)' THEN 'eu'
    ELSE 'world'
  END
));--> statement-breakpoint
-- Look for on-site and hybrid jobs in the EU and outside it too.
UPDATE "settings" SET "value" = jsonb_set("value", '{locations}', ("value"->'locations') || '["eu", "world"]'::jsonb)
WHERE "key" = 'career' AND jsonb_typeof("value"->'locations') = 'array'
  AND NOT ("value"->'locations') ? 'eu';--> statement-breakpoint
-- Read every source again soon, so the newly allowed places are picked up.
UPDATE "job_sources" SET "next_fetch_at" = now() WHERE "kind" <> 'manual';
