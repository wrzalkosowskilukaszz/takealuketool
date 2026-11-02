/**
 * Loads research/companies.json into the companies table. Safe to run again: existing companies (by
 * domain) keep your favourite/excluded marks; only the name, group and note are refreshed.
 *   pnpm companies:import
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { SECTORS } from "../src/lib/jobs/sectors.ts";
import { closeDb, db } from "../src/server/db/client.ts";
import { companies } from "../src/server/db/schema.ts";

const File = z.object({
  companies: z.array(
    z.object({
      name: z.string().min(1),
      website: z.string().url(),
      sector: z.enum(SECTORS),
      note: z.string().optional(),
      careersUrl: z.string().url().optional(),
    }),
  ),
});

const file = File.parse(
  JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../research/companies.json"), "utf8")),
);
let added = 0;
for (const c of file.companies) {
  const host = new URL(c.website).host.replace(/^www\./, "").toLowerCase();
  const r = await db()
    .insert(companies)
    .values({
      name: c.name,
      website: c.website,
      domain: host,
      sector: c.sector,
      note: c.note ?? null,
      careersUrl: c.careersUrl ?? null,
      sourceUrl: "research/companies.json",
    })
    .onConflictDoUpdate({
      target: companies.domain,
      set: { name: c.name, sector: c.sector, note: c.note ?? null, updatedAt: new Date() },
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });
  if (r[0]?.inserted) added++;
}
console.log(`${file.companies.length} companies in the file, ${added} new.`);
await closeDb();
