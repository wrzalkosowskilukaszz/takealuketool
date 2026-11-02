import { jobDetail, StatusPatch, setJobStatus } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => jobDetail(params.id));

/** Status (new → saved → applied → interview → offer / rejected, or "not for me"), note and follow-up date. */
export const PATCH = api<{ id: string }>(async (req, { params }) => {
  await setJobStatus(params.id, await parseBody(req, StatusPatch));
  return { ok: true };
});
