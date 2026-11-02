import { cvVersionDocx } from "@/server/cv/docx";
import { getVersion } from "@/server/cv/service";
import { api, notFound } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const v = await getVersion(params.id);
  if (!v.cv) throw notFound("This version has no CV yet.");
  const name = [v.cv.personal.name, "CV", v.position.replace(/\s*\([^)]*\)\s*/g, " ").trim()]
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  const file = await cvVersionDocx(v.cv, name);
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-length": String(file.length),
      "content-disposition": `attachment; filename="CV.docx"; filename*=UTF-8''${encodeURIComponent(`${name}.docx`)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
