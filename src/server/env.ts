/**
 * Server environment, validated once. Secrets live only here (never in client bundles).
 * Optional integrations are `undefined` when not configured; the UI reports them as
 * "awaiting configuration" instead of failing.
 */
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_PASSWORD_HASH: optional,
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(12),
  // AI (Claude): scoring against the CV, cover letters, the Grow advisor. Optional: without a key the
  // app still collects and rule-scores offers.
  ANTHROPIC_API_KEY: optional,
  /** Cover letters and the advisor. */
  AI_MODEL: z.string().default("claude-opus-5-5"),
  /** Bulk scoring of offers. */
  AI_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  // Job feeds, optional free keys: Adzuna (developer.adzuna.com), Jooble (jooble.org/api/about)
  ADZUNA_APP_ID: optional,
  ADZUNA_APP_KEY: optional,
  JOOBLE_API_KEY: optional,
  /** Protects /api/digest, which the morning routine reads (Authorization: Bearer …). */
  DIGEST_TOKEN: optional,
  CRAWLER_CONTACT_URL: z.string().default("https://lukaszwrzal.com"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid server environment: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** For tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function integrations() {
  const e = env();
  return {
    ai: Boolean(e.ANTHROPIC_API_KEY),
    adzuna: Boolean(e.ADZUNA_APP_ID && e.ADZUNA_APP_KEY),
    jooble: Boolean(e.JOOBLE_API_KEY),
    digest: Boolean(e.DIGEST_TOKEN),
  };
}
