import { CvNav } from "@/components/cv/cv-nav";
import { VersionsList } from "@/components/cv/versions-list";
import { listVersions } from "@/server/cv/service";

export const metadata = { title: "CV versions" };
export const dynamic = "force-dynamic";

export default async function CvVersionsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>CV</h1>
          <p>Every CV you have written, newest first. Open one to edit, check or download it.</p>
        </div>
      </header>
      <CvNav />
      <VersionsList initial={await listVersions()} />
    </div>
  );
}
