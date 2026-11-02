import { offerForCv } from "@/server/cv/service";
import { api } from "@/server/http";

/** A collected offer as the starting text of a new CV. */
export const GET = api(async (req) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { offer: null };
  return { offer: await offerForCv(id) };
});
