/**
 * Typed application settings stored as JSON rows in `settings`, validated with Zod.
 * Defaults fit one owner (Łukasz, Warsaw); everything is editable in Settings.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { EXPLORE_FIELDS, TRACKS } from "@/lib/jobs/types";
import { db } from "./db/client.ts";
import { settings } from "./db/schema.ts";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export { EXPLORE_FIELDS, type ExploreField, TRACKS, type Track } from "@/lib/jobs/types";

/** When the daily refresh starts (the hourly tick checks this). */
export const SchedulerSettings = z.object({
  enabled: z.boolean().default(true),
  localTime: hhmm.default("06:00"),
  timezone: z.string().default("Europe/Warsaw"),
});

/** What to look for, and the owner's CV text (kept only in this database). */
export const CareerSettings = z.object({
  tracks: z.array(z.enum(TRACKS)).default([...TRACKS]),
  exploreFields: z.array(z.enum(EXPLORE_FIELDS)).default([...EXPLORE_FIELDS]),
  workTypes: z.array(z.enum(["full_time", "freelance", "part_time"])).default(["full_time", "freelance"]),
  /** warsaw = Warsaw on-site/hybrid, poland_other = elsewhere in Poland, remote_poland = remote open to PL. */
  locations: z
    .array(z.enum(["warsaw", "poland_other", "remote_poland"]))
    .default(["warsaw", "poland_other", "remote_poland"]),
  languages: z.array(z.string().max(5)).default(["en", "pl"]),
  extraKeywords: z.array(z.string().max(60)).max(60).default([]),
  excludeKeywords: z.array(z.string().max(60)).max(60).default([]),
  cvText: z.string().max(60_000).default(""),
  cvFilename: z.string().nullable().default(null),
  cvUploadedAt: z.string().nullable().default(null),
  cvKeywords: z.array(z.string().max(60)).max(80).default([]),
  /** Matches shows offers from this score; Explore from its own threshold. */
  showFrom: z.number().int().min(0).max(100).default(45),
  exploreShowFrom: z.number().int().min(0).max(100).default(35),
  syncEveryHours: z.number().int().min(2).max(24).default(6),
});

/** Claude: what it may do automatically, and how much it may spend. */
export const AiSettings = z.object({
  /** Offers whose rule score reaches this are read by Claude against the CV. */
  scoreFromRuleScore: z.number().int().min(0).max(100).default(40),
  maxScoredPerDay: z.number().int().min(0).max(1000).default(150),
  dailySpendLimitUsd: z.number().min(0).default(2),
  monthlySpendLimitUsd: z.number().min(0).default(25),
  /**
   * Blended USD per million tokens used to estimate cost. An assumption, not a quoted price: check
   * https://www.anthropic.com/pricing for the configured models and adjust.
   */
  usdPerMillionTokens: z.number().min(0).default(6),
});

/** The morning digest posted to the project thread by a routine. */
export const DigestSettings = z.object({
  enabled: z.boolean().default(true),
  minScore: z.number().int().min(0).max(100).default(70),
  maxMatches: z.number().int().min(1).max(20).default(5),
  maxExplore: z.number().int().min(0).max(20).default(3),
});

/** Who you are, for cover letters. */
export const ProfileSettings = z.object({
  name: z.string().default("Łukasz Wrzal vel Kosowski"),
  headline: z.string().default("AI Creative Lead & Product Designer"),
  email: z.string().default(""),
  phone: z.string().default(""),
  website: z.string().default("https://lukaszwrzal.com"),
  linkedin: z.string().default("https://linkedin.com/in/lukasz-wrzal"),
  city: z.string().default("Warsaw"),
  /** Notes on tone for cover letters, e.g. "direct, warm, no buzzwords". */
  voice: z.string().default("Confident and warm, concrete, no buzzwords, short sentences."),
  signOff: z.string().default("Best regards,"),
});

/** Grow tab: paths you follow and your notes on them. */
export const GrowSettings = z.object({
  followed: z.array(z.string().max(60)).max(30).default([]),
  notes: z.record(z.string(), z.string().max(4000)).default({}),
});

export const SETTINGS = {
  scheduler: SchedulerSettings,
  career: CareerSettings,
  ai: AiSettings,
  digest: DigestSettings,
  profile: ProfileSettings,
  grow: GrowSettings,
} as const;

export type SettingsKey = keyof typeof SETTINGS;
export type SettingsOf<K extends SettingsKey> = z.infer<(typeof SETTINGS)[K]>;

export async function getSettings<K extends SettingsKey>(key: K): Promise<SettingsOf<K>> {
  const [row] = await db().select().from(settings).where(eq(settings.key, key)).limit(1);
  const schema = SETTINGS[key];
  const parsed = schema.safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data as SettingsOf<K>;
  // A stored value that no longer validates falls back to defaults rather than breaking the app.
  return schema.parse({}) as SettingsOf<K>;
}

export async function saveSettings<K extends SettingsKey>(key: K, value: unknown): Promise<SettingsOf<K>> {
  const parsed = SETTINGS[key].parse(value) as SettingsOf<K>;
  await db()
    .insert(settings)
    .values({ key, value: parsed })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedAt: new Date() } });
  return parsed;
}

export async function patchSettings<K extends SettingsKey>(
  key: K,
  patch: Partial<SettingsOf<K>>,
): Promise<SettingsOf<K>> {
  const current = await getSettings(key);
  return saveSettings(key, { ...current, ...patch });
}
