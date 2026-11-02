/**
 * One scheduler tick. Called hourly by Vercel Cron through `/api/cron/tick`, or by `pnpm worker tick`.
 * Each duty has its own lease, so overlapping ticks never run the same work twice. Everything is bounded
 * by the tick's time budget; unfinished work resumes on the next tick.
 *
 * 1. Daily refresh: once a day, at the scheduled local time (06:00 Warsaw by default) or the first tick
 *    after it, every source is marked due so the morning digest sees a fresh read.
 * 2. Offer sync: read due sources and find job boards on company sites (src/server/careers/sync.ts).
 * 3. Claude scoring of offers that pass the rules (src/server/ai/score.ts).
 * 4. Housekeeping once a day: old closed offers and crawl logs are deleted.
 */

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { localDate } from "@/lib/time";
import { type ScoreReport, scoreDueOffers } from "../ai/score.ts";
import { jobsWorkDue, type SyncReport, syncJobs } from "../careers/sync.ts";
import { db } from "../db/client.ts";
import { fetchLog, jobOffers, jobSources, settings } from "../db/schema.ts";
import { logEvent } from "../events.ts";
import { getSettings } from "../settings.ts";
import { acquireLease, releaseLease } from "./lease.ts";

export type TickReport = {
  at: string;
  holder: string;
  trigger: string;
  dailyRefresh: string | null;
  jobs: SyncReport | null;
  scoring: ScoreReport | null;
  housekeeping: { offers: number; logs: number } | null;
  busy: string[];
  errors: string[];
};

export async function recordTick(report: Partial<TickReport>) {
  const value = { lastTickAt: new Date().toISOString(), last: report };
  await db()
    .insert(settings)
    .values({ key: "tick_state", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function tickState(): Promise<{ lastTickAt: string | null; last: Partial<TickReport> | null }> {
  const [row] = await db().select().from(settings).where(eq(settings.key, "tick_state")).limit(1);
  const v = (row?.value ?? {}) as { lastTickAt?: string; last?: Partial<TickReport> };
  return { lastTickAt: v.lastTickAt ?? null, last: v.last ?? null };
}

/** True when the scheduled local time has passed today. */
export function dailyRefreshDue(now: Date, localTime: string, zone: string): boolean {
  const [h, m] = localTime.split(":").map(Number);
  const local = DateTime.fromJSDate(now).setZone(zone);
  return local >= local.set({ hour: h ?? 6, minute: m ?? 0, second: 0, millisecond: 0 });
}

export async function runTick(opts: {
  budgetMs: number;
  trigger: string;
  holder?: string;
  scoring?: boolean;
}): Promise<TickReport> {
  const holder = opts.holder ?? `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const start = Date.now();
  const deadline = start + opts.budgetMs;
  const report: TickReport = {
    at: new Date(start).toISOString(),
    holder,
    trigger: opts.trigger,
    dailyRefresh: null,
    jobs: null,
    scoring: null,
    housekeeping: null,
    busy: [],
    errors: [],
  };
  await recordTick(report);

  // 1. Daily refresh: once per local day, after the scheduled time.
  const sched = await getSettings("scheduler");
  const today = localDate(new Date(), sched.timezone);
  if (sched.enabled && dailyRefreshDue(new Date(), sched.localTime, sched.timezone)) {
    // The lease stays until it expires: it marks "done today".
    if (await acquireLease(`daily:${today}`, holder, 26 * 3_600_000)) {
      await db()
        .update(jobSources)
        .set({ nextFetchAt: new Date() })
        .where(
          and(
            eq(jobSources.enabled, true),
            eq(jobSources.supported, true),
            sql`${jobSources.kind} <> 'careers_page'`,
          ),
        );
      report.dailyRefresh = `started for ${today}`;
      await logEvent("info", "scheduler", `Daily refresh started for ${today}`, { trigger: opts.trigger });
    }
  }

  // 2. Offers: read due sources and look for job boards on company sites.
  if (Date.now() < deadline - 60_000 && (await jobsWorkDue())) {
    if (await acquireLease("jobs", holder, Math.min(opts.budgetMs, 10 * 60_000))) {
      try {
        // Leave time for scoring when Claude is configured.
        report.jobs = await syncJobs({ deadline: Math.max(Date.now() + 60_000, deadline - 90_000) });
      } catch (e) {
        report.errors.push(`jobs: ${errMsg(e)}`);
        await logEvent("error", "jobs", "Reading job offers failed", { message: errMsg(e) });
      } finally {
        await releaseLease("jobs", holder);
      }
    } else report.busy.push("jobs");
  }

  // 3. Claude reads the offers that passed the rules.
  if (opts.scoring !== false && Date.now() < deadline - 30_000) {
    if (await acquireLease("scoring", holder, Math.min(opts.budgetMs, 10 * 60_000))) {
      try {
        report.scoring = await scoreDueOffers({ deadline });
      } catch (e) {
        report.errors.push(`scoring: ${errMsg(e)}`);
        await logEvent("error", "ai", "Scoring offers with Claude failed", { message: errMsg(e) });
      } finally {
        await releaseLease("scoring", holder);
      }
    } else report.busy.push("scoring");
  }

  // 4. Housekeeping, once per local day.
  if (await acquireLease(`housekeeping:${today}`, holder, 26 * 3_600_000)) {
    try {
      const old = new Date(Date.now() - 90 * 86_400_000);
      const offers = await db()
        .delete(jobOffers)
        .where(
          and(
            isNotNull(jobOffers.closedAt),
            lt(jobOffers.closedAt, old),
            inArray(jobOffers.status, ["new", "dismissed"]),
          ),
        )
        .returning({ id: jobOffers.id });
      const logs = await db()
        .delete(fetchLog)
        .where(lt(fetchLog.fetchedAt, new Date(Date.now() - 30 * 86_400_000)))
        .returning({ id: fetchLog.id });
      report.housekeeping = { offers: offers.length, logs: logs.length };
    } catch (e) {
      report.errors.push(`housekeeping: ${errMsg(e)}`);
    }
  }

  await recordTick(report);
  return report;
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
