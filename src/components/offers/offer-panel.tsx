"use client";

import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  EyeOff,
  FileText,
  Heart,
  Mail,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { REGION_LABEL, type Region } from "@/lib/jobs/match";
import {
  FIELD_LABEL,
  FIGMA_LABEL,
  type FigmaShare,
  PIVOT_LABEL,
  type Pivot,
  TRACK_HINT,
} from "@/lib/jobs/tracks";
import { type ExploreField, type JobStatus, STATUS_LABEL, type Track } from "@/lib/jobs/types";
import { formatWarsaw } from "@/lib/time";
import type { JobDetail } from "@/server/careers/service";
import { FigmaTag, PivotTag, ScoreRing, TrackTag } from "./bits";
import { LetterDialog } from "./letter-dialog";
import { TailorDialog } from "./tailor-dialog";

const FLOW: JobStatus[] = ["saved", "applied", "interview", "offer", "rejected"];
const WORKPLACE: Record<string, string> = { remote: "remote", hybrid: "hybrid", onsite: "on-site" };

export function OfferPanel({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<JobDetail | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"saved" | "pending">("saved");
  const [full, setFull] = useState(false);
  const [tailor, setTailor] = useState(false);
  const [letter, setLetter] = useState(false);
  const [scoring, setScoring] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef("");

  const saveNote = useCallback(async () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = null;
    await apiFetch(`/api/jobs/${id}`, { method: "PATCH", body: { note: noteRef.current } }).catch(() =>
      toast("The note was not saved", "error"),
    );
    setNoteState("saved");
  }, [id, toast]);
  useEffect(
    () => () => {
      if (noteTimer.current) void saveNote();
    },
    [saveNote],
  );

  const load = useCallback(async () => {
    const x = await apiFetch<JobDetail>(`/api/jobs/${id}`);
    setD(x);
    setNote(x.note ?? "");
    noteRef.current = x.note ?? "";
  }, [id]);
  useEffect(() => {
    setD(null);
    setFull(false);
    setTailor(false);
    setLetter(false);
    void load().catch(() => toast("Could not load the offer", "error"));
  }, [load, toast]);

  const savedTailored = useCallback(
    (at: string | null) => setD((x) => (x ? { ...x, tailoredCvAt: at } : x)),
    [],
  );
  const savedLetter = useCallback(
    (at: string | null) => {
      setD((x) => (x ? { ...x, coverLetterAt: at } : x));
      onChanged();
    },
    [onChanged],
  );

  async function patch(body: Record<string, unknown>, msg?: string) {
    try {
      await apiFetch(`/api/jobs/${id}`, { method: "PATCH", body });
      if (msg) toast(msg);
      await load();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not saved", "error");
    }
  }
  async function favourite() {
    if (!d?.company) return;
    await apiFetch(`/api/companies/${d.company.id}`, {
      method: "PATCH",
      body: { favourite: !d.company.favourite },
    });
    toast(d.company.favourite ? "Removed from favourites" : "Favourite company: all its offers will show up");
    await load();
    onChanged();
  }
  async function scoreNow() {
    setScoring(true);
    try {
      await apiFetch(`/api/jobs/${id}/score`, { body: {} });
      await load();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Claude could not score this offer", "error");
    } finally {
      setScoring(false);
    }
  }

  // Refresh the letter text when its dialog closes (Claude may have drafted a new one).
  const [letterText, setLetterText] = useState<string | null>(null);
  useEffect(() => {
    if (d) setLetterText(d.coverLetter);
  }, [d]);

  const desc = d?.description ?? "";
  const ai = d?.ai ?? null;
  return (
    <aside className="panel" aria-label="Job offer" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="panel-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {d ? (
            <>
              <div className="panel-title">{d.title}</div>
              <div className="secondary small" style={{ marginTop: 4 }}>
                {d.companyName}
                {d.location ? ` · ${d.location}` : ""}
              </div>
            </>
          ) : (
            <span className="skeleton" style={{ width: 220, height: 16 }} />
          )}
        </div>
        <button
          type="button"
          className="btn btn-quiet btn-icon btn-sm"
          onClick={onClose}
          aria-label="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        {!d ? (
          <div className="stack">
            {[80, 60, 90].map((w) => (
              <span key={w} className="skeleton" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <div className="stack-lg">
            <section className="fit-card">
              <div className="job-match">
                <ScoreRing score={d.score} size={72} byClaude={Boolean(ai)} />
                <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <strong>{ai ? "Claude's read on the fit" : "Rule-based match"}</strong>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <TrackTag track={d.track} />
                    <PivotTag pivot={d.pivot} />
                    <FigmaTag share={d.figmaShare} />
                  </div>
                </div>
              </div>
              {ai ? (
                <div className="stack" style={{ gap: 10 }}>
                  <p style={{ margin: 0 }}>{ai.summary}</p>
                  {ai.why.length ? (
                    <div>
                      <span className="xsmall muted">Why it fits</span>
                      <ul className="fit-list fit-good">
                        {ai.why.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {ai.gaps.length ? (
                    <div>
                      <span className="xsmall muted">Gaps and risks</span>
                      <ul className="fit-list fit-warn">
                        {ai.gaps.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {ai.angle ? (
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Angle for your application:</strong> {ai.angle}
                    </p>
                  ) : null}
                  <span className="xsmall muted">
                    Rule score {d.ruleScore}
                    {d.aiScoredAt ? ` · read by Claude ${formatWarsaw(d.aiScoredAt, "d LLL, HH:mm")}` : ""}
                  </span>
                </div>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="job-reasons">
                    {d.match.reasons.map((x) => (
                      <span key={x.text} className={`reason reason-${x.tone}`}>
                        {x.text}
                      </span>
                    ))}
                  </div>
                  {d.aiError ? (
                    <span className="xsmall text-warn">Claude could not read it last time: {d.aiError}</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={scoreNow}
                    disabled={scoring}
                  >
                    {scoring ? <span className="spinner" /> : <Sparkles size={13} />} Ask Claude how well it
                    fits
                  </button>
                </div>
              )}
              {d.pivot !== "none" ? (
                <Callout tone="info">
                  <span>
                    <strong>{PIVOT_LABEL[d.pivot as Pivot]}.</strong>{" "}
                    {d.track === "new_field" || d.track === "adjacent"
                      ? `This is ${d.field ? FIELD_LABEL[d.field as ExploreField].toLowerCase() : "another field"}, not design work. `
                      : ""}
                    {FIGMA_LABEL[d.figmaShare as FigmaShare]}. {TRACK_HINT[d.track as Track]}.
                  </span>
                </Callout>
              ) : null}
            </section>

            <div className="btn-group">
              <a className="btn btn-primary" href={d.url} target="_blank" rel="noopener noreferrer">
                Open the ad <ExternalLink size={14} />
              </a>
              <button type="button" className="btn" onClick={() => setLetter(true)}>
                <Mail size={14} /> {d.coverLetterAt ? "Cover letter" : "Draft cover letter"}
              </button>
              <button type="button" className="btn" onClick={() => setTailor(true)}>
                <FileText size={14} /> {d.tailoredCvAt ? "Tailored CV" : "Tailor CV"}
              </button>
              {d.status === "saved" ? (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => patch({ status: "new" }, "Removed from saved")}
                >
                  <BookmarkCheck size={14} /> Saved
                </button>
              ) : d.status === "new" ? (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => patch({ status: "saved" }, "Saved")}
                >
                  <Bookmark size={14} /> Save
                </button>
              ) : null}
            </div>

            <section className="stack" style={{ gap: 8 }}>
              <h4 className="section-title" style={{ margin: 0 }}>
                Where you are with it
              </h4>
              <div className="status-steps" role="toolbar" aria-label="Status">
                {FLOW.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={d.status === s}
                    onClick={() => patch({ status: s }, `Marked: ${STATUS_LABEL[s]}`)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {d.status === "applied" || d.status === "interview" ? (
                <label className="row wrap small" style={{ gap: 8 }}>
                  Follow up on
                  <input
                    type="date"
                    className="input input-sm"
                    style={{ width: 160 }}
                    value={d.followUpAt ? d.followUpAt.slice(0, 10) : ""}
                    onChange={(e) =>
                      patch({
                        followUpAt: e.target.value
                          ? new Date(`${e.target.value}T09:00:00`).toISOString()
                          : null,
                      })
                    }
                  />
                  {d.appliedAt ? (
                    <span className="muted">Applied {formatWarsaw(d.appliedAt, "d LLL")}</span>
                  ) : null}
                </label>
              ) : null}
            </section>

            <dl className="kv">
              <dt>Company</dt>
              <dd>
                {d.companyName}{" "}
                {d.company ? (
                  <button type="button" className="link-button small" onClick={favourite}>
                    <Heart size={12} className={d.company.favourite ? "heart-on" : ""} />{" "}
                    {d.company.favourite ? "Favourite" : "Add to favourites"}
                  </button>
                ) : null}
              </dd>
              <dt>Place</dt>
              <dd>
                {d.location ?? REGION_LABEL[d.match.region as Region] ?? "Not stated"}
                {WORKPLACE[d.workplace] ? ` · ${WORKPLACE[d.workplace]}` : ""}
              </dd>
              {d.salary ? (
                <>
                  <dt>Pay</dt>
                  <dd>{d.salary}</dd>
                </>
              ) : null}
              {d.employmentType ? (
                <>
                  <dt>Type</dt>
                  <dd>{d.employmentType}</dd>
                </>
              ) : null}
              <dt>Dates</dt>
              <dd>
                {d.postedAt ? `posted ${formatWarsaw(d.postedAt, "d LLL yyyy")} · ` : ""}found{" "}
                {formatWarsaw(d.firstSeenAt, "d LLL yyyy")}
                {d.closedAt ? " · no longer listed" : ""}
              </dd>
              <dt>Source</dt>
              <dd>
                {d.sourceUrl ? (
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {d.source}
                  </a>
                ) : (
                  d.source
                )}
              </dd>
            </dl>

            {d.gap && (d.gap.missing.length || d.gap.inCv.length) ? (
              <section className="stack" style={{ gap: 6 }}>
                <h4 className="section-title" style={{ margin: 0 }}>
                  Keywords against your CV
                </h4>
                <div className="job-reasons">
                  {d.gap.inCv.map((w) => (
                    <span key={w} className="reason reason-good">
                      {w}
                    </span>
                  ))}
                  {d.gap.missing.map((w) => (
                    <span key={w} className="reason reason-warn">
                      {w}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="stack" style={{ gap: 8 }}>
              <h4 className="section-title" style={{ margin: 0 }}>
                The ad
              </h4>
              {desc ? (
                <>
                  <div className={`job-description${full ? "" : " is-clipped"}`}>{desc}</div>
                  {desc.length > 900 ? (
                    <button type="button" className="link-button small" onClick={() => setFull((x) => !x)}>
                      {full ? "Show less" : "Show all"}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="small muted">The source gives no description. Open the ad to read it.</p>
              )}
            </section>

            <section className="stack" style={{ gap: 8 }}>
              <h4 className="section-title" style={{ margin: 0 }}>
                Your note
                <span className="xsmall muted" aria-live="polite" style={{ fontWeight: 400 }}>
                  {noteState === "pending" ? "Saving…" : note ? "Saved" : ""}
                </span>
              </h4>
              <textarea
                className="textarea"
                rows={3}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  noteRef.current = e.target.value;
                  setNoteState("pending");
                  if (noteTimer.current) clearTimeout(noteTimer.current);
                  noteTimer.current = setTimeout(() => void saveNote(), 700);
                }}
                placeholder="e.g. recruiter call on the 20th, salary range, who referred you…"
              />
            </section>

            <div className="btn-group">
              {d.status === "dismissed" ? (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => patch({ status: "new" }, "Back on the list")}
                >
                  <RotateCcw size={13} /> Bring it back
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={async () => {
                    await patch({ status: "dismissed" }, "Hidden");
                    onClose();
                  }}
                >
                  <EyeOff size={13} /> Not for me
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {d ? (
        <>
          <TailorDialog
            id={id}
            title={d.title}
            company={d.companyName}
            open={tailor}
            onClose={() => setTailor(false)}
            onSaved={savedTailored}
          />
          <LetterDialog
            id={id}
            title={d.title}
            company={d.companyName}
            initial={letterText}
            initialLang={d.coverLetterLang}
            adLanguage={d.adLanguage}
            open={letter}
            onClose={() => {
              setLetter(false);
              void load();
            }}
            onSaved={savedLetter}
          />
        </>
      ) : null}
    </aside>
  );
}
