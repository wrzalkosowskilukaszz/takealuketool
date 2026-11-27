import { z } from "zod";
import { extractOffer } from "@/server/ai/extract";
import { api, parseBody } from "@/server/http";

export const maxDuration = 60;

/** Reads title, company and place from an ad saved with the "Save to Studio" button. */
export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      url: z.string().url().max(2000),
      pageTitle: z.string().max(1000).default(""),
      text: z.string().min(1).max(40_000),
    }),
  );
  return { fields: await extractOffer(b) };
});
