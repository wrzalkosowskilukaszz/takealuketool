import { z } from "zod";
import { PATHS } from "@/lib/grow/paths";
import { api, parseBody } from "@/server/http";
import { getSettings, saveSettings } from "@/server/settings";

export const GET = api(async () => getSettings("grow"));

/** Follow or unfollow a path, or save your notes on it. */
export const PATCH = api(async (req) => {
  const slugs = PATHS.map((p) => p.slug) as [string, ...string[]];
  const b = await parseBody(
    req,
    z.object({
      slug: z.enum(slugs),
      followed: z.boolean().optional(),
      note: z.string().max(4000).optional(),
    }),
  );
  const g = await getSettings("grow");
  const followed = new Set(g.followed);
  if (b.followed === true) followed.add(b.slug);
  if (b.followed === false) followed.delete(b.slug);
  const notes = { ...g.notes };
  if (b.note !== undefined) {
    if (b.note.trim()) notes[b.slug] = b.note;
    else delete notes[b.slug];
  }
  return saveSettings("grow", { followed: [...followed], notes });
});
