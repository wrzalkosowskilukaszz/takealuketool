/** Reads and changes for the Matches, Explore and Pipeline screens. */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { adLanguage, extractCvKeywords } from "@/lib/jobs/match";
import { cvGap } from "@/lib/jobs/tailor";
import { EXPLORE_FIELDS, STATUSES, TRACKS } from "@/lib/jobs/types";
import { versionsForOffer } from "../cv/service.ts";
import { db } from "../db/client.ts";
import { companies, jobOffers, jobSources, savedViews } from "../db/schema.ts";
import { badRequest, notFound } from "../http.ts";
import { getSettings, saveSettings } from "../settings.ts";
import { cvDocx } from "./docx.ts";
import { careerPrefs, jobsState, matchColumns, rescoreAll } from "./sync.ts";

export const SCREENS = ["matches", "explore"] as const;
export type Screen = (typeof SCREENS)[number];
export const VIEWS = ["best", "new", "all"] as const;
export type View = (typeof VIEWS)[number];

export const Filters = z.object({
  q: z.string().max(200).optional(),
  tracks: z.array(z.enum(TRACKS)).optional(),
  fields: z.array(z.enum(EXPLORE_FIELDS)).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  places: z.array(z.enum(["warsaw", "poland", "remote"])).optional(),
  workplaces: z.array(z.enum(["remote", "hybrid", "onsite", "unknown"])).optional(),
  figma: z.array(z.enum(["hands_on", "mixed", "direction", "none"])).optional(),
  pivots: z.array(z.enum(["none", "small", "pivot", "big"])).optional(),
  sources: z.array(z.string().max(40)).optional(),
  postedWithinDays: z.number().int().min(1).max(60).optional(),
  salaryOnly: z.boolean().optional(),
  claudeOnly: z.boolean().optional(),
  favouritesOnly: z.boolean().optional(),
  statuses: z.array(z.enum(STATUSES)).optional(),
  sort: z.enum(["score", "newest"]).optional(),
});
export type Filters = z.infer<typeof Filters>;

const SCREEN_TRACKS: Record<Screen, string[]> = {
  matches: ["core", "beyond"],
  explore: ["adjacent", "new_field"],
};

function viewWhere(screen: Screen, view: View, showFrom: number): SQL | undefined {
  const open = isNull(jobOffers.closedAt);
  const onScreen = inArray(jobOffers.track, SCREEN_TRACKS[screen]);
  switch (view) {
    case "best":
      return and(open, onScreen, sql`${jobOffers.status} in ('new','saved')`, gte(jobOffers.score, showFrom));
    case "new":
      return and(
        open,
        onScreen,
        eq(jobOffers.status, "new"),
        gte(jobOffers.firstSeenAt, new Date(Date.now() - 3 * 86_400_000)),
        gte(jobOffers.score, Math.max(25, showFrom - 15)),
      );
    default:
      return and(open, onScreen, ne(jobOffers.status, "dismissed"));
  }
}

