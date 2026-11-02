/** Live offers shown on a Grow path page. */
import { and, desc, eq, ilike, isNull, ne, or, type SQL } from "drizzle-orm";
import type { CareerPath } from "@/lib/grow/paths";
import { db } from "./db/client.ts";
import { jobOffers } from "./db/schema.ts";

/** Title patterns for paths that are not one Explore field. */
const TITLE_HINTS: Record<string, string[]> = {
  "creative-technologist": ["%creative technolog%", "%creative developer%", "%creative coder%"],
  "ai-consultant": ["%ai consult%", "%ai trainer%", "%ai enablement%", "%ai adoption%"],
  "creative-entrepreneur": ["%founder%", "%studio lead%", "%head of studio%"],
};

export async function offersForPath(path: CareerPath, limit = 6) {
  const hints = TITLE_HINTS[path.slug] ?? [];
  const match: SQL[] = [];
  if (path.field) match.push(eq(jobOffers.field, path.field));
  for (const h of hints) match.push(ilike(jobOffers.title, h));
  if (!match.length) return [];
  const rows = await db()
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyName: jobOffers.companyName,
      location: jobOffers.location,
      score: jobOffers.score,
      track: jobOffers.track,
      ai: jobOffers.ai,
    })
    .from(jobOffers)
    .where(and(isNull(jobOffers.closedAt), ne(jobOffers.status, "dismissed"), or(...match)))
    .orderBy(desc(jobOffers.score))
    .limit(limit);
  return rows.map((r) => ({ ...r, scoredByClaude: Boolean(r.ai), ai: undefined }));
}
