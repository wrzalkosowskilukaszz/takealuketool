import { CvNav } from "@/components/cv/cv-nav";
import { NewCv } from "@/components/cv/new-cv";
import { allFacts } from "@/lib/cv/base";
import { aiConfigured } from "@/server/ai/client";
import { getBase } from "@/server/cv/service";
import { getSettings } from "@/server/settings";

export const metadata = { title: "CV" };
export const dynamic = "force-dynamic";

export default async function CvPage() {
  const base = await getBase();
  const career = await getSettings("career");
  const facts = allFacts(base);
  const confirmed = facts.filter((f) => f.status === "confirmed").length;
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>CV</h1>
          <p>
            A CV written for one posting, only from facts you have confirmed. Every line cites its sources and
            is fact-checked before you see it.
          </p>
        </div>
      </header>
      <CvNav />
      <NewCv
        aiReady={aiConfigured()}
        uploadedCv={career.cvText.trim() ? (career.cvFilename ?? "your CV") : null}
        baseSummary={base ? { roles: base.roles.length, confirmed, pending: facts.length - confirmed } : null}
      />
    </div>
  );
}
