/**
 * A tiny, safe Markdown renderer for advisor answers: paragraphs, "- " bullets, "1. " lists, **bold**
 * and *italic*. It builds React elements, so nothing in the text can inject HTML.
 */
import { Fragment, type ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] ? <strong key={`${key}-${i++}`}>{m[1]}</strong> : <em key={`${key}-${i++}`}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// A message's text never changes once shown, so position-based keys are stable here.
export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim());
        const key = `b${bi}`;
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return (
            <ul key={key}>
              {lines.map((l, li) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the text of a shown message never changes
                <li key={`${key}-${li}`}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return (
            <ol key={key}>
              {lines.map((l, li) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the text of a shown message never changes
                <li key={`${key}-${li}`}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `${key}-${li}`)}</li>
              ))}
            </ol>
          );
        const heading = lines[0]?.match(/^#{1,4}\s+(.*)$/);
        return (
          <Fragment key={key}>
            {heading ? <h4>{inline(heading[1] ?? "", `${key}-h`)}</h4> : null}
            {lines.slice(heading ? 1 : 0).length ? (
              <p>
                {lines.slice(heading ? 1 : 0).map((l, li) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the text of a shown message never changes
                  <Fragment key={`${key}-${li}`}>
                    {li ? <br /> : null}
                    {inline(l, `${key}-${li}`)}
                  </Fragment>
                ))}
              </p>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
