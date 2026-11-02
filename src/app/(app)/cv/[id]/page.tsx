import { notFound } from "next/navigation";
import { VersionEditor } from "@/components/cv/version-editor";
import { getVersion } from "@/server/cv/service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return getVersion(id).catch(() => null);
}

export async function generateMetadata({ params }: Props) {
  const v = await load((await params).id);
  return { title: v ? `CV · ${v.position}` : "CV" };
}

export default async function CvVersionPage({ params }: Props) {
  const v = await load((await params).id);
  if (!v) notFound();
  return (
    <div className="page">
      <VersionEditor initial={v} />
    </div>
  );
}
