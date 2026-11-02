import { SettingsView } from "@/components/settings/settings-view";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Your CV, what to look for, Claude's limits, the morning digest and how the engine is doing.</p>
        </div>
      </header>
      <SettingsView />
    </div>
  );
}
