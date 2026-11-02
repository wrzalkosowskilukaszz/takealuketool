import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildDigest } from "../src/server/careers/digest.ts";
import { addManualJob, listJobs, listPipeline, setJobStatus } from "../src/server/careers/service.ts";
import { closeDb, db } from "../src/server/db/client.ts";
import { jobOffers, jobSources, providerUsage } from "../src/server/db/schema.ts";
import {
  BudgetExceededError,
  recordUsage,
  reserve,
  spendSummary,
  withBudget,
} from "../src/server/jobs/budget.ts";
import { acquireLease, releaseLease } from "../src/server/jobs/lease.ts";
import { patchSettings } from "../src/server/settings.ts";
import { hasDb, resetDb } from "./db.ts";

async function offer(over: Partial<typeof jobOffers.$inferInsert> = {}) {
  const [src] = await db()
    .insert(jobSources)
    .values({ kind: "remotive", token: "remotive", name: "Remotive" })
    .onConflictDoUpdate({ target: [jobSources.kind, jobSources.token], set: { name: "Remotive" } })
    .returning({ id: jobSources.id });
  const [row] = await db()
    .insert(jobOffers)
    .values({
      sourceId: src!.id,
      externalId: crypto.randomUUID(),
      companyName: "Acme",
      title: "Senior Art Director",
      location: "Warsaw",
      description: "Art direction.",
      url: "https://example.com/job",
      score: 80,
      ruleScore: 80,
      track: "core",
      match: {
        reasons: [{ text: "Warsaw", tone: "good" }],
        region: "warsaw",
        requiredLanguages: [],
        hits: [],
      },
      ...over,
    })
    .returning();
  return row!;
}

describe.skipIf(!hasDb)("Take a Luke Studio engine", () => {
  beforeEach(async () => {
    await resetDb();
    await patchSettings("ai", { dailySpendLimitUsd: 1, monthlySpendLimitUsd: 5, usdPerMillionTokens: 25 });
  });
  afterAll(closeDb);

  it("leases are exclusive until released or expired", async () => {
    expect(await acquireLease("x", "a", 60_000)).toBe(true);
    expect(await acquireLease("x", "b", 60_000)).toBe(false);
    await releaseLease("x", "a");
    expect(await acquireLease("x", "b", 60_000)).toBe(true);
    expect(await acquireLease("y", "a", -1)).toBe(true); // already expired
    expect(await acquireLease("y", "b", 60_000)).toBe(true);
  });

  it("the spend cap stops Claude calls, and failed calls release their reservation", async () => {
    // 16 k-tokens at $25 per million = $0.40: fits. 30 more ($0.75) would pass the $1 day.
    await reserve({ provider: "anthropic", operation: "score", credits: 16 });
    await expect(reserve({ provider: "anthropic", operation: "score", credits: 30 })).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
    await db().delete(providerUsage);
    await expect(
      withBudget({ provider: "anthropic", operation: "cover_letter", credits: 1 }, async () => {
        throw new Error("API down");
      }),
    ).rejects.toThrow("API down");
    const [u] = await db().select().from(providerUsage);
    expect(u!.status).toBe("released");
  });

  it("calls you start yourself count against the same cap", async () => {
    await recordUsage({ provider: "anthropic", operation: "advisor", credits: 40 }); // $1.00
    expect((await spendSummary()).dayUsd).toBeCloseTo(1, 5);
    await expect(reserve({ provider: "anthropic", operation: "score", credits: 1 })).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });

  it("Matches and Explore show their own tracks, and a status change moves offers to the pipeline", async () => {
    const a = await offer();
    await offer({
      title: "Real Estate Agent",
      track: "new_field",
      field: "real_estate",
      pivot: "big",
      score: 60,
    });
    const matches = await listJobs({ screen: "matches", view: "best", filters: {} });
    const explore = await listJobs({ screen: "explore", view: "best", filters: {} });
    expect(matches.rows.map((r) => r.title)).toEqual(["Senior Art Director"]);
    expect(explore.rows.map((r) => r.title)).toEqual(["Real Estate Agent"]);
    expect(
      (await listJobs({ screen: "explore", view: "all", filters: { pivots: ["small"] } })).rows,
    ).toHaveLength(0);

    await setJobStatus(a.id, { status: "applied" });
    const [after] = await db().select().from(jobOffers).where(eq(jobOffers.id, a.id));
    expect(after!.appliedAt).not.toBeNull();
    expect(after!.followUpAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect((await listPipeline()).rows.map((r) => r.id)).toEqual([a.id]);
  });

  it("an offer you add yourself is scored and saved", async () => {
    const id = await addManualJob({
      url: "https://www.linkedin.com/jobs/view/1",
      title: "AI Creative Lead",
      companyName: "Studio X",
      location: "Warsaw, hybrid",
      description: "Lead generative AI work for campaigns.",
    });
    const [o] = await db().select().from(jobOffers).where(eq(jobOffers.id, id));
    expect(o!.status).toBe("saved");
    expect(o!.track).toBe("beyond");
  });

  it("the digest lists fresh strong offers once, by screen", async () => {
    await patchSettings("digest", { minScore: 70, maxMatches: 5, maxExplore: 3 });
    await offer({ score: 85 });
    await offer({ title: "Junior Graphic Designer", score: 40 });
    await offer({
      title: "B2B Sales Manager",
      track: "new_field",
      field: "sales",
      pivot: "pivot",
      score: 72,
    });
    const d = await buildDigest({ mark: true });
    expect(d.matches.map((m) => m.title)).toEqual(["Senior Art Director"]);
    expect(d.explore.map((m) => m.title)).toEqual(["B2B Sales Manager"]);
    expect(d.markdown).toContain("Best new matches");
    expect(d.healthy).toBe(false); // sources were never read in this test
    const again = await buildDigest({ mark: true });
    expect(again.matches).toHaveLength(0);
    expect(again.markdown).toContain("No new offers scored 70 or more");
  });
});
