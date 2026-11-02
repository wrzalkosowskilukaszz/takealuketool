/**
 * Spending controls for paid provider calls: reserve before calling, then commit or release.
 * Limits: daily and monthly USD (Europe/Warsaw calendar).
 * Reservation happens under a transaction-scoped advisory lock, so concurrent workers can't overspend.
 */
import { and, eq, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "../db/client.ts";
import { providerUsage } from "../db/schema.ts";
import { getSettings } from "../settings.ts";

export class BudgetExceededError extends Error {
  constructor(
    public scope: "daily" | "monthly",
    message: string,
  ) {
    super(message);
  }
}

/** For "anthropic" a credit is 1,000 tokens, priced from the usdPerMillionTokens setting. */
function usdPerCredit(provider: string, s: { usdPerMillionTokens: number }): number {
  return provider === "anthropic" ? s.usdPerMillionTokens / 1000 : 0;
}

/** Records AI usage that was not reserved in advance. Every call counts against the same limits. */
export async function recordUsage(opts: {
  provider: string;
  operation: string;
  credits: number;
  detail?: string;
}) {
  const s = await getSettings("ai");
  await db()
    .insert(providerUsage)
    .values({
      provider: opts.provider,
      operation: opts.operation,
      credits: opts.credits,
      costMicros: Math.round(opts.credits * usdPerCredit(opts.provider, s) * 1e6),
      status: "committed",
      detail: opts.detail ?? null,
    });
}

/** ISO strings: raw SQL fragments need string parameters (the driver doesn't serialise Date there). */
function periodStarts(zone = "Europe/Warsaw") {
  const now = DateTime.now().setZone(zone);
  return { day: now.startOf("day").toUTC().toISO()!, month: now.startOf("month").toUTC().toISO()! };
}

export async function spendSummary() {
  const { day, month } = periodStarts();
  const rows = await db()
    .select({
      provider: providerUsage.provider,
      dayMicros: sql<number>`coalesce(sum(${providerUsage.costMicros}) filter (where ${providerUsage.createdAt} >= ${day}::timestamptz), 0)::bigint`,
      monthMicros: sql<number>`coalesce(sum(${providerUsage.costMicros}), 0)::bigint`,
      monthCredits: sql<number>`coalesce(sum(${providerUsage.credits}), 0)::float8`,
    })
    .from(providerUsage)
    .where(
      and(
        sql`${providerUsage.createdAt} >= ${month}::timestamptz`,
        sql`${providerUsage.status} in ('reserved','committed')`,
      ),
    )
    .groupBy(providerUsage.provider);
  const total = rows.reduce(
    (a, r) => ({ day: a.day + Number(r.dayMicros), month: a.month + Number(r.monthMicros) }),
    { day: 0, month: 0 },
  );
  return {
    dayUsd: total.day / 1e6,
    monthUsd: total.month / 1e6,
    byProvider: Object.fromEntries(
      rows.map((r) => [
        r.provider,
        {
          monthCredits: Number(r.monthCredits),
          monthUsd: Number(r.monthMicros) / 1e6,
          dayUsd: Number(r.dayMicros) / 1e6,
        },
      ]),
    ),
  };
}

export async function reserve(opts: {
  provider: string;
  operation: string;
  credits: number;
  detail?: string;
}): Promise<string> {
  const settings = await getSettings("ai");
  const costMicros = Math.round(opts.credits * usdPerCredit(opts.provider, settings) * 1e6);
  const { day, month } = periodStarts();
  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tals-budget'))`);
    const [agg] = await tx
      .select({
        day: sql<number>`coalesce(sum(${providerUsage.costMicros}) filter (where ${providerUsage.createdAt} >= ${day}::timestamptz), 0)::bigint`,
        month: sql<number>`coalesce(sum(${providerUsage.costMicros}), 0)::bigint`,
      })
      .from(providerUsage)
      .where(
        and(
          sql`${providerUsage.createdAt} >= ${month}::timestamptz`,
          sql`${providerUsage.status} in ('reserved','committed')`,
        ),
      );
    const dayMicros = Number(agg?.day ?? 0);
    const monthMicros = Number(agg?.month ?? 0);
    if (dayMicros + costMicros > settings.dailySpendLimitUsd * 1e6) {
      throw new BudgetExceededError(
        "daily",
        `Daily AI spending limit ($${settings.dailySpendLimitUsd}) reached`,
      );
    }
    if (monthMicros + costMicros > settings.monthlySpendLimitUsd * 1e6) {
      throw new BudgetExceededError(
        "monthly",
        `Monthly AI spending limit ($${settings.monthlySpendLimitUsd}) reached`,
      );
    }
    const [row] = await tx
      .insert(providerUsage)
      .values({
        provider: opts.provider,
        operation: opts.operation,
        credits: opts.credits,
        costMicros,
        status: "reserved",
        detail: opts.detail ?? null,
      })
      .returning({ id: providerUsage.id });
    return row!.id;
  });
}

/** Record the actual units used (may be 0 when a provider didn't charge). */
export async function commit(id: string, actualCredits: number, provider: string): Promise<void> {
  const rate = usdPerCredit(provider, await getSettings("ai"));
  await db()
    .update(providerUsage)
    .set({
      status: "committed",
      credits: actualCredits,
      costMicros: Math.round(actualCredits * rate * 1e6),
    })
    .where(eq(providerUsage.id, id));
}

export async function release(id: string): Promise<void> {
  await db()
    .update(providerUsage)
    .set({ status: "released", credits: 0, costMicros: 0 })
    .where(eq(providerUsage.id, id));
}

/** Wrap a paid call: reserve → call → commit actual (or release on failure). */
export async function withBudget<T>(
  opts: {
    provider: string;
    operation: string;
    credits: number;
    detail?: string;
  },
  fn: () => Promise<{ value: T; credits: number }>,
): Promise<T> {
  if (opts.credits <= 0) return (await fn()).value;
  const id = await reserve(opts);
  try {
    const r = await fn();
    await commit(id, r.credits, opts.provider);
    return r.value;
  } catch (e) {
    await release(id);
    throw e;
  }
}
