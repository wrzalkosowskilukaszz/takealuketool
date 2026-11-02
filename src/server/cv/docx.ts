/** A CV version as a Word file: the same layout as the on-screen paper (A4, Calibri, ruled headings). */
import { type CvDoc, cvModel } from "@/lib/cv/base";
import { docxFromBody, esc } from "../careers/docx.ts";

const run = (text: string, o: { size?: number; bold?: boolean; italic?: boolean; color?: string } = {}) => {
  const props = `${o.bold ? "<w:b/>" : ""}${o.italic ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : ""}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
};
const para = (runs: string, ppr = "") => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${runs}</w:p>`;
const bullet = (t: string) =>
  para(
    `<w:r><w:t xml:space="preserve">•  </w:t></w:r>${run(t)}`,
    `<w:ind w:left="360" w:hanging="240"/><w:spacing w:after="30"/>`,
  );

export async function cvVersionDocx(cv: CvDoc, title: string): Promise<Uint8Array> {
  const m = cvModel(cv);
  const out: string[] = [
    para(run(m.name, { size: 36, bold: true }), `<w:spacing w:after="40"/>`),
    para(run(m.headline, { size: 23 }), `<w:spacing w:after="40"/>`),
    para(run(m.contact, { size: 19, color: "333333" }), `<w:spacing w:after="120"/>`),
  ];
  for (const s of m.sections) {
    out.push(
      para(
        run(s.title.toUpperCase(), { size: 22, bold: true, color: "111111" }),
        `<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="999999"/></w:pBdr><w:spacing w:before="240" w:after="80"/>`,
      ),
    );
    if (s.type === "para") out.push(para(run(s.text), `<w:spacing w:after="60"/>`));
    if (s.type === "list") for (const i of s.items) out.push(bullet(i));
    if (s.type === "roles")
      for (const r of s.roles) {
        out.push(
          para(
            `${run(r.head, { bold: true })}<w:r><w:tab/></w:r>${run(r.dates)}`,
            `<w:keepNext/><w:tabs><w:tab w:val="right" w:pos="9746"/></w:tabs><w:spacing w:before="140" w:after="20"/>`,
          ),
        );
        if (r.sub)
          out.push(
            para(
              run(r.sub, { italic: true, size: 19, color: "444444" }),
              `<w:keepNext/><w:spacing w:after="20"/>`,
            ),
          );
        for (const b of r.bullets) out.push(bullet(b));
      }
  }
  return docxFromBody(out.join(""), title);
}
