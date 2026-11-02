import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Advisor } from "@/components/grow/advisor";
import { FollowButton, PathNotes } from "@/components/grow/path-actions";
import { ScoreRing } from "@/components/offers/bits";
import { type PathLink, pathBySlug } from "@/lib/grow/paths";
import { FIELD_LABEL } from "@/lib/jobs/tracks";
import { aiConfigured } from "@/server/ai/client";
import { offersForPath } from "@/server/grow";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<PathLink["kind"], string> = {
  course: "Course",
  guide: "Guide",
  community: "Community",
  law: "Law",
  pay: "Pay",
  book: "Book",
  tool: "Tool",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = pathBySlug((await params).slug);
  return { title: p ? p.title : "Grow" };
}

export default async function PathPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = pathBySlug(slug);
  if (!p) notFound();
  const grow = await getSettings("grow");
  const offers = await offersForPath(p);
  const screenOf = (track: string) => (track === "core" || track === "beyond" ? "matches" : "explore");
  return (
    <div className="page">
      <Link href="/grow" className="small back-link">
        <ArrowLeft size={13} /> All paths
      </Link>
      <header className="page-header">
        <div>
          <h1>{p.title}</h1>
          <p>{p.tagline}</p>
        </div>
        <FollowButton slug={p.slug} followed={grow.followed.includes(p.slug)} />
      </header>

      <div className="grow-layout">
        <div className="stack-lg">
          <section className="card card-pad stack">
            <h3>Why it may suit you</h3>
            <ul className="fit-list fit-good">
              {p.whyYou.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <h3>What the work is</h3>
            <p className="secondary">{p.theWork}</p>
            <h3>Pay</h3>
            <p className="secondary">{p.pay}</p>
            <h3>What you would need</h3>
            <ul className="fit-list fit-warn">
              {p.gaps.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>

          <section className="card card-pad stack">
            <h3>A way in: 30, 60, 90 days</h3>
            <div className="plan-grid">
              {(
                [
                  ["First 30 days", p.plan.days30],
                  ["By day 60", p.plan.days60],
                  ["By day 90", p.plan.days90],
                ] as const
              ).map(([label, steps]) => (
                <div key={label} className="plan-col">
                  <strong>{label}</strong>
                  <ol>
                    {steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad stack">
            <h3>Links</h3>
            <ul className="link-list path-links">
              {p.links.map((l) => (
                <li key={l.url}>
                  <span className="tag">{KIND_LABEL[l.kind]}</span>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.title} <ExternalLink size={11} />
                  </a>
                </li>
              ))}
            </ul>
            <p className="xsmall muted" style={{ margin: 0 }}>
              Checked on 2 November 2026. Laws and pay change: confirm anything important at the source.
            </p>
          </section>

          <section className="card card-pad stack">
            <div className="row-between">
              <h3>Open roles on this path</h3>
              {p.field ? (
                <Link href="/explore?view=all" className="small">
                  All in Explore
                </Link>
              ) : null}
            </div>
            {offers.length ? (
              <ul className="list">
                {offers.map((o) => (
                  <li key={o.id}>
                    <Link href={`/${screenOf(o.track)}?o=${o.id}`} className="list-row">
                      <ScoreRing score={o.score} size={38} byClaude={o.scoredByClaude} />
                      <span className="list-row-main">
                        <strong>{o.title}</strong>
                        <span className="small muted">
                          {o.companyName}
                          {o.location ? ` · ${o.location}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                No open roles found yet{p.field ? ` in ${FIELD_LABEL[p.field].toLowerCase()}` : ""}. New ones
                appear after each morning refresh.
              </p>
            )}
          </section>

          <section className="card card-pad">
            <PathNotes slug={p.slug} initial={grow.notes[p.slug] ?? ""} />
          </section>
        </div>
        <Advisor
          thread={p.slug}
          aiConfigured={aiConfigured()}
          suggestions={[
            "What would my first year look like, honestly?",
            "Which parts of my CV should I lead with?",
            "Who in Warsaw should I talk to first?",
            "What is the cheapest way to test this before switching?",
          ]}
        />
      </div>
    </div>
  );
}
