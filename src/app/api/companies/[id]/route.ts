import { z } from "zod";
import { updateCompany } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

/** Favourite (all its offers shown, with a small boost) or excluded (never shown). */
export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({ favourite: z.boolean().optional(), excluded: z.boolean().optional() }),
  );
  await updateCompany(params.id, b);
  return { ok: true };
});
