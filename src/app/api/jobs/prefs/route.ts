import { z } from "zod";
import { EXPLORE_FIELDS, TRACKS } from "@/lib/jobs/types";
import { careerProfile, savePrefs } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

export const GET = api(async () => careerProfile());

export const PUT = api(async (req) => {
  const words = z.array(z.string().trim().min(1).max(60)).max(60);
  const b = await parseBody(
    req,
    z
      .object({
        tracks: z.array(z.enum(TRACKS)),
        exploreFields: z.array(z.enum(EXPLORE_FIELDS)),
        locations: z.array(z.enum(["warsaw", "poland_other", "remote_poland"])),
        languages: z.array(z.string().max(5)),
        workTypes: z.array(z.enum(["full_time", "freelance", "part_time"])),
        extraKeywords: words,
        excludeKeywords: words,
        cvKeywords: words,
        showFrom: z.number().int().min(0).max(100),
        exploreShowFrom: z.number().int().min(0).max(100),
      })
      .partial(),
  );
  await savePrefs(b);
  return { ok: true };
});
