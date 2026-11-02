import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { Advisor } from "@/components/grow/advisor";
import { FollowButton } from "@/components/grow/path-actions";
import { PATHS } from "@/lib/grow/paths";
import { FIELD_LABEL } from "@/lib/jobs/tracks";
import { aiConfigured } from "@/server/ai/client";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Grow" };
export const dynamic = "force-dynamic";

export default async function GrowPage() {
  const grow = await getSettings("grow");
  const followed = new Set(grow.followed);
  const ordered = [...PATHS].sort((a, b) => Number(followed.has(b.slug)) - Number(followed.has(a.slug)));
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Grow</h1>
          <p>
            Careers beyond day-to-day design where your creative, AI and presenting skills still pay off. Each
            path says why it may suit you, what the work is really like, what you would need to learn, and a
            30/60/90-day way in. Ask the advisor anything along the way.
          </p>
        </div>
      </header>
      <div className="grow-layout">
        <section className="path-grid" aria-label="Career paths">
          {ordered.map((p) => (
            <Link key={p.slug} href={`/grow/${p.slug}`} className="path-card">
              <div className="row-between" style={{ alignItems: "flex-start", gap: 8 }}>
                <h3>{p.title}</h3>
                <FollowButton slug={p.slug} followed={followed.has(p.slug)} />
              </div>
              <p className="small secondary">{p.tagline}</p>
              <p className="small" style={{ margin: 0 }}>
                {p.whyYou[0]}
              </p>
              <div className="row-between">
                <span className="row wrap" style={{ gap: 6 }}>
                  {p.field ? <span className="tag">{FIELD_LABEL[p.field]}</span> : null}
                  {followed.has(p.slug) ? (
                    <span className="tag tag-accent">
                      <Star size={11} /> Following
                    </span>
                  ) : null}
                  {grow.notes[p.slug] ? <span className="tag">Your notes</span> : null}
                </span>
                <span className="small accent-link">
                  Open <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </section>
        <Advisor
          thread="general"
          aiConfigured={aiConfigured()}
          suggestions={[
            "Which of these paths suits me best, and why?",
            "How do I test sales without quitting design?",
            "What could I earn in my first year in real estate in Warsaw?",
            "How do I describe this career change on LinkedIn?",
          ]}
        />
      </div>
    </div>
  );
}
