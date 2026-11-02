import { eq } from "drizzle-orm";
import { scoreOffer } from "@/server/ai/score";
import { cvSourceText } from "@/server/cv/service";
import { db } from "@/server/db/client";
import { jobOffers } from "@/server/db/schema";
import { api, badRequest, notFound } from "@/server/http";

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
  const cvText = await cvSourceText();
  if (!cvText) throw badRequest("Upload your CV (Settings) or import your experience base (CV) first.");
  return { ai: await scoreOffer(o, cvText) };
});
