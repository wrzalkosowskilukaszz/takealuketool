import { BaseEditor } from "@/components/cv/base-editor";
import { CvNav } from "@/components/cv/cv-nav";
import { aiConfigured } from "@/server/ai/client";
import { getBase } from "@/server/cv/service";

export const metadata = { title: "Experience base" };
export const dynamic = "force-dynamic";

export default async function CvBasePage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>CV</h1>
          <p>Your experience as single facts. Confirm what is true; only confirmed facts are ever used.</p>
        </div>
      </header>
      <CvNav />
      <BaseEditor initial={await getBase()} aiReady={aiConfigured()} />
    </div>
  );
}
