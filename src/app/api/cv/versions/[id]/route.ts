import { z } from "zod";
import { deleteVersion, getVersion, saveVersion } from "@/server/cv/service";
import { api, parseBody } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => ({
  version: await getVersion(params.id),
}));

/** Saves your edits to the CV (and which checks you marked as checked). */
export const PUT = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, z.object({ cv: z.unknown(), checks: z.unknown() }));
  return { version: await saveVersion(params.id, b) };
});

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await deleteVersion(params.id);
  return { ok: true };
});
