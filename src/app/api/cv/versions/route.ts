import { z } from "zod";
import { createVersion, listVersions } from "@/server/cv/service";
import { api, parseBody } from "@/server/http";

export const GET = api(async () => ({ versions: await listVersions() }));

/** Starts a new CV from a pasted posting. The steps then run one by one (…/step). */
export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      offerText: z.string().max(60_000),
      link: z.string().max(2000).nullable().optional(),
      offerId: z.string().uuid().nullable().optional(),
    }),
  );
  return createVersion(b);
});
