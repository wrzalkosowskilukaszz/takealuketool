import { z } from "zod";
import { getBase, saveBase } from "@/server/cv/service";
import { api, parseBody } from "@/server/http";

export const GET = api(async () => ({ base: await getBase() }));

/** Saves the whole base. `expected` is the updatedAt you loaded, so a save cannot overwrite a newer one. */
export const PUT = api(async (req) => {
  const b = await parseBody(req, z.object({ base: z.unknown(), expected: z.string().nullable().optional() }));
  return { base: await saveBase(b.base, b.expected) };
});
