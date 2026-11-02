import { z } from "zod";
import { Filters, listViews, SCREENS, saveView } from "@/server/careers/service";
import { api, parseBody, searchParams } from "@/server/http";

export const GET = api(async (req) => {
  const screen = z
    .enum(SCREENS)
    .catch("matches")
    .parse(searchParams(req).get("screen") ?? "matches");
  return { views: await listViews(screen) };
});

export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({ screen: z.enum(SCREENS), name: z.string().trim().min(1).max(60), filters: Filters }),
  );
  return { id: await saveView(b.screen, b.name, b.filters) };
});
