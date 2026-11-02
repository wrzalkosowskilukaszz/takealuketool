import { z } from "zod";
import { factsFromNote } from "@/server/cv/service";
import { api, parseBody } from "@/server/http";

export const maxDuration = 120;

/** Claude splits your note into facts; they are added as "to confirm". */
export const POST = api(async (req) => {
  const b = await parseBody(req, z.object({ note: z.string().min(1).max(20_000) }));
  return factsFromNote(b.note);
});
