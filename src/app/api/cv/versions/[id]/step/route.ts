import { z } from "zod";
import { runStep } from "@/server/cv/service";
import { api, parseBody } from "@/server/http";

// One Claude call per request; drafting a long CV can take a couple of minutes.
export const maxDuration = 300;

export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, z.object({ step: z.enum(["analyze", "draft", "verify"]) }));
  return { version: await runStep(params.id, b.step) };
});