function filterWhere(f: Filters): SQL[] {
  const w: SQL[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    w.push(
      or(
        ilike(jobOffers.title, like),
        ilike(jobOffers.companyName, like),
        ilike(jobOffers.location, like),
      ) as SQL,
    );
  }
  if (f.tracks?.length) w.push(inArray(jobOffers.track, f.tracks));
  if (f.fields?.length) w.push(inArray(jobOffers.field, f.fields));
  if (f.minScore) w.push(gte(jobOffers.score, f.minScore));
  if (f.places?.length) {
    const regions = f.places.flatMap((p) =>
      p === "remote" ? ["remote_ok", "remote_unclear"] : p === "poland" ? ["poland"] : ["warsaw"],
    );
    w.push(
      sql`${jobOffers.match}->>'region' in (${sql.join(
        regions.map((r) => sql`${r}`),
        sql`, `,
      )})`,
    );
  }
  if (f.workplaces?.length) w.push(inArray(jobOffers.workplace, f.workplaces));
  if (f.figma?.length) w.push(inArray(jobOffers.figmaShare, f.figma));
  if (f.pivots?.length) w.push(inArray(jobOffers.pivot, f.pivots));
  if (f.sources?.length) {
    // "careers_page" stands for every job board found on a company's own site.
    const kinds = f.sources.filter((s) => s !== "careers_page");
    const parts: SQL[] = [];
    if (kinds.length)
      parts.push(
        sql`(${jobSources.companyId} is null and ${jobSources.kind}::text in (${sql.join(
          kinds.map((s) => sql`${s}`),
          sql`, `,
        )}))`,
      );
    if (f.sources.includes("careers_page")) parts.push(isNotNull(jobSources.companyId));
    w.push(or(...parts) as SQL);
  }
  if (f.postedWithinDays)
    w.push(
      sql`coalesce(${jobOffers.postedAt}, ${jobOffers.firstSeenAt}) >= ${new Date(Date.now() - f.postedWithinDays * 86_400_000).toISOString()}::timestamptz`,
    );
  if (f.salaryOnly) w.push(isNotNull(jobOffers.salary));
  if (f.claudeOnly) w.push(isNotNull(jobOffers.ai));
  if (f.favouritesOnly) w.push(eq(companies.favourite, true));
  if (f.statuses?.length) w.push(inArray(jobOffers.status, f.statuses));
  return w;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

const listColumns = {
  id: jobOffers.id,
  title: jobOffers.title,
  companyName: jobOffers.companyName,
  companyId: jobOffers.companyId,
  favourite: companies.favourite,
  location: jobOffers.location,
  workplace: jobOffers.workplace,
  employmentType: jobOffers.employmentType,
  salary: jobOffers.salary,
  postedAt: jobOffers.postedAt,
  firstSeenAt: jobOffers.firstSeenAt,
  closedAt: jobOffers.closedAt,
  score: jobOffers.score,
  ruleScore: jobOffers.ruleScore,
  track: jobOffers.track,
  field: jobOffers.field,
  pivot: jobOffers.pivot,
  figmaShare: jobOffers.figmaShare,
  match: jobOffers.match,
  ai: jobOffers.ai,
  status: jobOffers.status,
  statusAt: jobOffers.statusAt,
  appliedAt: jobOffers.appliedAt,
  followUpAt: jobOffers.followUpAt,
  hasLetter: sql<boolean>`${jobOffers.coverLetter} is not null`,
  url: jobOffers.url,
  source: jobSources.name,
  sourceKind: jobSources.kind,
};

type RawRow = {
  postedAt: Date | null;
  firstSeenAt: Date;
  closedAt: Date | null;
  statusAt: Date | null;
  appliedAt: Date | null;
  followUpAt: Date | null;
  favourite: boolean | null;
};
function serialize<T extends RawRow>(r: T) {
  return {
    ...r,
    favourite: r.favourite ?? false,
    postedAt: iso(r.postedAt),
    firstSeenAt: r.firstSeenAt.toISOString(),
    closedAt: iso(r.closedAt),
    statusAt: iso(r.statusAt),
    appliedAt: iso(r.appliedAt),
    followUpAt: iso(r.followUpAt),
  };
}

export async function listJobs(opts: { screen: Screen; view: View; filters: Filters; offset?: number }) {
  const prefs = await careerPrefs();
  const showFrom = opts.screen === "explore" ? prefs.exploreShowFrom : prefs.showFrom;
  const where = and(viewWhere(opts.screen, opts.view, showFrom), ...filterWhere(opts.filters));
  const order =
    opts.filters.sort === "newest" || (opts.view === "new" && opts.filters.sort !== "score")
      ? [desc(jobOffers.firstSeenAt), desc(jobOffers.score)]
      : [desc(jobOffers.score), sql`${jobOffers.postedAt} desc nulls last`];
  const rows = await db()
    .select(listColumns)
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .leftJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(where)
    .orderBy(...order)
    .limit(60)
    .offset(opts.offset ?? 0);

  const counts: Record<string, number> = {};
  for (const v of VIEWS) {
    const [c] = await db()
      .select({ n: count() })
      .from(jobOffers)
      .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
      .leftJoin(companies, eq(companies.id, jobOffers.companyId))
      .where(and(viewWhere(opts.screen, v, showFrom), ...filterWhere(opts.filters)));
    counts[v] = c?.n ?? 0;
  }
  const [stats] = await db()
    .select({
      saved: sql<number>`count(*) filter (where ${jobOffers.status} = 'saved')::int`,
      applied: sql<number>`count(*) filter (where ${jobOffers.status} in ('applied','interview','offer'))::int`,
      interviews: sql<number>`count(*) filter (where ${jobOffers.status} = 'interview')::int`,
      newToday: sql<number>`count(*) filter (where ${jobOffers.firstSeenAt} >= now() - interval '24 hours' and ${jobOffers.closedAt} is null and ${jobOffers.score} >= ${showFrom})::int`,
    })
    .from(jobOffers)
    .where(inArray(jobOffers.track, SCREEN_TRACKS[opts.screen]));
  return {
    rows: rows.map(serialize),
    counts,
    stats: stats ?? { saved: 0, applied: 0, interviews: 0, newToday: 0 },
    showFrom,
    sync: await syncSummary(),
    sources: await db()
      .selectDistinct({ kind: jobSources.kind, name: jobSources.name })
      .from(jobSources)
      .where(isNull(jobSources.companyId))
      .orderBy(asc(jobSources.name)),
  };
}

export type JobList = Awaited<ReturnType<typeof listJobs>>;
export type JobRow = JobList["rows"][number];

/** Everything from Saved onwards, for the Pipeline board. */
export async function listPipeline() {
  const rows = await db()
    .select(listColumns)
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .leftJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(inArray(jobOffers.status, ["saved", "applied", "interview", "offer", "rejected"]))
    .orderBy(desc(jobOffers.statusAt))
    .limit(500);
  return { rows: rows.map(serialize) };
}
export type Pipeline = Awaited<ReturnType<typeof listPipeline>>;

export async function syncSummary() {
  const state = await jobsState();
  const [boards] = await db()
    .select({
      boards: sql<number>`count(*) filter (where ${jobSources.companyId} is not null and ${jobSources.supported} and ${jobSources.enabled})::int`,
      feeds: sql<number>`count(*) filter (where ${jobSources.companyId} is null and ${jobSources.kind} <> 'manual')::int`,
      failing: sql<number>`count(*) filter (where ${jobSources.lastStatus} = 'error')::int`,
    })
    .from(jobSources);
  const [checked] = await db()
    .select({
      checked: sql<number>`count(*) filter (where ${companies.careersCheckedAt} is not null)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(companies)
    .where(eq(companies.excluded, false));
  const [offers] = await db()
    .select({ open: sql<number>`count(*) filter (where ${jobOffers.closedAt} is null)::int` })
    .from(jobOffers);
  return {
    lastSyncAt: state.lastSyncAt,
    boards: boards?.boards ?? 0,
    feeds: boards?.feeds ?? 0,
    failing: boards?.failing ?? 0,
    companiesChecked: checked?.checked ?? 0,
    companiesTotal: checked?.total ?? 0,
    openOffers: offers?.open ?? 0,
  };
}

export async function jobDetail(id: string) {
  const [r] = await db()
    .select({
      o: jobOffers,
      source: jobSources.name,
      sourceKind: jobSources.kind,
      sourceUrl: jobSources.url,
      co: companies,
    })
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .leftJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(eq(jobOffers.id, id))
    .limit(1);
  if (!r) throw notFound("Offer not found");
  const career = await getSettings("career");
  return {
    ...r.o,
    postedAt: iso(r.o.postedAt),
    firstSeenAt: r.o.firstSeenAt.toISOString(),
    lastSeenAt: r.o.lastSeenAt.toISOString(),
    closedAt: iso(r.o.closedAt),
    statusAt: iso(r.o.statusAt),
    appliedAt: iso(r.o.appliedAt),
    followUpAt: iso(r.o.followUpAt),
    aiScoredAt: iso(r.o.aiScoredAt),
    coverLetterAt: iso(r.o.coverLetterAt),
    digestedAt: iso(r.o.digestedAt),
    createdAt: r.o.createdAt.toISOString(),
    updatedAt: r.o.updatedAt.toISOString(),
    source: r.source,
    sourceKind: r.sourceKind,
    sourceUrl: r.sourceUrl,
    gap: career.cvText ? cvGap(r.o, career.cvText) : null,
    cvVersions: await versionsForOffer(id),
    adLanguage: adLanguage(r.o.description),
    company: r.co
      ? {
          id: r.co.id,
          name: r.co.brand ?? r.co.name,
          website: r.co.website,
          careersUrl: r.co.careersUrl,
          sector: r.co.sector,
          favourite: r.co.favourite,
        }
      : null,
  };
}

export type JobDetail = Awaited<ReturnType<typeof jobDetail>>;

export const StatusPatch = z.object({
  status: z.enum(STATUSES).optional(),
  note: z.string().max(8000).nullable().optional(),
  followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function setJobStatus(id: string, patch: z.infer<typeof StatusPatch>) {
  const now = new Date();
  const set: Partial<typeof jobOffers.$inferInsert> = { updatedAt: now };
  if (patch.status) {
    set.status = patch.status;
    set.statusAt = now;
    if (patch.status === "applied") {
      const [cur] = await db()
        .select({ appliedAt: jobOffers.appliedAt })
        .from(jobOffers)
        .where(eq(jobOffers.id, id))
        .limit(1);
      if (!cur?.appliedAt) set.appliedAt = now;
      // A gentle default: check back a week after applying.
      if (patch.followUpAt === undefined) set.followUpAt = new Date(now.getTime() + 7 * 86_400_000);
    }
    if (["rejected", "dismissed", "offer"].includes(patch.status)) set.followUpAt = null;
  }
  if (patch.note !== undefined) set.note = patch.note;
  if (patch.followUpAt !== undefined) set.followUpAt = patch.followUpAt ? new Date(patch.followUpAt) : null;
  const [u] = await db()
    .update(jobOffers)
    .set(set)
    .where(eq(jobOffers.id, id))
    .returning({ id: jobOffers.id });
  if (!u) throw notFound("Offer not found");
}

// ------------------------------------------------------------------------------------------------
// CV and preferences
// ------------------------------------------------------------------------------------------------

export async function saveCv(filename: string, text: string) {
  const clean = text.replace(/\s+\n/g, "\n").trim().slice(0, 60_000);
  if (clean.split(/\s+/).length < 30)
    throw badRequest(
      "Could not read text from the file. Upload the CV as a PDF or DOCX with text (not a scan).",
    );
  const career = await getSettings("career");
  await saveSettings("career", {
    ...career,
    cvText: clean,
    cvFilename: filename.slice(0, 200),
    cvUploadedAt: new Date().toISOString(),
    cvKeywords: extractCvKeywords(clean),
  });
  // Claude's earlier reading used the old CV: read the open offers again.
  await db()
    .update(jobOffers)
    .set({ ai: null, aiScoredAt: null, aiError: null })
    .where(isNull(jobOffers.closedAt));
  await rescoreAll();
}

export async function removeCv() {
  const career = await getSettings("career");
  await saveSettings("career", {
    ...career,
    cvText: "",
    cvFilename: null,
    cvUploadedAt: null,
    cvKeywords: [],
  });
  await rescoreAll();
}

export const PREF_KEYS = [
  "tracks",
  "exploreFields",
  "locations",
  "languages",
  "workTypes",
  "extraKeywords",
  "excludeKeywords",
  "showFrom",
  "exploreShowFrom",
  "cvKeywords",
] as const;

export async function savePrefs(patch: Record<string, unknown>) {
  const career = await getSettings("career");
  const next = { ...career };
  for (const k of PREF_KEYS) if (k in patch) (next as Record<string, unknown>)[k] = patch[k];
  await saveSettings("career", next);
  await rescoreAll();
}

export async function careerProfile() {
  const c = await getSettings("career");
  return {
    prefs: Object.fromEntries(PREF_KEYS.map((k) => [k, c[k]])) as Pick<typeof c, (typeof PREF_KEYS)[number]>,
    cv: {
      filename: c.cvFilename,
      uploadedAt: c.cvUploadedAt,
      words: c.cvText ? c.cvText.split(/\s+/).length : 0,
    },
  };
}
export type CareerProfile = Awaited<ReturnType<typeof careerProfile>>;

// ------------------------------------------------------------------------------------------------
// Offers you add yourself (LinkedIn, Pracuj.pl, a friend's tip)
// ------------------------------------------------------------------------------------------------

export async function addManualJob(input: {
  url: string;
  title: string;
  companyName: string;
  location?: string | null;
  description?: string | null;
}) {
  const [src] = await db()
    .insert(jobSources)
    .values({ kind: "manual", token: "manual", name: "Added by you", supported: false, enabled: false })
    .onConflictDoUpdate({ target: [jobSources.kind, jobSources.token], set: { updatedAt: new Date() } })
    .returning({ id: jobSources.id });
  const { scoreJob } = await import("@/lib/jobs/match");
  const prefs = await careerPrefs();
  const norm = input.companyName.trim().toLowerCase();
  const [co] = await db()
    .select()
    .from(companies)
    .where(or(sql`lower(${companies.name}) = ${norm}`, sql`lower(${companies.brand}) = ${norm}`))
    .limit(1);
  const m = scoreJob(
    {
      title: input.title,
      description: input.description ?? "",
      location: input.location ?? null,
      companyName: input.companyName,
      companySector: co?.sector ?? null,
      favourite: co?.favourite ?? false,
    },
    // Your own find is kept even if the place or title rules would drop it.
    {
      ...prefs,
      tracks: [...TRACKS],
      exploreFields: [...EXPLORE_FIELDS],
      locations: ["warsaw", "poland_other", "remote_poland"],
    },
  );
  const [row] = await db()
    .insert(jobOffers)
    .values({
      sourceId: src!.id,
      externalId: input.url.slice(0, 300),
      companyId: co?.id ?? null,
      companyName: co ? (co.brand ?? co.name) : input.companyName.trim(),
      title: input.title.trim(),
      location: input.location?.trim() || null,
      description: (input.description ?? "").slice(0, 20_000),
      url: input.url,
      score: m.score,
      ...matchColumns(m),
      status: "saved",
      statusAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [jobOffers.sourceId, jobOffers.externalId],
      set: {
        title: input.title.trim(),
        description: (input.description ?? "").slice(0, 20_000),
        updatedAt: new Date(),
      },
    })
    .returning({ id: jobOffers.id });
  return row!.id;
}

// ------------------------------------------------------------------------------------------------
// Cover letter as Word
// ------------------------------------------------------------------------------------------------

export async function coverLetterDocx(id: string): Promise<{ file: Uint8Array; filename: string }> {
  const [o] = await db()
    .select({
      title: jobOffers.title,
      companyName: jobOffers.companyName,
      coverLetter: jobOffers.coverLetter,
    })
    .from(jobOffers)
    .where(eq(jobOffers.id, id))
    .limit(1);
  if (!o?.coverLetter?.trim()) throw notFound("Draft a cover letter for this offer first.");
  const name = `Cover letter - ${o.companyName} - ${o.title}`
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  return { file: await cvDocx(o.coverLetter, name), filename: `${name}.docx` };
}

// ------------------------------------------------------------------------------------------------
// Companies
// ------------------------------------------------------------------------------------------------

export async function listCompanies(q?: string) {
  const like = q?.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  const rows = await db()
    .select({
      id: companies.id,
      name: companies.name,
      brand: companies.brand,
      domain: companies.domain,
      website: companies.website,
      sector: companies.sector,
      note: companies.note,
      favourite: companies.favourite,
      excluded: companies.excluded,
      careersUrl: companies.careersUrl,
      careersCheckedAt: companies.careersCheckedAt,
      boards: sql<number>`(select count(*)::int from job_sources s where s.company_id = ${companies.id} and s.supported and s.enabled)`,
      open: sql<number>`(select count(*)::int from job_offers o where o.company_id = ${companies.id} and o.closed_at is null)`,
    })
    .from(companies)
    .where(like ? or(ilike(companies.name, like), ilike(companies.domain, like)) : undefined)
    .orderBy(desc(companies.favourite), asc(companies.name))
    .limit(600);
  return rows.map((r) => ({ ...r, careersCheckedAt: iso(r.careersCheckedAt) }));
}
export type CompanyRow = Awaited<ReturnType<typeof listCompanies>>[number];

export async function addCompany(input: { name: string; website: string; sector?: string; note?: string }) {
  let host: string;
  try {
    host = new URL(input.website.startsWith("http") ? input.website : `https://${input.website}`).host;
  } catch {
    throw badRequest("That website address does not look right.");
  }
  const domain = host.replace(/^www\./, "").toLowerCase();
  const [row] = await db()
    .insert(companies)
    .values({
      name: input.name.trim(),
      website: `https://${host}`,
      domain,
      sector: input.sector ?? "other",
      note: input.note ?? null,
    })
    .onConflictDoUpdate({ target: companies.domain, set: { excluded: false, updatedAt: new Date() } })
    .returning({ id: companies.id });
  return row!.id;
}

export async function updateCompany(id: string, patch: { favourite?: boolean; excluded?: boolean }) {
  const [u] = await db()
    .update(companies)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning({ id: companies.id });
  if (!u) throw notFound("Company not found");
  if (patch.excluded !== undefined)
    await db().update(jobSources).set({ enabled: !patch.excluded }).where(eq(jobSources.companyId, id));
  await rescoreAll({ companyId: id });
}

// ------------------------------------------------------------------------------------------------
// Saved views
// ------------------------------------------------------------------------------------------------

export async function listViews(screen: Screen) {
  return db()
    .select({ id: savedViews.id, name: savedViews.name, filters: savedViews.filters })
    .from(savedViews)
    .where(eq(savedViews.screen, screen))
    .orderBy(asc(savedViews.createdAt));
}

export async function saveView(screen: Screen, name: string, filters: Filters) {
  const [row] = await db()
    .insert(savedViews)
    .values({ screen, name: name.trim().slice(0, 60), filters })
    .returning({ id: savedViews.id });
  return row!.id;
}

export async function deleteView(id: string) {
  await db().delete(savedViews).where(eq(savedViews.id, id));
}
