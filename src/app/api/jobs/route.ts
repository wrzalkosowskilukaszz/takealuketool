import { z } from "zod";
import { addManualJob, Filters, listJobs, SCREENS, VIEWS } from "@/server/careers/service";
import { api, badRequest, parseBody, searchParams } from "@/server/http";

/** GET /api/jobs?screen=matches|explore&view=best|new|all&offset=0&f=<json filters> */
export const GET = api(async (req) => {
  const p = searchParams(req);
  const screen = z
    .enum(SCREENS)
    .catch("matches")
    .parse(p.get("screen") ?? "matches");
  const view = z
    .enum(VIEWS)
    .catch("best")
    .parse(p.get("view") ?? "best");
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  let raw: unknown = {};
  try {
    raw = JSON.parse(p.get("f") ?? "{}");
  } catch {
    throw badRequest("Filters are not valid JSON");
  }
  return listJobs({ screen, view, filters: Filters.parse(raw), offset });
});

/** Adds an offer you found yourself (LinkedIn, Pracuj.pl, a friend's tip): link, title, company and the ad text. */
export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      url: z.string().url().max(2000),
      title: z.string().trim().min(2).max(300),
      companyName: z.string().trim().min(1).max(200),
      location: z.string().max(300).nullable().optional(),
      description: z.string().max(20_000).nullable().optional(),
    }),
  );
  return { id: await addManualJob(b) };
});
