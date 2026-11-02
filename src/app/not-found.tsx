import Link from "next/link";
import { BrandLogo } from "@/components/brand";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="login">
      <div className="login-card" style={{ textAlign: "center", alignItems: "center" }}>
        <BrandLogo size={44} />
        <h1>This page does not exist</h1>
        <p className="login-lead">The link may have changed, or the item was removed.</p>
        <Link href="/matches" className="btn btn-primary btn-lg">
          Back to matches
        </Link>
      </div>
    </main>
  );
}
