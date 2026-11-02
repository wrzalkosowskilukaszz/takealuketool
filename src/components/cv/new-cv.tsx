"use client";

import { Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Callout } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { CvVersion } from "@/server/cv/service";

type Step = { label: string; state: "todo" | "run" | "done" | "err"; detail?: string };

export const PIPELINE: { step: "analyze" | "draft" | "verify"; label: string; hint: string }[] = [
  { step: "analyze", label: "Read the posting and compare it with your base", hint: "usually 30–90 s" },
  { step: "draft", label: "Write the CV", hint: "usually 1–2 min" },
  { step: "verify", label: "Fact-check every line against your base", hint: "usually under a minute" },
];

/** Runs the remaining steps of a version in order; the server stores each result as it finishes. */
export async function runPipeline(
  id: string,
  from: number,
  onStep: (i: number, state: Step["state"], detail?: string) => void,
  signal: AbortSignal,
): Promise<CvVersion | null> {
  let v: CvVersion | null = null;
  for (let i = from; i < PIPELINE.length; i++) {
    if (signal.aborted) return v;
    onStep(i, "run", PIPELINE[i]!.hint);
    try {
      v = (
        await apiFetch<{ version: CvVersion }>(`/api/cv/versions/${id}/step`, {
          body: { step: PIPELINE[i]!.step },
          signal,
        })
      ).version;
    } catch (e) {
      onStep(i, "err", e instanceof ApiError ? e.message : "Stopped");
      throw e;
    }
    if (v.stage === "failed") {
      onStep(i, "err", v.error ?? "Failed");
      return v;
    }
    const n = v.checks.local.length + v.checks.claude.length;
    onStep(
      i,
      "done",
      i === 0
        ? [v.company, v.position].filter(Boolean).join(", ")
        : i === 2
          ? n
            ? `${n} notes to review`
            : "no notes"
          : undefined,
    );
  }
  return v;
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="cv-steps" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} data-state={s.state}>
          <span aria-hidden="true">
            {s.state === "done" ? (
              "✓"
            ) : s.state === "run" ? (
              <span className="spinner" />
            ) : s.state === "err" ? (
              "✕"
            ) : (
              "○"
            )}
          </span>
          <span>
            {s.label}
            {s.detail ? <span className="muted"> — {s.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function NewCv({
  baseSummary,
  aiReady,
}: {
  baseSummary: { roles: number; confirmed: number; pending: number } | null;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [offerId, setOfferId] = useState<string | null>(null);
  const [offerLabel, setOfferLabel] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("offer");
    if (!id) return;
    apiFetch<{ offer: { id: string; link: string; text: string; title: string; company: string } | null }>(
      `/api/cv/offer?id=${encodeURIComponent(id)}`,
    )
      .then(({ offer }) => {
        if (!offer) return;
        setOfferId(offer.id);
        setOfferLabel(`${offer.title} · ${offer.company}`);
        setText(offer.text);
        setLink(offer.link);
      })
      .catch(() => undefined);
  }, []);

  async function generate() {
    setError(null);
    const t = text.trim();
    if (/^https?:\/\/\S+$/i.test(t) || t.length < 200) {
      setError(
        "Paste the full posting: duties and requirements. A link or a title alone is not enough for an honest analysis.",
      );
      return;
    }
    const s: Step[] = PIPELINE.map((p) => ({ label: p.label, state: "todo" }));
    setSteps(s);
    ctl.current = new AbortController();
    try {
      const { id } = await apiFetch<{ id: string }>("/api/cv/versions", {
        body: { offerText: t, link: link.trim() || null, offerId },
      });
      const v = await runPipeline(
        id,
        0,
        (i, state, detail) =>
          setSteps((x) => x?.map((st, k) => (k === i ? { ...st, state, detail } : st)) ?? x),
        ctl.current.signal,
      );
      if (v && v.stage !== "failed") router.push(`/cv/${id}`);
      else if (v) setError(v.error ?? "The posting could not be analyzed.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      ctl.current = null;
    }
  }
  const busy = steps?.some((s) => s.state === "run") ?? false;

  return (
    <div className="cv-new">
      <section className="card card-pad stack">
        <h2 className="section-title" style={{ margin: 0 }}>
          Job posting
        </h2>
        {offerLabel ? (
          <p className="small secondary" style={{ margin: 0 }}>
            From your offers: <strong>{offerLabel}</strong>. Collected ads are often shortened, so paste the
            full text from the ad if it is longer.
          </p>
        ) : null}
        <label className="field">
          <span className="field-label">Link to the ad (kept with the version)</span>
          <input
            className="input"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="field">
          <span className="field-label">Full text of the posting</span>
          <textarea
            className="textarea"
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the whole posting: duties, requirements, nice-to-haves, about the company."
          />
        </label>
        {error ? (
          <Callout tone="bad">
            <span>{error}</span>
          </Callout>
        ) : null}
        {!aiReady ? (
          <Callout tone="info">
            <span>Claude is not set up yet. Add ANTHROPIC_API_KEY in Vercel to write CVs.</span>
          </Callout>
        ) : null}
        <div className="btn-group">
          <button
            type="button"
            className="btn btn-primary"
            onClick={generate}
            disabled={busy || !aiReady || !baseSummary}
          >
            <Sparkles size={14} /> Write the CV
          </button>
          {busy ? (
            <button type="button" className="btn btn-quiet" onClick={() => ctl.current?.abort()}>
              <Square size={13} /> Stop
            </button>
          ) : null}
        </div>
        {steps ? <StepList steps={steps} /> : null}
      </section>

      <aside className="card card-pad stack">
        <h2 className="section-title" style={{ margin: 0 }}>
          How it works
        </h2>
        <ol className="small cv-how">
          <li>
            Claude reads the posting: tasks, must-haves and nice-to-haves, seniority, the employer's
            vocabulary.
          </li>
          <li>
            It compares them with the confirmed facts in your base: strong matches, transferable skills, gaps.
          </li>
          <li>
            It writes the CV in the posting's language. Every line cites the facts it rests on. Employers,
            titles and dates come straight from your base.
          </li>
          <li>
            A separate fact-check reads every line against its sources and numbers. Doubtful lines are
            highlighted.
          </li>
          <li>The version is saved. Edit it, copy it, or download it as Word or PDF.</li>
        </ol>
        <p className="xsmall muted" style={{ margin: 0 }}>
          Facts marked as an interpretation or “to confirm” never reach a CV.
        </p>
        {baseSummary ? (
          <Callout tone="info">
            <span>
              Your base: {baseSummary.roles} roles, {baseSummary.confirmed} confirmed facts
              {baseSummary.pending ? `, ${baseSummary.pending} waiting for your confirmation` : ""}.
            </span>
          </Callout>
        ) : (
          <Callout>
            <span>
              Your experience base is empty. <Link href="/cv/base">Import it</Link> first: a JSON export from
              the Kreator works as it is.
            </span>
          </Callout>
        )}
      </aside>
    </div>
  );
}
