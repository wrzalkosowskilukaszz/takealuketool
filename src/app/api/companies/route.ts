import { z } from "zod";
import { SECTORS } from "@/lib/jobs/sectors";
import { addCompany, listCompanies } from "@/server/careers/service";
import { api, parseBody, searchParams } from "@/server/http";

export const GET = api(async (req) => ({
  rows: await listCompanies(searchParams(req).get("q") ?? undefined),
}));

/** Add a company whose careers page should be watched. Its job board is found on the next sync. */
export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      name: z.string().trim().min(1).max(200),
      website: z.string().trim().min(3).max(300),
      sector: z.enum(SECTORS).optional(),
      note: z.string().max(500).optional(),
    }),
  );
  return { id: await addCompany(b) };
});
