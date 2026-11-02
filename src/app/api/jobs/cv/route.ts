import { extractText, mimeFromName } from "@/server/careers/extract-text";
import { careerProfile, removeCv, saveCv } from "@/server/careers/service";
import { api, badRequest, searchParams } from "@/server/http";

export const maxDuration = 60;
const MAX = 4 * 1024 * 1024;

export const GET = api(async () => careerProfile());

/** Upload the CV as the raw request body (?name=cv.pdf). Only its text is kept, never the file. */
export const POST = api(async (req) => {
  const name = (searchParams(req).get("name") ?? "cv").slice(0, 200);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw badRequest("The file is empty");
  if (buf.length > MAX) throw badRequest("The file is too large (4 MB at most)");
  const mime = mimeFromName(name, req.headers.get("content-type") ?? "");
  if (!/pdf|wordprocessingml|msword|text\/plain/.test(mime))
    throw badRequest("Upload the CV as PDF, DOCX or TXT.");
  const ex = await extractText(buf, mime);
  await saveCv(name, ex.text ?? "");
  return { ok: true };
});

export const DELETE = api(async () => {
  await removeCv();
  return { ok: true };
});
