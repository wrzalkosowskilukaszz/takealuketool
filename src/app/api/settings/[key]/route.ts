import { z } from "zod";
import { api, badRequest } from "@/server/http";
import { getSettings, saveSettings } from "@/server/settings";

/** Career settings (CV, preferences) have their own routes under /api/jobs. */
const Key = z.enum(["scheduler", "ai", "digest", "profile", "grow"]);

export const GET = api<{ key: string }>(async (_req, { params }) => getSettings(Key.parse(params.key)));

export const PUT = api<{ key: string }>(async (req, { params }) => {
  const key = Key.parse(params.key);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Expected JSON");
  }
  return saveSettings(key, body);
});
