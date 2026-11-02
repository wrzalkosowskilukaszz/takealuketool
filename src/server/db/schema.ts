/**
 * Database schema (Drizzle, PostgreSQL) for Take a Luke Studio.
 *
 * - `companies`: the researched list of employers whose career pages are read (research/companies.json).
 * - `job_sources` / `job_offers`: where offers come from and every offer kept, with its rule score, the
 *   optional AI assessment against the CV, its track (core, beyond Figma, adjacent, new field) and the
 *   owner's pipeline status, notes and cover letter.
 * - `advisor_messages`: the Grow tab's advisor chat.
 * - `cv_base` / `cv_versions`: the CV studio's experience base (facts with a status) and the CVs written
 *   from it for single offers.
 * - Engine tables: leases (one worker per duty), provider_usage (AI spend ledger), host_state and fetch_log
 *   (polite crawling), app_events (log), settings, sessions, login_attempts.
 */
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Companies whose career pages are read
// ---------------------------------------------------------------------------

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    brand: text("brand"),
    website: text("website"),
    domain: text("domain").notNull(),
    /** Research group: ai_creative, product_warsaw, agency, in_house, real_estate, sales_saas, other. */
    sector: text("sector").notNull().default("other"),
    /** Why the company is on the list, and the page that shows it. */
    note: text("note"),
    sourceUrl: text("source_url"),
    /** A company you would like to work for: its offers get a bonus and are always shown. */
    favourite: boolean("favourite").notNull().default(false),
    excluded: boolean("excluded").notNull().default(false),
    careersUrl: text("careers_url"),
    careersCheckedAt: ts("careers_checked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("companies_domain_uq").on(t.domain), index("companies_sector_idx").on(t.sector)],
);

// ---------------------------------------------------------------------------
// Job sources and offers
// ---------------------------------------------------------------------------

export const jobSourceKindEnum = pgEnum("job_source_kind", [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "recruitee",
  "personio",
  "teamtailor",
  "eightfold",
  "workday",
  "successfactors",
  "careers_page",
  "arbeitnow",
  "himalayas",
  "adzuna",
  "jooble",
  "remotive",
  "remoteok",
  "jobicy",
  "weworkremotely",
  "workingnomads",
  "manual",
]);

export const JOB_STATUSES = [
  "new",
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
  "dismissed",
] as const;
export const jobOfferStatusEnum = pgEnum("job_offer_status", JOB_STATUSES);

/** Where offers come from: a company's public job board (found on its careers page) or a job feed. */
export const jobSources = pgTable(
  "job_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: jobSourceKindEnum("kind").notNull(),
    token: text("token").notNull(),
    name: text("name").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    url: text("url"),
    supported: boolean("supported").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: ts("last_fetched_at"),
    nextFetchAt: ts("next_fetch_at"),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    jobsTotal: integer("jobs_total").notNull().default(0),
    jobsKept: integer("jobs_kept").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("job_sources_kind_token_uq").on(t.kind, t.token),
    index("job_sources_due_idx").on(t.nextFetchAt),
  ],
);

export type Reason = { text: string; tone: "good" | "warn" | "bad" };

/** The free rule-based match, recomputed whenever the CV or preferences change. */
export type JobMatch = {
  reasons: Reason[];
  region: string;
  requiredLanguages: string[];
  hits: string[];
};

/** Claude's reading of the offer against the CV (only for offers that pass the rules). */
export type AiFit = {
  score: number;
  summary: string;
  why: string[];
  gaps: string[];
  angle: string;
  track: string;
  pivot: string;
  figmaShare: string;
  model: string;
};

