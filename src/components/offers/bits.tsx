/** Small pieces shared by Matches, Explore and Pipeline. */
import { Sparkles } from "lucide-react";
import { FIGMA_LABEL, type FigmaShare, PIVOT_LABEL, type Pivot, TRACK_LABEL } from "@/lib/jobs/tracks";
import { type JobStatus, STATUS_LABEL, type Track } from "@/lib/jobs/types";
import { formatWarsaw } from "@/lib/time";

export function ago(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatWarsaw(iso, "d LLL yyyy");
}

export function ScoreRing({
  score,
  size = 54,
  byClaude,
}: {
  score: number;
  size?: number;
  byClaude?: boolean;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? "#17b67d" : score >= 55 ? "#3b9eff" : "#a3a9b4";
  return (
    <span
      className="score-ring"
      style={{ width: size, height: size }}
      title={`${byClaude ? "Claude's fit score" : "Rule-based score"}: ${score}`}
    >
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r={r} fill="none" stroke="#eef1f5" strokeWidth="5" />
        <circle
          cx="27"
          cy="27"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          transform="rotate(-90 27 27)"
        />
      </svg>
      <span>{score}</span>
      {byClaude ? (
        <span className="score-ai" role="img" aria-label="Scored by Claude">
          <Sparkles size={10} strokeWidth={2.2} />
        </span>
      ) : null}
    </span>
  );
}

export function CompanyMark({ name }: { name: string }) {
  const hues = [152, 200, 260, 330, 30, 175];
  const h = hues[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className="company-mark"
      style={{ background: `hsl(${h} 70% 95%)`, color: `hsl(${h} 55% 32%)` }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function TrackTag({ track }: { track: string }) {
  return <span className={`tag tag-track tag-${track}`}>{TRACK_LABEL[track as Track] ?? track}</span>;
}

export function PivotTag({ pivot }: { pivot: string }) {
  if (pivot === "none") return null;
  return (
    <span className={`tag ${pivot === "big" ? "tag-warn" : pivot === "pivot" ? "tag-accent" : ""}`}>
      {PIVOT_LABEL[pivot as Pivot] ?? pivot}
    </span>
  );
}

export const FIGMA_SHORT: Record<FigmaShare, string> = {
  hands_on: "Hands-on Figma",
  mixed: "Design + direction",
  direction: "Mostly direction",
  none: "No Figma",
};

export function FigmaTag({ share }: { share: string }) {
  const s = share as FigmaShare;
  return (
    <span className="tag" title={FIGMA_LABEL[s]}>
      {FIGMA_SHORT[s] ?? share}
    </span>
  );
}

export function StatusTag({ status }: { status: string }) {
  if (status === "new") return null;
  const tone =
    status === "applied" || status === "interview" || status === "offer"
      ? "tag-ok"
      : status === "saved"
        ? "tag-accent"
        : status === "rejected"
          ? "tag-bad"
          : "";
  return <span className={`tag ${tone}`}>{STATUS_LABEL[status as JobStatus] ?? status}</span>;
}
