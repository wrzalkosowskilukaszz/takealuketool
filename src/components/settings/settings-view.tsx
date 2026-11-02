"use client";

import { FileText, Upload, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { uploadCv } from "@/components/offers/offers-view";
import { useToast } from "@/components/toast";
import { Callout } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { LANGUAGE_LABEL } from "@/lib/jobs/match";
import { FIELD_LABEL, TRACK_HINT, TRACK_LABEL } from "@/lib/jobs/tracks";
import { EXPLORE_FIELDS, type ExploreField, TRACKS, type Track } from "@/lib/jobs/types";
import { formatWarsaw } from "@/lib/time";
import type { CareerProfile } from "@/server/careers/service";
import type { SettingsOf } from "@/server/settings";
import type { AppStatus, FeedSource } from "@/server/status";

type Status = AppStatus & { sources: FeedSource[] };
type Prefs = CareerProfile["prefs"];

const LOCATIONS = {
  warsaw: "Warsaw, on-site or hybrid",
  poland_other: "Elsewhere in Poland",
  remote_poland: "Remote, open to someone in Poland",
  eu: "On-site or hybrid in the EU, EEA or Switzerland (no work permit needed)",
  world: "Outside the EU (shown with a work visa warning)",
} as const;
const WORK = {
  full_time: "Full-time",
  freelance: "Freelance / B2B contract",
  part_time: "Part-time",
} as const;
const LANGS = ["en", "pl", "de", "fr", "es"];

const words = (s: string) =>
  s
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card card-pad stack settings-section">
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          {title}
        </h2>
        {lead ? (
          <p className="small secondary" style={{ margin: "4px 0 0" }}>
            {lead}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        apiFetch<Status>("/api/status"),
        apiFetch<CareerProfile>("/api/jobs/prefs"),
      ]);
      setStatus(s);
      setProfile(p);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load settings");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Callout tone="bad">{error}</Callout>;
  if (!status || !profile)
    return (
      <div className="card card-pad">
        <span className="skeleton" style={{ width: "50%" }} />
      </div>
    );

  return (
    <div className="settings-layout">
      <nav className="settings-toc" aria-label="Settings sections">
        {[
          ["cv", "CV"],
          ["search", "What I look for"],
          ["claude", "Claude and spend"],
          ["digest", "Morning digest"],
          ["schedule", "Daily refresh"],
          ["profile", "About you"],
          ["health", "Health"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <div className="stack-lg" style={{ minWidth: 0 }}>
        <CvSection profile={profile} onChanged={load} />
        <SearchSection prefs={profile.prefs} onSaved={load} />
        <ClaudeSection status={status} />
        <SettingsForm<"digest">
          id="digest"
          title="Morning digest"
          lead={
            <>
              Every morning a short list of the best new offers is posted to your project thread.{" "}
              {status.integrations.digest
                ? "The digest link is set up (DIGEST_TOKEN)."
                : "Set DIGEST_TOKEN on the server to switch it on."}
            </>
          }
          settingsKey="digest"
          render={(v, set) => (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={v.enabled}
                  onChange={(e) => set({ ...v, enabled: e.target.checked })}
                />
                Post the digest
              </label>
              <div className="field-row">
                <NumberField
                  label="Lowest score to include"
                  value={v.minScore}
                  min={0}
                  max={100}
                  onChange={(n) => set({ ...v, minScore: n })}
                />
                <NumberField
                  label="Matches at most"
                  value={v.maxMatches}
                  min={1}
                  max={20}
                  onChange={(n) => set({ ...v, maxMatches: n })}
                />
                <NumberField
                  label="Explore roles at most"
                  value={v.maxExplore}
                  min={0}
                  max={20}
                  onChange={(n) => set({ ...v, maxExplore: n })}
                />
              </div>
            </>
          )}
          toast={toast}
        />
        <SettingsForm<"scheduler">
          id="schedule"
          title="Daily refresh"
          lead="Once a day every job board is read again, so the morning digest is fresh. Company pages and Claude's scoring run through the day as well."
          settingsKey="scheduler"
          render={(v, set) => (
            <div className="field-row">
              <label className="check-row">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={v.enabled}
                  onChange={(e) => set({ ...v, enabled: e.target.checked })}
                />
                Refresh every day
              </label>
              <label className="field">
                <span className="field-label">At (Warsaw time)</span>
                <input
                  type="time"
                  className="input"
                  value={v.localTime}
                  onChange={(e) => set({ ...v, localTime: e.target.value })}
                />
              </label>
            </div>
          )}
          toast={toast}
        />
        <SettingsForm<"profile">
          id="profile"
          title="About you"
          lead="Used in cover letters."
          settingsKey="profile"
          render={(v, set) => (
            <>
              <div className="field-row">
                <TextField label="Name" value={v.name} onChange={(t) => set({ ...v, name: t })} />
                <TextField label="Headline" value={v.headline} onChange={(t) => set({ ...v, headline: t })} />
              </div>
              <div className="field-row">
                <TextField label="Email" value={v.email} onChange={(t) => set({ ...v, email: t })} />
                <TextField label="Phone" value={v.phone} onChange={(t) => set({ ...v, phone: t })} />
                <TextField label="City" value={v.city} onChange={(t) => set({ ...v, city: t })} />
              </div>
              <div className="field-row">
                <TextField label="Website" value={v.website} onChange={(t) => set({ ...v, website: t })} />
                <TextField label="LinkedIn" value={v.linkedin} onChange={(t) => set({ ...v, linkedin: t })} />
              </div>
              <TextField
                label="Your voice in letters"
                value={v.voice}
                onChange={(t) => set({ ...v, voice: t })}
              />
              <TextField label="Sign-off" value={v.signOff} onChange={(t) => set({ ...v, signOff: t })} />
            </>
          )}
          toast={toast}
        />
        <HealthSection status={status} />
      </div>
    </div>
  );
}

function CvSection({ profile, onChanged }: { profile: CareerProfile; onChanged: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [kw, setKw] = useState(profile.prefs.cvKeywords);
  useEffect(() => setKw(profile.prefs.cvKeywords), [profile]);
  return (
    <Section
      id="cv"
      title="Your CV"
      lead="Everything starts from it: rule scores, Claude's fit notes, cover letters and tailored CVs. Only the text is kept, in your private database."
    >
      {profile.cv.filename ? (
        <div className="row wrap" style={{ gap: 10 }}>
          <span className="small">
            <FileText size={13} /> {profile.cv.filename} · {profile.cv.words} words · uploaded{" "}
            {formatWarsaw(profile.cv.uploadedAt, "d LLL yyyy")}
          </span>
          <button type="button" className="link-button small" onClick={() => input.current?.click()}>
            Upload a new one
          </button>
          <button
            type="button"
            className="link-button small"
            onClick={async () => {
              if (!window.confirm("Remove the CV text from the app?")) return;
              await apiFetch("/api/jobs/cv", { method: "DELETE" });
              toast("CV removed");
              onChanged();
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          style={{ alignSelf: "flex-start" }}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? <span className="spinner" /> : <Upload size={14} />} Upload CV (PDF, DOCX, TXT)
        </button>
      )}
      {kw.length ? (
        <div className="stack" style={{ gap: 6 }}>
          <span className="field-label">Skills found in your CV (they raise offers that mention them)</span>
          <div className="filter-chips">
            {kw.map((w) => (
              <span key={w} className="chip">
                {w}
                <button
                  type="button"
                  aria-label={`Remove ${w}`}
                  onClick={async () => {
                    const next = kw.filter((x) => x !== w);
                    setKw(next);
                    await apiFetch("/api/jobs/prefs", { method: "PUT", body: { cvKeywords: next } });
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.docx,.txt"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            await uploadCv(f);
            toast("CV uploaded. Scores are recalculated and Claude reads open offers again.");
            onChanged();
          } catch (err) {
            toast(err instanceof Error ? err.message : "Upload failed", "error");
          } finally {
            setBusy(false);
          }
        }}
      />
    </Section>
  );
}

function SearchSection({ prefs, onSaved }: { prefs: Prefs; onSaved: () => void }) {
  const toast = useToast();
  const [p, setP] = useState(prefs);
  const [extra, setExtra] = useState(prefs.extraKeywords.join(", "));
  const [exclude, setExclude] = useState(prefs.excludeKeywords.join(", "));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setP(prefs);
    setExtra(prefs.extraKeywords.join(", "));
    setExclude(prefs.excludeKeywords.join(", "));
  }, [prefs]);
  const toggle = <K extends "tracks" | "exploreFields" | "locations" | "languages" | "workTypes">(
    k: K,
    v: string,
  ) =>
    setP((x) => {
      const list = x[k] as string[];
      return { ...x, [k]: list.includes(v) ? list.filter((y) => y !== v) : [...list, v] };
    });
  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/jobs/prefs", {
        method: "PUT",
        body: {
          tracks: p.tracks,
          exploreFields: p.exploreFields,
          locations: p.locations,
          languages: p.languages,
          workTypes: p.workTypes,
          showFrom: p.showFrom,
          exploreShowFrom: p.exploreShowFrom,
          extraKeywords: words(extra),
          excludeKeywords: words(exclude),
        },
      });
      toast("Saved. Every offer has been rescored.");
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not saved", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section
      id="search"
      title="What I look for"
      lead="These rules decide which offers are kept and how they are ranked before Claude reads them."
    >
      <div className="filters-grid">
        <fieldset className="pref-group">
          <legend>Kinds of role</legend>
          {TRACKS.map((t) => (
            <label key={t} className="check-row" title={TRACK_HINT[t]}>
              <input
                type="checkbox"
                className="checkbox"
                checked={p.tracks.includes(t)}
                onChange={() => toggle("tracks", t)}
              />
              <span>
                {TRACK_LABEL[t as Track]}
                <span className="xsmall muted" style={{ display: "block" }}>
                  {TRACK_HINT[t as Track]}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="pref-group">
          <legend>Fields to explore</legend>
          {EXPLORE_FIELDS.map((f) => (
            <label key={f} className="check-row">
              <input
                type="checkbox"
                className="checkbox"
                checked={p.exploreFields.includes(f)}
                onChange={() => toggle("exploreFields", f)}
              />
              {FIELD_LABEL[f as ExploreField]}
            </label>
          ))}
        </fieldset>
        <fieldset className="pref-group">
          <legend>Where</legend>
          {Object.entries(LOCATIONS).map(([k, l]) => (
            <label key={k} className="check-row">
              <input
                type="checkbox"
                className="checkbox"
                checked={p.locations.includes(k as keyof typeof LOCATIONS)}
                onChange={() => toggle("locations", k)}
              />
              {l}
            </label>
          ))}
        </fieldset>
        <fieldset className="pref-group">
          <legend>Type of contract</legend>
          {Object.entries(WORK).map(([k, l]) => (
            <label key={k} className="check-row">
              <input
                type="checkbox"
                className="checkbox"
                checked={p.workTypes.includes(k as keyof typeof WORK)}
                onChange={() => toggle("workTypes", k)}
              />
              {l}
            </label>
          ))}
        </fieldset>
        <fieldset className="pref-group">
          <legend>Languages you work in</legend>
          {LANGS.map((k) => (
            <label key={k} className="check-row">
              <input
                type="checkbox"
                className="checkbox"
                checked={p.languages.includes(k)}
                onChange={() => toggle("languages", k)}
              />
              {LANGUAGE_LABEL[k] ?? k}
            </label>
          ))}
        </fieldset>
      </div>
      <label className="field">
        <span className="field-label">Extra words I am interested in</span>
        <input
          className="input"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="e.g. generative video, brand systems, motion"
        />
        <span className="field-hint">Separate with commas. Offers that mention them score higher.</span>
      </label>
      <label className="field">
        <span className="field-label">Never show roles with these words</span>
        <input
          className="input"
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
          placeholder="e.g. cold calling, intern, gambling"
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Matches: show from score {p.showFrom}</span>
          <input
            type="range"
            min={20}
            max={85}
            step={5}
            value={p.showFrom}
            onChange={(e) => setP({ ...p, showFrom: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field-label">Explore: show from score {p.exploreShowFrom}</span>
          <input
            type="range"
            min={20}
            max={85}
            step={5}
            value={p.exploreShowFrom}
            onChange={(e) => setP({ ...p, exploreShowFrom: Number(e.target.value) })}
          />
        </label>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ alignSelf: "flex-start" }}
        onClick={save}
        disabled={busy}
      >
        {busy ? <span className="spinner" /> : null} Save and rescore
      </button>
    </Section>
  );
}

function ClaudeSection({ status }: { status: Status }) {
  const toast = useToast();
  const spend = status.ai.spend;
  return (
    <SettingsForm<"ai">
      id="claude"
      title="Claude and spend"
      lead={
        status.ai.configured
          ? `Claude is connected. Spent $${spend.dayUsd.toFixed(2)} today and $${spend.monthUsd.toFixed(2)} this month (estimated from token use).`
          : "Claude is not connected. Set ANTHROPIC_API_KEY on the server: fit scores, cover letters and the advisor need it. Everything else works without it."
      }
      settingsKey="ai"
      render={(v, set) => (
        <>
          {status.ai.configured ? (
            <div className="spend-bars">
              <SpendBar label="Today" used={spend.dayUsd} limit={v.dailySpendLimitUsd} />
              <SpendBar label="This month" used={spend.monthUsd} limit={v.monthlySpendLimitUsd} />
            </div>
          ) : null}
          <div className="field-row">
            <NumberField
              label="Daily limit (USD)"
              value={v.dailySpendLimitUsd}
              min={0}
              max={100}
              step={0.5}
              onChange={(n) => set({ ...v, dailySpendLimitUsd: n })}
            />
            <NumberField
              label="Monthly limit (USD)"
              value={v.monthlySpendLimitUsd}
              min={0}
              max={1000}
              step={1}
              onChange={(n) => set({ ...v, monthlySpendLimitUsd: n })}
            />
          </div>
          <div className="field-row">
            <NumberField
              label="Claude reads offers with a rule score of at least"
              value={v.scoreFromRuleScore}
              min={0}
              max={100}
              onChange={(n) => set({ ...v, scoreFromRuleScore: n })}
            />
            <NumberField
              label="Offers read per day at most"
              value={v.maxScoredPerDay}
              min={0}
              max={1000}
              onChange={(n) => set({ ...v, maxScoredPerDay: n })}
            />
            <NumberField
              label="Estimated USD per million tokens"
              value={v.usdPerMillionTokens}
              min={0}
              max={100}
              step={0.5}
              onChange={(n) => set({ ...v, usdPerMillionTokens: n })}
            />
          </div>
          <p className="xsmall muted" style={{ margin: 0 }}>
            When a limit is reached, scoring pauses and buttons that call Claude say so; nothing is charged
            past it. Also set a spend limit in the Anthropic Console as a second safety net.
          </p>
        </>
      )}
      toast={toast}
    />
  );
}

function SpendBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="spend-bar">
      <div className="row-between small">
        <span>{label}</span>
        <span className="muted">
          ${used.toFixed(2)} of ${limit.toFixed(2)}
        </span>
      </div>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${pct}%`, background: pct > 85 ? "var(--warn-dot)" : undefined }} />
      </div>
    </div>
  );
}

function HealthSection({ status }: { status: Status }) {
  const s = status.scheduler;
  return (
    <Section id="health" title="Health" lead="Is the daily engine running, and which job boards answered.">
      <dl className="kv">
        <dt>Hourly tick</dt>
        <dd>
          <span className={`dot ${s.tickHealthy ? "dot-ok" : "dot-warn"}`} />{" "}
          {s.lastTickAt ? `last ran ${formatWarsaw(s.lastTickAt, "d LLL, HH:mm")}` : "has not run yet"}
          {!s.tickHealthy ? " · check the Vercel cron and CRON_SECRET" : ""}
        </dd>
        <dt>Last read of sources</dt>
        <dd>{s.lastSyncAt ? formatWarsaw(s.lastSyncAt, "d LLL, HH:mm") : "not yet"}</dd>
        <dt>Next daily refresh</dt>
        <dd>{s.enabled ? formatWarsaw(s.nextRefreshAt, "EEE d LLL, HH:mm") : "paused"}</dd>
        <dt>Optional boards</dt>
        <dd>
          Adzuna {status.integrations.adzuna ? "on" : "off (ADZUNA_APP_ID / ADZUNA_APP_KEY)"} · Jooble{" "}
          {status.integrations.jooble ? "on" : "off (JOOBLE_API_KEY)"}
        </dd>
      </dl>
      {s.lastErrors.length ? (
        <Callout>
          <strong>Last tick reported problems</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.lastErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      {status.sources.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job board</th>
                <th>Last read</th>
                <th>Offers kept</th>
              </tr>
            </thead>
            <tbody>
              {status.sources.map((x) => (
                <tr key={x.id} style={{ cursor: "default" }}>
                  <td>
                    <span className="status">
                      <span
                        className={`dot ${x.lastStatus === "error" ? "dot-bad" : x.lastFetchedAt ? "dot-ok" : "dot-hollow"}`}
                      />
                      {x.name}
                    </span>
                    {x.lastError ? <div className="xsmall text-warn">{x.lastError.slice(0, 160)}</div> : null}
                  </td>
                  <td className="small">
                    {x.lastFetchedAt ? formatWarsaw(x.lastFetchedAt, "d LLL, HH:mm") : "–"}
                  </td>
                  <td className="small">
                    {x.jobsKept} of {x.jobsTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small muted">The job boards are set up on the first refresh.</p>
      )}
    </Section>
  );
}

type Key = "ai" | "digest" | "scheduler" | "profile";
function SettingsForm<K extends Key>({
  id,
  title,
  lead,
  settingsKey,
  render,
  toast,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  settingsKey: K;
  render: (v: SettingsOf<K>, set: (v: SettingsOf<K>) => void) => ReactNode;
  toast: ReturnType<typeof useToast>;
}) {
  const [v, setV] = useState<SettingsOf<K> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<SettingsOf<K>>(`/api/settings/${settingsKey}`)
      .then(setV)
      .catch(() => toast("Could not load settings", "error"));
  }, [settingsKey, toast]);
  return (
    <Section id={id} title={title} lead={lead}>
      {v ? (
        <>
          {render(v, (n) => {
            setV(n);
            setDirty(true);
          })}
          <button
            type="button"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!dirty || busy}
            onClick={async () => {
              setBusy(true);
              try {
                setV(
                  await apiFetch<SettingsOf<K>>(`/api/settings/${settingsKey}`, { method: "PUT", body: v }),
                );
                setDirty(false);
                toast("Saved");
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Not saved", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <span className="spinner" /> : null} Save
          </button>
        </>
      ) : (
        <span className="skeleton" style={{ width: "40%" }} />
      )}
    </Section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        className="input"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
