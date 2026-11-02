import { z } from "zod";
import { draftCoverLetter, saveCoverLetter } from "@/server/ai/letters";
import { api, parseBody } from "@/server/http";
import { withBudget } from "@/server/jobs/budget";

export const maxDuration = 120;

/** Claude drafts a cover letter for this offer. */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      language: z.enum(["en", "pl"]).default("en"),
      length: z.enum(["short", "standard"]).default("standard"),
      extra: z.string().max(600).optional(),
    }),
  );
  // The reservation only checks the spend limits; the Claude call records its real token use itself.
  return withBudget(
    { provider: "anthropic", operation: "cover_letter", credits: 12, detail: params.id },
    async () => ({ value: await draftCoverLetter(params.id, b), credits: 0 }),
  );
});

/** Saves your edits to the letter (an empty text deletes it). */
export const PUT = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({ text: z.string().max(8000), language: z.enum(["en", "pl"]).nullable().optional() }),
  );
  return saveCoverLetter(params.id, b.text, b.language);
});
