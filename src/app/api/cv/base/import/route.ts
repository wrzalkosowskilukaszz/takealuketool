import { importBundle } from "@/server/cv/service";
import { api } from "@/server/http";

/** Imports a Kreator export: a base JSON on its own, or { base, versions }. Replaces the base. */
export const POST = api(async (req) => {
  const body = await req.json().catch(() => null);
  return importBundle(body);
});
