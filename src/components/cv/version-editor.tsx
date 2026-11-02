"use client";

import { ArrowLeft, Copy, Download, Printer, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import {
  type CvChecks,
  type CvDoc,
  type CvIssue,
  cvPlainText,
  type ExperienceBase,
  fmtDate,
  getLine,
  issueKey,
  localChecks,
} from "@/lib/cv/base";
import type { CvVersion } from "@/server/cv/service";
import { PIPELINE, runPipeline, StepList } from "./new-cv";

const MATCH: Record<string, string> = {
  strong: "Strong match",
  transferable: "Transferable",
  gap: "Not confirmed",
};
const MATCH_TONE: Record<string, string> = { strong: "tag-ok", transferable: "tag-warn", gap: "tag-bad" };

/** One editable run of text. It is uncontrolled while you type, so the caret never jumps. */
function Editable({
  text,
  onChange,
  className,
}: {
  text: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: set once per mount; edits flow out through onInput.
  useEffect(() => {
    if (ref.current) ref.current.textContent = text;
  }, []);
  return (
    // biome-ignore lint/a11y/useSemanticElements: an inline, single-line rich-text run; inputs cannot wrap inside the CV's text flow.
    <span
      ref={ref}
      className={`cv-edit ${className ?? ""}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      tabIndex={0}
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      onPaste={(e) => {
        e.preventDefault();
        const t = e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ");
        document.execCommand("insertText", false, t);
      }}
    />
  );
}

export function VersionEditor({ initial }: { initial: CvVersion }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const cv = useRef<CvDoc | null>(initial.cv ? structuredClone(initial.cv) : null);
  const checks = useRef<CvChecks>(structuredClone(initial.checks));
  const [rev, setRev] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [base, setBase] = useState<ExperienceBase | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<number | null>(null);
  const [steps, setSteps] = useState<
    { label: string; state: "todo" | "run" | "done" | "err"; detail?: string }[] | null
  >(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch<{ base: ExperienceBase | null }>("/api/cv/base")
      .then((r) => setBase(r.base))
      .catch(() => undefined);
  }, []);

  const adopt = useCallback((nv: CvVersion) => {
    setV(nv);
    cv.current = nv.cv ? structuredClone(nv.cv) : null;
    checks.current = structuredClone(nv.checks);
    setDirty(false);
    setRev((r) => r + 1);
  }, []);

  // Finish an interrupted pipeline (e.g. the tab was closed while Claude was writing).
  const resume = useCallback(async () => {
    const from = v.stage === "new" ? 0 : v.stage === "analyzed" ? 1 : v.stage === "drafted" ? 2 : 3;
    if (from > 2) return;
    setSteps(PIPELINE.map((p, i) => ({ label: p.label, state: i < from ? "done" : "todo" })));
    try {
      const nv = await runPipeline(
        v.id,
        from,
        (i, state, detail) => setSteps((x) => x?.map((s, k) => (k === i ? { ...s, state, detail } : s)) ?? x),
        new AbortController().signal,
      );
      if (nv) adopt(nv);
    } catch {
      /* the step list shows the error */
    }
  }, [v.id, v.stage, adopt]);

  const recheck = useCallback(() => {
    if (!base || !cv.current) return;
    const dismissed = new Set(checks.current.dismissed);
    checks.current.local = localChecks(cv.current, base).filter((i) => !dismissed.has(issueKey(i)));
    setRev((r) => r + 1);
  }, [base]);
  useEffect(() => {
    if (base) recheck();
  }, [base, recheck]);

  const touched = () => {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(recheck, 800);
  };
  const structural = () => {
    setDirty(true);
    recheck();
  };

  async function save() {
    if (!cv.current) return;
    setBusy("save");
    try {
      const r = await apiFetch<{ version: CvVersion }>(`/api/cv/versions/${v.id}`, {
        method: "PUT",
        body: { cv: cv.current, checks: checks.current },
      });
      setV(r.version);
      checks.current = structuredClone(r.version.checks);
      setDirty(false);
      toast("Saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not saved", "error");
    } finally {
      setBusy(null);
    }
  }

  async function reverify() {
    if (dirty) await save();
    setBusy("verify");
    try {
      adopt(
        (await apiFetch<{ version: CvVersion }>(`/api/cv/versions/${v.id}/verify`, { body: {} })).version,
      );
      toast("Checked again");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The check failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    if (dirty) await save();
    window.location.assign(`/api/cv/versions/${v.id}/docx`);
  }

  if (!cv.current) {
    return (
      <div className="stack-lg">
        <Header v={v} dirty={false} />
        <section className="card card-pad stack">
          {v.stage === "failed" ? (
            <Callout tone="bad">
              <span>
                {v.error ?? "The posting could not be analyzed."} Paste the full posting in a new CV.
              </span>
            </Callout>
          ) : (
            <>
              <p className="small secondary" style={{ margin: 0 }}>
                This CV is not finished yet{v.error ? `: ${v.error}` : "."}
              </p>
              {steps ? (
                <StepList steps={steps} />
              ) : (
                <div className="btn-group">
                  <button type="button" className="btn btn-primary" onClick={resume}>
                    Continue writing
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    );
  }

  const c = cv.current;
  const all = [...checks.current.local, ...checks.current.claude];
  const byPath = new Map<string, CvIssue[]>();
  for (const i of all) byPath.set(i.path, [...(byPath.get(i.path) ?? []), i]);
  const flag = (path: string) => {
    const l = byPath.get(path);
    return l ? (l.some((x) => x.severity === "high") ? "flag flag-high" : "flag") : "";
  };
  const L = c.labels;
  const lab = (k: keyof CvDoc["labels"]) => (
    <Editable
      key={`l-${k}-${rev}`}
      text={L[k]}
      onChange={(x) => {
        L[k] = x;
        touched();
      }}
    />
  );
  const line = (path: string, item: { text: string }) => (
    <Editable
      key={`${path}-${rev}`}
      text={item.text}
      className={flag(path)}
      onChange={(x) => {
        item.text = x;
        touched();
      }}
    />
  );
  const role = base?.roles.find((r) => r.id === (addFor !== null ? c.experience[addFor]?.role_id : ""));

  return (
    <div className="stack-lg">
      <Header v={v} dirty={dirty} />
      <div className="toolbar cv-toolbar">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || busy !== null}>
          <Save size={14} /> {busy === "save" ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await navigator.clipboard.writeText(cvPlainText(c));
            toast("CV text copied");
          }}
        >
          <Copy size={14} /> Copy text
        </button>
        <button type="button" className="btn" onClick={download}>
          <Download size={14} /> Word (.docx)
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Printer size={14} /> PDF (print)
        </button>
        <button type="button" className="btn btn-quiet" onClick={reverify} disabled={busy !== null}>
          <RefreshCw size={14} /> {busy === "verify" ? "Checking…" : "Check again"}
        </button>
      </div>

      <div className="cv-layout">
        <div className="stack cv-notes">
          <section className="card card-pad stack">
            <h3 className="section-title" style={{ margin: 0 }}>
              Fact-check against your base
            </h3>
            {checks.current.failed ? (
              <Callout>
                <span>The automatic fact-check did not finish. Use “Check again”.</span>
              </Callout>
            ) : null}
            {!all.length && !checks.current.failed ? (
              <Callout tone="info">
                <span>
                  Every line has a source in your confirmed facts and the fact-check found nothing. Read the
                  CV once more before sending it.
                </span>
              </Callout>
            ) : null}
            {all.map((i) => {
              const item = getLine(c, i.path);
              if (!item) return null;
              return (
                <div key={issueKey(i)} className={`cv-issue ${i.severity === "high" ? "cv-issue-high" : ""}`}>
                  <div className="small">
                    <strong>{i.severity === "high" ? "Fix: " : "Minor: "}</strong>
                    {i.problem}
                  </div>
                  <div className="small muted">“{item.text}”</div>
                  {i.suggestion ? (
                    <div className="small">
                      Suggestion: “{i.suggestion}”{" "}
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          item.text = i.suggestion;
                          checks.current.claude = checks.current.claude.filter((x) => x !== i);
                          structural();
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  ) : null}
                  <div>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      onClick={() => {
                        checks.current.dismissed.push(issueKey(i));
                        checks.current.claude = checks.current.claude.filter((x) => x !== i);
                        structural();
                      }}
                    >
                      Mark as checked
                    </button>
                  </div>
                </div>
              );
            })}
            {checks.current.language_notes.length ? (
              <details className="disclosure">
                <summary className="small">Language notes</summary>
                <ul className="small">
                  {checks.current.language_notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="card card-pad stack">
            <h3 className="section-title" style={{ margin: 0 }}>
              What changed, and why
            </h3>
            {v.meta.changes.length ? (
              <ul className="small cv-list">
                {v.meta.changes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Nothing noted.</p>
            )}
            <h3 className="section-title" style={{ margin: 0 }}>
              Requirements your base does not confirm
            </h3>
            {v.meta.gaps.length ? (
              <ul className="small cv-list">
                {v.meta.gaps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">None found.</p>
            )}
            {v.meta.questions.length ? (
              <>
                <h3 className="section-title" style={{ margin: 0 }}>
                  Questions that could improve this CV
                </h3>
                <ol className="small cv-list">
                  {v.meta.questions.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
                <p className="xsmall muted" style={{ margin: 0 }}>
                  Add your answer to the base (Experience base → Add facts from a note), then write the CV
                  again.
                </p>
              </>
            ) : null}
          </section>

          {v.analysis ? <Analysis v={v} /> : null}
        </div>

        <div className="cv-paper-wrap">
          <article className="cv-paper" aria-label="CV preview">
            <p className="cv-name">{c.personal.name}</p>
            <p className="cv-headline">
              <Editable
                key={`h-${rev}`}
                text={c.headline}
                onChange={(x) => {
                  c.headline = x;
                  touched();
                }}
              />
            </p>
            <p className="cv-contact">
              {[
                c.personal.phone,
                c.personal.email,
                c.personal.linkedin,
                c.personal.website,
                c.personal.location,
              ]
                .filter(Boolean)
                .join(" | ")}
            </p>
            {c.summary.length ? (
              <>
                <h4>{lab("summary")}</h4>
                <p className="cv-para">
                  {c.summary.map((x, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a CV line's position is its identity (checks refer to it by path).
                    <span key={`s${i}-${rev}`}>{line(`summary.${i}`, x)} </span>
                  ))}
                </p>
              </>
            ) : null}
            {c.core_skills.length ? (
              <>
                <h4>{lab("skills")}</h4>
                <p className="cv-para">
                  {c.core_skills.map((x, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a CV line's position is its identity (checks refer to it by path).
                    <span key={`k${i}-${rev}`}>
                      {i ? " | " : ""}
                      {line(`core_skills.${i}`, x)}
                    </span>
                  ))}
                </p>
              </>
            ) : null}
            <h4>{lab("experience")}</h4>
            {c.experience.map((e, j) => (
              <div key={`${e.role_id}-${rev}`} className="cv-role">
                <div className="cv-role-head">
                  <span>
                    {e.title} — {e.company}
                  </span>
                  <span className="cv-dates">
                    {fmtDate(e.start, e.dateFormat)} – {fmtDate(e.end, e.dateFormat, L.present)}
                  </span>
                </div>
                {e.contract || e.function_note ? (
                  <div className="cv-role-sub">
                    {e.contract}
                    {e.contract && e.function_note ? " · " : ""}
                    {e.function_note ? (
                      <Editable
                        key={`fn-${e.role_id}-${rev}`}
                        text={e.function_note}
                        onChange={(x) => {
                          e.function_note = x;
                          touched();
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
                {e.bullets.length ? (
                  <ul>
                    {e.bullets.map((b, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a CV line's position is its identity (checks refer to it by path).
                      <li key={`b${i}-${rev}`}>
                        {line(`experience.${j}.bullets.${i}`, b)}
                        <button
                          type="button"
                          className="cv-ctl"
                          title="Remove this line"
                          onClick={() => {
                            e.bullets.splice(i, 1);
                            const prefix = `experience.${j}.bullets.`;
                            checks.current.claude = remap(checks.current.claude, prefix, i);
                            structural();
                          }}
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="cv-ctl cv-ctl-add" onClick={() => setAddFor(j)}>
                  + line from your base
                </button>
              </div>
            ))}
            {(["education", "languages"] as const).map((sec) =>
              c[sec].length ? (
                <div key={sec}>
                  <h4>{lab(sec)}</h4>
                  <ul>
                    {c[sec].map((x, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a CV line's position is its identity (checks refer to it by path).
                      <li key={`${sec}${i}-${rev}`}>{line(`${sec}.${i}`, x)}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            {c.tools.length ? (
              <>
                <h4>{lab("tools")}</h4>
                <p className="cv-para">
                  {c.tools.map((x, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a CV line's position is its identity (checks refer to it by path).
                    <span key={`t${i}-${rev}`}>
                      {i ? ", " : ""}
                      {line(`tools.${i}`, x)}
                    </span>
                  ))}
                </p>
              </>
            ) : null}
          </article>
          <p className="xsmall muted cv-paper-hint">
            Click any text in the preview to edit it. Role headers (employer, title, dates) come from your
            base; change them in Experience base.
          </p>
        </div>
      </div>

      <Dialog
        open={addFor !== null}
        onClose={() => setAddFor(null)}
        title="Add a line from your base"
        description={
          addFor !== null ? `${c.experience[addFor]?.title} — ${c.experience[addFor]?.company}` : ""
        }
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            Pick a confirmed fact. It goes into the CV as written; rephrase it in the preview afterwards.
          </p>
          {role?.facts.filter((f) => f.status === "confirmed").length ? (
            role.facts
              .filter((f) => f.status === "confirmed")
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="btn cv-pick"
                  onClick={() => {
                    if (addFor === null) return;
                    c.experience[addFor]!.bullets.push({ text: f.text, fact_ids: [f.id] });
                    setAddFor(null);
                    structural();
                  }}
                >
                  {f.text}
                </button>
              ))
          ) : (
            <p className="small">No confirmed facts for this role.</p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function remap(list: CvIssue[], prefix: string, i: number): CvIssue[] {
  return list
    .filter((x) => x.path !== `${prefix}${i}`)
    .map((x) => {
      if (!x.path.startsWith(prefix)) return x;
      const k = Number(x.path.slice(prefix.length));
      return k > i ? { ...x, path: `${prefix}${k - 1}` } : x;
    });
}

function Header({ v, dirty }: { v: CvVersion; dirty: boolean }) {
  return (
    <header className="page-header cv-header">
      <div>
        <Link href="/cv/versions" className="back-link">
          <ArrowLeft size={14} /> All versions
        </Link>
        <h1>
          {v.position} <span className="secondary">· {v.company}</span>
        </h1>
        <p>
          {new Date(v.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {v.language ? ` · ${v.language.toUpperCase()}` : ""}
          {v.offerId ? (
            <>
              {" · "}
              <Link href={`/matches?o=${v.offerId}`}>the offer</Link>
            </>
          ) : null}
          {dirty ? <span className="text-warn"> · unsaved changes</span> : null}
        </p>
      </div>
    </header>
  );
}

function Analysis({ v }: { v: CvVersion }) {
  const a = v.analysis!;
  const reqs = (list: typeof a.must_have) => (
    <div className="stack" style={{ gap: 8 }}>
      {list.map((r) => (
        <div key={r.req} className="cv-req">
          <span className={`tag ${MATCH_TONE[r.match] ?? ""}`}>{MATCH[r.match] ?? r.match}</span>
          <div className="small">
            <strong>{r.req}</strong>
            {r.comment ? <div className="muted">{r.comment}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <section className="card card-pad stack">
      <h3 className="section-title" style={{ margin: 0 }}>
        The posting, analyzed
      </h3>
      {a.summary ? (
        <p className="small" style={{ margin: 0 }}>
          {a.summary}
        </p>
      ) : null}
      {a.recruiter_priorities?.length ? (
        <div>
          <strong className="small">What the recruiter will check first</strong>
          <ul className="small cv-list">
            {a.recruiter_priorities.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <strong className="small">Must-haves</strong>
      {reqs(a.must_have ?? [])}
      {a.nice_to_have?.length ? (
        <>
          <strong className="small">Nice to have</strong>
          {reqs(a.nice_to_have)}
        </>
      ) : null}
      <details className="disclosure">
        <summary className="small">Tasks, expected results, seniority, vocabulary</summary>
        <div className="small stack" style={{ gap: 8, marginTop: 8 }}>
          {a.key_tasks?.length ? (
            <div>
              <strong>Tasks</strong>
              <ul className="cv-list">
                {a.key_tasks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {a.expected_results?.length ? (
            <div>
              <strong>Expected results</strong>
              <ul className="cv-list">
                {a.expected_results.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {a.seniority ? (
            <div>
              <strong>Responsibility and autonomy: </strong>
              {a.seniority}
            </div>
          ) : null}
          {a.vocabulary?.length ? (
            <div>
              <strong>Employer's vocabulary: </strong>
              {a.vocabulary.map((t, i) => (
                <span key={t.term}>
                  {i ? ", " : ""}
                  <span
                    className={t.covered_by.length ? "" : "cv-uncovered"}
                    title={
                      t.covered_by.length
                        ? `covered by ${t.covered_by.join(", ")}`
                        : "not covered by your base"
                    }
                  >
                    {t.term}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </details>
      <details className="disclosure">
        <summary className="small">The posting</summary>
        {v.link ? (
          <p className="small">
            <a href={v.link} target="_blank" rel="noopener noreferrer">
              {v.link}
            </a>
          </p>
        ) : null}
        <pre className="pre small cv-offer-text">{v.offerText}</pre>
      </details>
    </section>
  );
}