export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => jobSources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    companyName: text("company_name").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    workplace: text("workplace").notNull().default("unknown"),
    employmentType: text("employment_type"),
    department: text("department"),
    salary: text("salary"),
    description: text("description").notNull().default(""),
    url: text("url").notNull(),
    postedAt: ts("posted_at"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    closedAt: ts("closed_at"),
    /** Shown score: the AI score when there is one, otherwise the rule score. */
    score: integer("score").notNull().default(0),
    ruleScore: integer("rule_score").notNull().default(0),
    /** core | beyond | adjacent | new_field */
    track: text("track").notNull().default("core"),
    /** Explore field for adjacent and new-field roles: real_estate, sales, marketing, product, consulting… */
    field: text("field"),
    /** none | small | pivot | big */
    pivot: text("pivot").notNull().default("none"),
    /** hands_on | mixed | direction | unknown */
    figmaShare: text("figma_share").notNull().default("unknown"),
    match: jsonb("match")
      .$type<JobMatch>()
      .notNull()
      .default({ reasons: [], region: "unknown", requiredLanguages: [], hits: [] }),
    ai: jsonb("ai").$type<AiFit | null>(),
    aiScoredAt: ts("ai_scored_at"),
    aiError: text("ai_error"),
    status: jobOfferStatusEnum("status").notNull().default("new"),
    statusAt: ts("status_at"),
    appliedAt: ts("applied_at"),
    followUpAt: ts("follow_up_at"),
    note: text("note"),
    coverLetter: text("cover_letter"),
    coverLetterLang: text("cover_letter_lang"),
    coverLetterAt: ts("cover_letter_at"),
    /** When the offer was included in the daily digest (so it is reported once). */
    digestedAt: ts("digested_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("job_offers_source_ext_uq").on(t.sourceId, t.externalId),
    index("job_offers_list_idx").on(t.status, t.score),
    index("job_offers_track_idx").on(t.track, t.score),
    index("job_offers_company_idx").on(t.companyId),
    index("job_offers_seen_idx").on(t.firstSeenAt),
  ],
);

/** Named filter sets on the Matches and Explore screens. */
export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  screen: text("screen").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Grow: the advisor chat (one thread per career path, plus "general")
// ---------------------------------------------------------------------------

export const advisorMessages = pgTable(
  "advisor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thread: text("thread").notNull(),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    links: jsonb("links").$type<{ title: string; url: string }[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("advisor_messages_thread_idx").on(t.thread, t.createdAt)],
);

// ---------------------------------------------------------------------------
// CV studio (ported from the "Kreator CV pod oferty")
// ---------------------------------------------------------------------------

/** The experience base: one row ("main") holding the whole base as JSON (see src/lib/cv/base.ts). */
export const cvBase = pgTable("cv_base", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

/** One CV written for one posting: the posting, the analysis, the CV with fact ids, and its checks. */
export const cvVersions = pgTable(
  "cv_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id").references(() => jobOffers.id, { onDelete: "set null" }),
    company: text("company").notNull().default(""),
    position: text("position").notNull().default(""),
    language: text("language"),
    link: text("link"),
    offerText: text("offer_text").notNull(),
    /** new → analyzed → drafted → done; "failed" keeps the last error in `error`. */
    stage: text("stage").notNull().default("new"),
    error: text("error"),
    analysis: jsonb("analysis").$type<unknown>(),
    cv: jsonb("cv").$type<unknown>(),
    meta: jsonb("meta").$type<{ changes: string[]; gaps: string[]; questions: string[] } | null>(),
    checks: jsonb("checks").$type<unknown>(),
    baseUpdatedAt: text("base_updated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cv_versions_created_idx").on(t.createdAt), index("cv_versions_offer_idx").on(t.offerId)],
);

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export const leases = pgTable("leases", {
  name: text("name").primaryKey(),
  holder: text("holder").notNull(),
  expiresAt: ts("expires_at").notNull(),
});

export const providerUsage = pgTable(
  "provider_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    credits: doublePrecision("credits").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    status: text("status").notNull(), // reserved | committed | released
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("provider_usage_time_idx").on(t.createdAt)],
);

export const hostState = pgTable("host_state", {
  host: text("host").primaryKey(),
  robotsTxt: text("robots_txt"),
  robotsStatus: integer("robots_status"),
  robotsFetchedAt: ts("robots_fetched_at"),
  lastFetchAt: ts("last_fetch_at"),
  consecutiveErrors: integer("consecutive_errors").notNull().default(0),
});

export const fetchLog = pgTable(
  "fetch_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    host: text("host").notNull(),
    status: integer("status"),
    outcome: text("outcome").notNull(),
    bytes: integer("bytes"),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("fetch_log_host_idx").on(t.host, t.fetchedAt)],
);

export const appEvents = pgTable(
  "app_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: text("level").notNull(), // info | warning | error
    category: text("category").notNull(),
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("app_events_open_idx").on(t.resolvedAt, t.level, t.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Auth (single owner)
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the session token
  createdAt: createdAt(),
  expiresAt: ts("expires_at").notNull(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_idx").on(t.ipHash, t.createdAt)],
);
