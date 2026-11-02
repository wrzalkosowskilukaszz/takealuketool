/**
 * The morning digest: the best offers found since the last digest, for the project routine that posts
 * them to the Take a Luke Studio project thread. Read through GET /api/digest (Bearer DIGEST_TOKEN).
 * With `mark`, the offers are stamped so tomorrow's digest does not repeat them.
 */
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { FIGMA_LABEL, type FigmaShare, PIVOT_LABEL, type Pivot, TRACK_LABEL } from "@/lib/jobs/tracks";
import type { Track } from "@/lib/jobs/types";
import { db } from "../db/client.ts";
import { jobOffers } from "../db/schema.ts";
import { env } from "../env.ts";
import { tickState } from "../jobs/tick.ts";
import { getSettings } from "../settings.ts";
import { jobsState } from "./sync.ts";

export type DigestItem = {
  id: string;
  title: string;
  company: string;
  place: string;
  score: number;
  scoredBy: "claude" | "rules";
  why: string;
  track: string;
  pivot: string;
  figma: string;
  salary: string | null;
  link: string;
  apply: string;
};

export type Digest = {
  generatedAt: string;
  lastSyncAt: string | null;
  healthy: boolean;
  problems: string[];
  matches: DigestItem[];
  explore: DigestItem[];
  totals: { newSinceLast: number; openMatches: number };
  markdown: string;
};

export async function buildDigest(opts: { mark?: boolean } = {}): Promise<Digest> {
  const s = await getSettings("digest");
  const app = env().APP_URL.replace(/\/$/, "");
  const since = new Date(Date.now() - 4 * 86_400_000);
  const fresh = and(
    isNull(jobOffers.closedAt),
    isNull(jobOffers.digestedAt),
    eq(jobOffers.status, "new"),
    gte(jobOffers.firstSeenAt, since),
    gte(jobOffers.score, s.minScore),
  );
  const pick = async (tracks: Track[], limit: number) =>
    limit <= 0
      ? []
      : db()
          .select()
          .from(jobOffers)
          .where(and(fresh, inArray(jobOffers.track, tracks)))
          .orderBy(desc(jobOffers.score), desc(jobOffers.firstSeenAt))
          .limit(limit);
  const m = await pick(["core", "beyond"], s.maxMatches);
  const x = await pick(["adjacent", "new_field"], s.maxExplore);

  const item = (o: typeof jobOffers.$inferSelect, screen: "matches" | "explore"): DigestItem => ({
    id: o.id,
    title: o.title,
    company: o.companyName,
    place: o.location ?? o.match.region,
    score: o.score,
    scoredBy: o.ai ? "claude" : "rules",
    why:
      o.ai?.why[0] ??
      o.ai?.summary ??
      o.match.reasons
        .filter((r) => r.tone === "good")
        .map((r) => r.text)
        .slice(0, 2)
        .join("; "),
    track: TRACK_LABEL[o.track as Track] ?? o.track,
    pivot: PIVOT_LABEL[o.pivot as Pivot] ?? o.pivot,
    figma: FIGMA_LABEL[o.figmaShare as FigmaShare] ?? "",
    salary: o.salary,
    link: `${app}/${screen}?o=${o.id}`,
    apply: o.url,
  });
  const matches = m.map((o) => item(o, "matches"));
  const explore = x.map((o) => item(o, "explore"));

  const [{ n: newSinceLast } = { n: 0 }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(jobOffers)
    .where(and(isNull(jobOffers.digestedAt), gte(jobOffers.firstSeenAt, since), isNull(jobOffers.closedAt)));
  const [{ n: openMatches } = { n: 0 }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(jobOffers)
    .where(and(isNull(jobOffers.closedAt), gte(jobOffers.score, s.minScore), eq(jobOffers.status, "new")));

  const jobs = await jobsState();
  const tick = await tickState();
  const problems: string[] = [];
  const syncAge = jobs.lastSyncAt ? Date.now() - Date.parse(jobs.lastSyncAt) : Number.POSITIVE_INFINITY;
  if (syncAge > 26 * 3_600_000)
    problems.push(
      jobs.lastSyncAt
        ? `The last successful read of job sources was ${Math.round(syncAge / 3_600_000)} hours ago.`
        : "Job sources have not been read yet.",
    );
  for (const e of tick.last?.errors ?? []) problems.push(`Last run: ${e}`);
  const failing = (jobs.last?.sources ?? []).filter((x) => x.error);
  if (failing.length >= 3) problems.push(`${failing.length} sources failed on the last read.`);

  if (opts.mark && (matches.length || explore.length)) {
    await db()
      .update(jobOffers)
      .set({ digestedAt: new Date() })
      .where(
        inArray(
          jobOffers.id,
          [...matches, ...explore].map((i) => i.id),
        ),
      );
  }

  const line = (i: DigestItem, n: number) =>
    `${n}. **[${i.title}](${i.link})** · ${i.company} · ${i.place} · **${i.score}**${i.scoredBy === "rules" ? " (rules)" : ""}\n   ${i.why}${i.pivot !== PIVOT_LABEL.none ? ` · ${i.pivot}` : ""}${i.figma ? ` · ${i.figma}` : ""}${i.salary ? ` · ${i.salary}` : ""}`;
  const parts: string[] = [];
  if (problems.length) parts.push(`⚠️ ${problems.join(" ")}`);
  if (matches.length) parts.push(`**Best new matches**\n${matches.map((i, n) => line(i, n + 1)).join("\n")}`);
  if (explore.length)
    parts.push(`**Explore: other fields**\n${explore.map((i, n) => line(i, n + 1)).join("\n")}`);
  if (!matches.length && !explore.length)
    parts.push(`No new offers scored ${s.minScore} or more since the last digest.`);
  parts.push(
    `${newSinceLast} new offers since the last digest, ${openMatches} open matches in total. [Open the dashboard](${app}/matches)`,
  );

  return {
    generatedAt: new Date().toISOString(),
    lastSyncAt: jobs.lastSyncAt,
    healthy: problems.length === 0,
    problems,
    matches,
    explore,
    totals: { newSinceLast, openMatches },
    markdown: parts.join("\n\n"),
  };
}
