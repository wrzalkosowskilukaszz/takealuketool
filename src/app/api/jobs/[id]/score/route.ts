import { eq } from "drizzle-orm";
import { scoreOffer } from "@/server/ai/score";
import { db } from "@/server/db/client";
import { jobOffers } from "@/server/db/schema";
import { api, badRequest, notFound } from "@/server/http";
import { getSettings } from "@/server/settings";

export const maxDuration = 60;

/** Asks Claude to read this one offer against the CV now, instead of waiting for the next tick. */
export const POST = api<{ id: string }>(async (_req, { params }) => {
  const [o] = await db()
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyName: jobOffers.companyName,
      location: jobOffers.location,
      description: jobOffers.description,
    })
    .from(jobOffers)
    .where(eq(jobOffers.id, params.id))
    .limit(1);
  if (!o) throw notFound("Offer not found");
  const career = await getSettings("career");
  if (!career.cvText) throw badRequest("Upload your CV first (Settings → CV).");
  return { ai: await scoreOffer(o, career.cvText) };
});
