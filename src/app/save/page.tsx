import { BrandLogo } from "@/components/brand";
import { SaveOffer } from "@/components/save/save-offer";
import { requireSession } from "@/server/auth/session";

export const metadata = { title: "Save to Studio" };
export const dynamic = "force-dynamic";

/** Opened by the "Save to Studio" bookmarklet with a job ad in the #fragment, or on its own to set it up. */
export default async function SavePage() {
  await requireSession("/save");
  return (
    <main className="login save-page">
      <div className="login-brand">
        <BrandLogo size={36} />
        <span>
          <span className="brand-mark" style={{ fontSize: 19 }}>
            Take a Luke
          </span>
          <span className="brand-sub">Studio</span>
        </span>
      </div>
      <div className="login-card save-card">
        <SaveOffer />
      </div>
    </main>
  );
}
