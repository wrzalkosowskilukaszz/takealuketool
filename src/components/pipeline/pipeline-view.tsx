"use client";

import { AlarmClock, ChevronLeft, ChevronRight, FileText, KanbanSquare, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CompanyMark, ScoreRing, TrackTag } from "@/components/offers/bits";
import { OfferPanel } from "@/components/offers/offer-panel";
import { useToast } from "@/components/toast";
import { Callout, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { type JobStatus, STATUS_LABEL } from "@/lib/jobs/types";
import { formatWarsaw } from "@/lib/time";
import type { JobRow, Pipeline } from "@/server/careers/service";

const COLUMNS: JobStatus[] = ["saved", "applied", "interview", "offer", "rejected"];
const HINT: Record<string, string> = {
  saved: "Shortlisted. Draft a letter, tailor the CV, then apply.",
  applied: "Sent. A follow-up date is set a week out.",
  interview: "Talking to them.",
  offer: "They want you.",
  rejected: "Closed. Kept for the record.",
};

export function PipelineView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Pipeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get("o"));

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Pipeline>("/api/pipeline"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the pipeline");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function open(id: string | null) {
    setOpenId(id);
    router.replace(id ? `/pipeline?o=${id}` : "/pipeline", { scroll: false });
  }
  async function move(r: JobRow, dir: -1 | 1) {
    const i = COLUMNS.indexOf(r.status as JobStatus);
    const next = COLUMNS[i + dir];
    if (!next) return;
    try {
      await apiFetch(`/api/jobs/${r.id}`, { method: "PATCH", body: { status: next } });
      toast(`${r.title}: ${STATUS_LABEL[next]}`);
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not moved", "error");
    }
  }

  if (error) return <Callout tone="bad">{error}</Callout>;
  if (!data)
    return (
      <div className="kanban">
        {COLUMNS.map((c) => (
          <div key={c} className="kanban-col">
            <span className="skeleton" style={{ width: "60%" }} />
          </div>
        ))}
      </div>
    );

  const now = Date.now();
  const due = data.rows.filter(
    (r) =>
      (r.status === "applied" || r.status === "interview") && r.followUpAt && Date.parse(r.followUpAt) <= now,
  );
  if (!data.rows.length)
    return (
      <div className="card">
        <Empty icon={<KanbanSquare size={22} />} title="Nothing in the pipeline yet">
          Save offers from Matches or Explore and they show up here. Mark them as applied, interview or offer
          as things move.
        </Empty>
      </div>
    );

  return (
    <div className="stack-lg">
      {due.length ? (
        <Callout>
          <strong>
            <AlarmClock size={14} /> Time to follow up
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {due.map((r) => (
              <li key={r.id}>
                <button type="button" className="link-button" onClick={() => open(r.id)}>
                  {r.title} · {r.companyName}
                </button>{" "}
                <span className="muted small">
                  applied {r.appliedAt ? formatWarsaw(r.appliedAt, "d LLL") : ""}, no news since
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <div className="kanban">
        {COLUMNS.map((col) => {
          const rows = data.rows.filter((r) => r.status === col);
          return (
            <section key={col} className="kanban-col" aria-label={STATUS_LABEL[col]}>
              <header className="kanban-head">
                <strong>{STATUS_LABEL[col]}</strong>
                <span className="views-count">{rows.length}</span>
              </header>
              <p className="xsmall muted" style={{ margin: 0 }}>
                {HINT[col]}
              </p>
              {rows.map((r) => {
                const late =
                  r.followUpAt &&
                  Date.parse(r.followUpAt) <= now &&
                  (col === "applied" || col === "interview");
                return (
                  <article key={r.id} className={`kanban-card${openId === r.id ? " is-active" : ""}`}>
                    <button type="button" className="kanban-card-main" onClick={() => open(r.id)}>
                      <span className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                        <CompanyMark name={r.companyName} />
                        <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                          <span className="job-title">{r.title}</span>
                          <span className="job-meta">{r.companyName}</span>
                        </span>
                        <ScoreRing score={r.score} size={40} byClaude={Boolean(r.ai)} />
                      </span>
                      <span className="row wrap" style={{ gap: 6 }}>
                        <TrackTag track={r.track} />
                        {r.hasLetter ? (
                          <span className="tag" title="Cover letter drafted">
                            <Mail size={11} /> Letter
                          </span>
                        ) : null}
                        {late ? (
                          <span className="tag tag-warn">
                            <AlarmClock size={11} /> Follow up
                          </span>
                        ) : r.followUpAt && (col === "applied" || col === "interview") ? (
                          <span className="tag">Follow up {formatWarsaw(r.followUpAt, "d LLL")}</span>
                        ) : null}
                      </span>
                    </button>
                    <div className="kanban-moves">
                      <button
                        type="button"
                        className="btn btn-quiet btn-icon btn-sm"
                        aria-label="Move back"
                        disabled={col === COLUMNS[0]}
                        onClick={() => move(r, -1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="xsmall muted">
                        {r.statusAt ? formatWarsaw(r.statusAt, "d LLL") : ""}
                        {r.closedAt ? " · ad closed" : ""}
                      </span>
                      <button
                        type="button"
                        className="btn btn-quiet btn-icon btn-sm"
                        aria-label="Move forward"
                        disabled={col === COLUMNS[COLUMNS.length - 1]}
                        onClick={() => move(r, 1)}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="xsmall muted">
        <FileText size={12} /> Open a card to draft its cover letter, tailor the CV, set a follow-up date or
        add notes.
      </p>
      {openId ? <OfferPanel id={openId} onClose={() => open(null)} onChanged={load} /> : null}
    </div>
  );
}
