/** What the sidebar and Settings show at a glance: counts, scheduler health, Claude and spend. */
import { and, asc, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { nextScheduledInstant } from "@/lib/time";
import { aiConfigured } from "./ai/client.ts";
import { jobsState } from "./careers/sync.ts";
import { hasConfirmedBase } from "./cv/service.ts";
import { db } from "./db/client.ts";
import { jobOffers, jobSources } from "./db/schema.ts";
import { integrations } from "./env.ts";
import { spendSummary } from "./jobs/budget.ts";
import { tickState } from "./jobs/tick.ts";
import { getSettings } from "./settings.ts";

export async function appStatus() {
  const [career, sched] = await Promise.all([getSettings("career"), getSettings("scheduler")]);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [c] = await db()
    .select({
      newMatches: sql<number>`count(*) filter (where ${jobOffers.track} in ('core','beyond') and ${jobOffers.score} >= ${career.showFrom})::int`,
      newExplore: sql<number>`count(*) filter (where ${jobOffers.track} in ('adjacent','new_field') and ${jobOffers.score} >= ${career.exploreShowFrom})::int`,
    })
    .from(jobOffers)
    .where(
      and(isNull(jobOffers.closedAt), inArray(jobOffers.status, ["new"]), gte(jobOffers.firstSeenAt, dayAgo)),
    );
  const [f] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(jobOffers)
    .where(and(inArray(jobOffers.status, ["applied", "interview"]), lte(jobOffers.followUpAt, new Date())));
  const tick = await tickState();
  const jobs = await jobsState();
  const tickAge = tick.lastTickAt ? Date.now() - Date.parse(tick.lastTickAt) : Number.POSITIVE_INFINITY;
  return {
    counts: { matches: c?.newMatches ?? 0, explore: c?.newExplore ?? 0, followUps: f?.n ?? 0 },
    hasCv: Boolean(career.cvText) || (await hasConfirmedBase()),
    scheduler: {
      enabled: sched.enabled,
      localTime: sched.localTime,
      nextRefreshAt: nextScheduledInstant(new Date(), sched.localTime, sched.timezone).toISOString(),
      lastTickAt: tick.lastTickAt,
      // Ticks are hourly; two missed ticks mean the cron is not reaching the app.
      tickHealthy: tickAge < 2.5 * 3_600_000,
      lastErrors: tick.last?.errors ?? [],
      lastSyncAt: jobs.lastSyncAt,
    },
    ai: { configured: aiConfigured(), spend: await spendSummary() },
    integrations: integrations(),
  };
}
export type AppStatus = Awaited<ReturnType<typeof appStatus>>;

/** Job boards and feeds (not company boards) with their last read, for Settings → Health. */
export async function feedSources() {
  const rows = await db()
    .select({
      id: jobSources.id,
      kind: jobSources.kind,
      name: jobSources.name,
      url: jobSources.url,
      enabled: jobSources.enabled,
      lastFetchedAt: jobSources.lastFetchedAt,
      lastStatus: jobSources.lastStatus,
      lastError: jobSources.lastError,
      jobsTotal: jobSources.jobsTotal,
      jobsKept: jobSources.jobsKept,
    })
    .from(jobSources)
    .where(and(isNull(jobSources.companyId), ne(jobSources.kind, "manual")))
    .orderBy(asc(jobSources.name));
  return rows.map((r) => ({ ...r, lastFetchedAt: r.lastFetchedAt?.toISOString() ?? null }));
}
export type FeedSource = Awaited<ReturnType<typeof feedSources>>[number];
