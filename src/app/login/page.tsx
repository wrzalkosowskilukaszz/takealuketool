import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand";
import { hasValidSession, safeNext } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await hasValidSession()) redirect(next ?? "/matches");
  return (
    <main className="login">
      <div className="login-brand">
        <BrandLogo size={44} />
        <span>
          <span className="brand-mark" style={{ fontSize: 22 }}>
            Take a Luke
          </span>
          <span className="brand-sub">Studio</span>
        </span>
      </div>
      <div className="login-card">
        <div>
          <h1>Sign in</h1>
          <p className="login-lead">Your private job-search studio.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
