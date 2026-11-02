"use client";

import {
  Bell,
  Bookmark,
  Compass,
  FileText,
  Heart,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { AREA_LABEL, AREAS, type Area, REGION_LABEL, type Region } from "@/lib/jobs/match";
import {
  FIELD_LABEL,
  FIGMA_LABEL,
  type FigmaShare,
  PIVOT_LABEL,
  type Pivot,
  TRACK_HINT,
  TRACK_LABEL,
} from "@/lib/jobs/tracks";
import { type ExploreField, STATUS_LABEL, type Track } from "@/lib/jobs/types";
import { formatWarsaw } from "@/lib/time";
import type { CareerProfile, Filters, JobList, JobRow } from "@/server/careers/service";
import { ago, CompanyMark, FigmaTag, PivotTag, ScoreRing, StatusTag, TrackTag } from "./bits";
import { OfferPanel } from "./offer-panel";

type Screen = "matches" | "explore";
type View = "best" | "new" | "all";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "best", label: "Best", hint: "Open offers above your score threshold" },
  { id: "new", label: "New", hint: "Found in the last 3 days" },
  { id: "all", label: "All", hint: "Every open offer on this screen, except the ones you hid" },
];

const SCREEN_TRACKS: Record<Screen, Track[]> = {
  matches: ["core", "beyond"],
  explore: ["adjacent", "new_field"],
};
const AREA_HINT: Record<Area | "all", string> = {
  pl: "Warsaw, elsewhere in Poland, and remote roles for people in Poland.",
  eu: "On-site, hybrid and remote roles in the EU, EEA and Switzerland. As a Polish citizen you need no work permit there.",
  world:
    "Everywhere else, including the UK and the US. Remote roles open to Poland are marked; on-site roles need a work visa.",
  all: "Every place together.",
};

const PLACES = { warsaw: "Warsaw", poland: "Elsewhere in Poland", remote: "Remote" } as const;
const WORKPLACES = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unknown: "Not stated" } as const;
const FIELDS = Object.keys(FIELD_LABEL) as ExploreField[];

type SavedView = { id: string; name: string; filters: Filters };

export function OffersView({ screen }: { screen: Screen }) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>((params.get("view") as View) || "best");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [filters, setFilters] = useState<Filters>(() => {
    const a = params.get("area");
    return { area: a === "all" ? undefined : AREAS.includes(a as Area) ? (a as Area) : "pl" };
  });
  const [data, setData] = useState<JobList | null>(null);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get("o"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const query = useCallback(
    (offset = 0) => {
      const u = new URLSearchParams({ screen, view });
      const f: Filters = { ...filters, q: qRef.current.trim() || undefined };
      if (Object.values(f).some((v) => v !== undefined)) u.set("f", JSON.stringify(f));
      if (offset) u.set("offset", String(offset));
      return `/api/jobs?${u}`;
    },
    [screen, view, filters],
  );

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<JobList>(query()));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load offers");
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const loadViews = useCallback(async () => {
    const r = await apiFetch<{ views: SavedView[] }>(`/api/views?screen=${screen}`).catch(() => ({
      views: [],
    }));
    setViews(r.views);
  }, [screen]);
  useEffect(() => {
    void loadViews();
    void apiFetch<CareerProfile>("/api/jobs/cv")
      .then(setProfile)
      .catch(() => null);
  }, [loadViews]);

  function open(id: string | null) {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("o", id);
    else url.searchParams.delete("o");
    url.searchParams.delete("add");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  async function loadMore() {
    if (!data) return;
    setMore(true);
    try {
      const next = await apiFetch<JobList>(query(data.rows.length));
      setData((d) =>
        d
          ? { ...d, rows: [...d.rows, ...next.rows.filter((r) => !d.rows.some((x) => x.id === r.id))] }
          : next,
      );
    } finally {
      setMore(false);
    }
  }

  async function syncNow() {
    setSyncing("Reading sources…");
    try {
      for (let i = 0; i < 3; i++) {
        const r = await apiFetch<{ busy: boolean; remainingFetch?: number; remainingDetect?: number }>(
          "/api/jobs/sync",
          { body: {} },
        );
        if (r.busy) {
          toast("A refresh is already running in the background. Try again in a minute.");
          break;
        }
        await load();
        const left = (r.remainingFetch ?? 0) + (r.remainingDetect ?? 0);
        if (!left) break;
        setSyncing(`Reading sources… (${left} left)`);
      }
      toast("Offers refreshed. Claude scores the new ones within the hour.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Refresh failed", "error");
    } finally {
      setSyncing(null);
    }
  }

  async function saveCurrentView() {
    const name = window.prompt("Name this view", "");
    if (!name?.trim()) return;
    await apiFetch("/api/views", {
      body: { screen, name, filters: { ...filters, q: q.trim() || undefined } },
    });
    toast("View saved");
    await loadViews();
  }

  if (error) return <Callout tone="bad">{error}</Callout>;

  const counts = data?.counts ?? {};
  const active = activeChips(filters, screen);
  return (
    <div className="stack-lg">
      <HeaderActions>
        <div className="btn-group">
          <button type="button" className="btn" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add an offer
          </button>
          <Link className="btn" href="/settings#search">
            <SlidersHorizontal size={15} /> What I look for
          </Link>
        </div>
      </HeaderActions>

      <div className="stack" style={{ gap: 8 }}>
        <div className="subnav area-tabs" role="tablist" aria-label="Where">
          {[...AREAS, "all" as const].map((a) => {
            const on = (filters.area ?? "all") === a;
            const n =
              a === "all"
                ? Object.values(data?.areaCounts ?? {}).reduce((x, y) => x + y, 0)
                : data?.areaCounts?.[a];
            return (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setFilters({ ...filters, area: a === "all" ? undefined : a });
                  const u = new URL(window.location.href);
                  u.searchParams.set("area", a);
                  window.history.replaceState(null, "", u);
                }}
              >
                {a === "all" ? "All places" : AREA_LABEL[a]}
                {data ? <span className="views-count">{n ?? 0}</span> : null}
              </button>
            );
          })}
        </div>
        <p className="xsmall muted" style={{ margin: 0 }}>
          {AREA_HINT[filters.area ?? "all"]}
        </p>
      </div>

      {profile && !profile.cv.filename ? <CvCard onDone={load} /> : null}

      <section className="stat-cards" aria-label="Summary">
        <button type="button" className="stat-card" onClick={() => setView("best")}>
          <span className="metric-icon">
            {screen === "matches" ? (
              <Sparkles size={24} strokeWidth={1.8} />
            ) : (
              <Compass size={24} strokeWidth={1.8} />
            )}
          </span>
          <span className="metric-value">{counts.best ?? "–"}</span>
          <span className="metric-label">{screen === "matches" ? "Best matches" : "Worth a look"}</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("new")}>
          <span className="metric-icon">
            <Bell size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{data?.stats.newToday ?? "–"}</span>
          <span className="metric-label">New in the last 24 hours</span>
        </button>
        <Link href="/pipeline" className="stat-card" style={{ textDecoration: "none" }}>
          <span className="metric-icon">
            <Send size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{data ? data.stats.applied : "–"}</span>
          <span className="metric-label">
            Applied{data?.stats.interviews ? ` · ${data.stats.interviews} interviewing` : ""}
          </span>
        </Link>
      </section>

      <div className="stack" style={{ gap: 12 }}>
        <div className="views" role="toolbar" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              title={v.hint}
              onClick={() => setView(v.id)}
            >
              {v.label}
              {counts[v.id] !== undefined ? <span className="views-count">{counts[v.id]}</span> : null}
            </button>
          ))}
          {views.map((sv) => (
            <span key={sv.id} className="saved-view">
              <button
                type="button"
                onClick={() => {
                  setFilters({ ...sv.filters, q: undefined });
                  setQ(sv.filters.q ?? "");
                  setView("all");
                }}
              >
                <Bookmark size={13} /> {sv.name}
              </button>
              <button
                type="button"
                aria-label={`Delete view ${sv.name}`}
                className="saved-view-x"
                onClick={async () => {
                  await apiFetch(`/api/views/${sv.id}`, { method: "DELETE" });
                  await loadViews();
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={15} />
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search role, company, city…"
              aria-label="Search offers"
            />
          </label>
          <button type="button" className="btn btn-sm" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={14} /> Filters{active.length ? ` (${active.length})` : ""}
          </button>
          <div className="segmented" role="toolbar" aria-label="Sort">
            <button
              type="button"
              aria-pressed={filters.sort !== "newest"}
              onClick={() => setFilters({ ...filters, sort: undefined })}
            >
              Best fit
            </button>
            <button
              type="button"
              aria-pressed={filters.sort === "newest"}
              onClick={() => setFilters({ ...filters, sort: "newest" })}
            >
              Newest
            </button>
          </div>
          <div className="toolbar-spacer" />
          <span className="small muted hide-mobile">
            {data?.sync.lastSyncAt
              ? `Checked ${formatWarsaw(data.sync.lastSyncAt, "d LLL, HH:mm")}`
              : "Not checked yet"}
          </span>
          <button type="button" className="btn btn-sm" onClick={syncNow} disabled={syncing !== null}>
            {syncing ? <span className="spinner" /> : <RefreshCw size={14} />} {syncing ?? "Refresh now"}
          </button>
        </div>
        {active.length ? (
          <div className="filter-chips">
            {active.map((c) => (
              <span key={c.key} className="chip">
                {c.label}
                <button
                  type="button"
                  aria-label={`Remove ${c.label}`}
                  onClick={() => setFilters(c.remove(filters))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button type="button" className="link-button small" onClick={() => setFilters({})}>
              Clear all
            </button>
            <button type="button" className="link-button small" onClick={saveCurrentView}>
              <Save size={12} /> Save as a view
            </button>
          </div>
        ) : null}
      </div>

      {!data ? (
        <div className="job-grid">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="job-card">
              <span className="skeleton" style={{ width: "70%" }} />
              <span className="skeleton" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <div className="card">
          <Empty
            icon={screen === "matches" ? <Sparkles size={22} /> : <Compass size={22} />}
            title={view === "best" ? "No strong matches yet" : "Nothing here"}
          >
            {view === "best"
              ? "Sources are read every morning and Claude scores new offers during the day. Try “Refresh now”, the All view, or looser filters."
              : "Nothing matches these filters."}
          </Empty>
        </div>
      ) : (
        <div className="job-grid">
          {data.rows.map((r) => (
            <OfferCard key={r.id} r={r} screen={screen} onOpen={() => open(r.id)} active={openId === r.id} />
          ))}
        </div>
      )}

      {data && data.rows.length > 0 && data.rows.length < (counts[view] ?? 0) ? (
        <div className="row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn" onClick={loadMore} disabled={more}>
            {more ? <span className="spinner" /> : null} Show more ({data.rows.length} of {counts[view]})
          </button>
        </div>
      ) : null}

      {data ? (
        <p className="xsmall muted">
          {data.sync.openOffers} open offers from {data.sync.feeds} job boards and {data.sync.boards} company
          career pages ({data.sync.companiesChecked} of {data.sync.companiesTotal} companies checked).
          {data.sync.failing ? ` ${data.sync.failing} sources failed on the last read.` : ""} Scores with a
          spark were read by Claude against your CV; the others come from the free rules. Remote listings from{" "}
          <a href="https://remotive.com/" target="_blank" rel="noopener noreferrer">
            Remotive
          </a>{" "}
          and others link back to their source.
        </p>
      ) : null}

      {openId ? <OfferPanel id={openId} onClose={() => open(null)} onChanged={load} /> : null}
      <FiltersDialog
        open={filtersOpen}
        screen={screen}
        value={filters}
        sources={data?.sources ?? []}
        onClose={() => setFiltersOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setFiltersOpen(false);
          if (view === "best" && Object.keys(f).length) setView("all");
        }}
      />
      <AddDialog
        open={addOpen}
        onClose={() => open(openId)}
        onClosed={() => setAddOpen(false)}
        onAdded={async (id) => {
          setAddOpen(false);
          await load();
          open(id);
        }}
      />
    </div>
  );
}

function HeaderActions({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("page-actions")), []);
  return host ? createPortal(children, host) : null;
}

function OfferCard({
  r,
  screen,
  onOpen,
  active,
}: {
  r: JobRow;
  screen: Screen;
  onOpen: () => void;
  active: boolean;
}) {
  // The track tag already says what kind of role it is; Claude's summary replaces the good reasons.
  const reasons = r.match.reasons
    .filter((x) => !x.text.startsWith(`${TRACK_LABEL[r.track as Track]}:`))
    .filter((x) => x.tone !== "good" || !r.ai)
    .slice(0, 3);
  return (
    <button type="button" className={`job-card${active ? " is-active" : ""}`} onClick={onOpen}>
      <div className="job-card-top">
        <CompanyMark name={r.companyName} />
        <div className="job-card-head">
          <span className="job-title">{r.title}</span>
          <span className="job-meta">
            {r.companyName}
            {r.favourite ? <Heart size={12} className="heart-on" aria-label="Favourite company" /> : null}
            {" · "}
            <MapPin size={12} /> {r.location || REGION_LABEL[r.match.region as Region] || "Not stated"}
          </span>
        </div>
        <ScoreRing score={r.score} byClaude={Boolean(r.ai)} />
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {screen === "explore" && r.field ? (
          <span className={`tag tag-track tag-${r.track}`}>{FIELD_LABEL[r.field as ExploreField]}</span>
        ) : (
          <TrackTag track={r.track} />
        )}
        <PivotTag pivot={r.pivot} />
        {r.track !== "new_field" ? <FigmaTag share={r.figmaShare} /> : null}
        {r.salary ? <span className="tag tag-ok">{r.salary}</span> : null}
      </div>
      {r.ai ? <p className="job-summary">{r.ai.summary}</p> : null}
      {reasons.length ? (
        <div className="job-reasons">
          {reasons.map((x) => (
            <span key={x.text} className={`reason reason-${x.tone}`}>
              {x.text}
            </span>
          ))}
        </div>
      ) : null}
      <div className="job-card-foot">
        <span>
          {r.postedAt ? `Posted ${ago(r.postedAt)}` : `Found ${ago(r.firstSeenAt)}`} · {r.source}
        </span>
        <span className="row" style={{ gap: 6 }}>
          {r.hasLetter ? <Mail size={13} aria-label="Cover letter drafted" /> : null}
          <StatusTag status={r.status} />
          {r.closedAt ? <span className="tag">Closed</span> : null}
        </span>
      </div>
    </button>
  );
}

type Chip = { key: string; label: string; remove: (f: Filters) => Filters };

function activeChips(f: Filters, screen: Screen): Chip[] {
  const chips: Chip[] = [];
  const list = <K extends keyof Filters>(k: K, label: (v: string) => string) => {
    for (const v of (f[k] as string[] | undefined) ?? [])
      chips.push({
        key: `${String(k)}:${v}`,
        label: label(v),
        remove: (x) => {
          const next = ((x[k] as string[] | undefined) ?? []).filter((y) => y !== v);
          return { ...x, [k]: next.length ? next : undefined };
        },
      });
  };
  list("tracks", (v) => TRACK_LABEL[v as Track]);
  if (screen === "explore") list("fields", (v) => FIELD_LABEL[v as ExploreField]);
  list("places", (v) => PLACES[v as keyof typeof PLACES]);
  list("workplaces", (v) => WORKPLACES[v as keyof typeof WORKPLACES]);
  list("figma", (v) => FIGMA_LABEL[v as FigmaShare]);
  list("pivots", (v) => PIVOT_LABEL[v as Pivot]);
  list("statuses", (v) => STATUS_LABEL[v as keyof typeof STATUS_LABEL]);
  list("sources", (v) => v);
  const flag = (k: keyof Filters, label: string) => {
    if (f[k]) chips.push({ key: String(k), label, remove: (x) => ({ ...x, [k]: undefined }) });
  };
  if (f.minScore) flag("minScore", `Score ${f.minScore}+`);
  if (f.postedWithinDays) flag("postedWithinDays", `Last ${f.postedWithinDays} days`);
  flag("salaryOnly", "Pay stated");
  flag("claudeOnly", "Read by Claude");
  flag("favouritesOnly", "Favourite companies");
  return chips;
}

function FiltersDialog({
  open,
  screen,
  value,
  sources,
  onClose,
  onApply,
}: {
  open: boolean;
  screen: Screen;
  value: Filters;
  sources: { kind: string; name: string }[];
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [f, setF] = useState<Filters>(value);
  useEffect(() => {
    if (open) setF(value);
  }, [open, value]);
  const toggle = <K extends keyof Filters>(k: K, v: string) =>
    setF((x) => {
      const cur = ((x[k] as string[] | undefined) ?? []) as string[];
      const next = cur.includes(v) ? cur.filter((y) => y !== v) : [...cur, v];
      return { ...x, [k]: next.length ? next : undefined };
    });
  const has = (k: keyof Filters, v: string) => ((f[k] as string[] | undefined) ?? []).includes(v);
  const group = (
    legend: string,
    k: keyof Filters,
    options: Record<string, string>,
    hints?: Record<string, string>,
  ) => (
    <fieldset className="pref-group">
      <legend>{legend}</legend>
      {Object.entries(options).map(([v, l]) => (
        <label key={v} className="check-row" title={hints?.[v]}>
          <input type="checkbox" className="checkbox" checked={has(k, v)} onChange={() => toggle(k, v)} />
          {l}
        </label>
      ))}
    </fieldset>
  );
  const trackOptions = Object.fromEntries(SCREEN_TRACKS[screen].map((t) => [t, TRACK_LABEL[t]]));
  const kinds = Object.fromEntries(
    sources.filter((s) => s.kind !== "careers_page").map((s) => [s.kind, s.name.replace(/ \(.*\)$/, "")]),
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Filters"
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={() => setF({})}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(f)}>
            Show offers
          </button>
        </>
      }
    >
      <div className="filters-grid">
        {group("Kind of role", "tracks", trackOptions, TRACK_HINT as Record<string, string>)}
        {screen === "explore"
          ? group("Field", "fields", Object.fromEntries(FIELDS.map((x) => [x, FIELD_LABEL[x]])))
          : group("How much Figma", "figma", FIGMA_LABEL)}
        {group("Where", "places", PLACES)}
        {group("Way of working", "workplaces", WORKPLACES)}
        {group("Career change", "pivots", PIVOT_LABEL)}
        {group(
          "Status",
          "statuses",
          Object.fromEntries(
            (["new", "saved", "applied", "interview"] as const).map((s) => [s, STATUS_LABEL[s]]),
          ),
        )}
        {Object.keys(kinds).length
          ? group("Source", "sources", { ...kinds, careers_page: "Company career pages" })
          : null}
        <fieldset className="pref-group">
          <legend>Other</legend>
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={Boolean(f.salaryOnly)}
              onChange={(e) => setF({ ...f, salaryOnly: e.target.checked || undefined })}
            />
            Pay is stated
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={Boolean(f.claudeOnly)}
              onChange={(e) => setF({ ...f, claudeOnly: e.target.checked || undefined })}
            />
            Read by Claude
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={Boolean(f.favouritesOnly)}
              onChange={(e) => setF({ ...f, favouritesOnly: e.target.checked || undefined })}
            />
            Favourite companies only
          </label>
        </fieldset>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Score at least {f.minScore ?? 0}</span>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={f.minScore ?? 0}
            onChange={(e) => setF({ ...f, minScore: Number(e.target.value) || undefined })}
          />
        </label>
        <label className="field">
          <span className="field-label">Posted within</span>
          <select
            className="select"
            value={f.postedWithinDays ?? ""}
            onChange={(e) =>
              setF({ ...f, postedWithinDays: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Any time</option>
            <option value="1">24 hours</option>
            <option value="3">3 days</option>
            <option value="7">A week</option>
            <option value="14">Two weeks</option>
            <option value="30">A month</option>
          </select>
        </label>
      </div>
    </Dialog>
  );
}

function CvCard({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      await uploadCv(file);
      toast("CV uploaded. Scores are recalculated, and Claude reads offers again against it.");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card card-pad cv-card">
      <div className="metric-icon" style={{ marginBottom: 0 }}>
        <FileText size={24} strokeWidth={1.8} />
      </div>
      <div className="stack" style={{ gap: 4, flex: 1 }}>
        <h3>Upload your CV</h3>
        <p className="small secondary">
          Scores, Claude's fit notes and cover letters all start from it. Only the text is kept, in your
          private database; the file itself is not stored.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        {busy ? <span className="spinner" /> : <Upload size={15} />} Upload CV (PDF, DOCX)
      </button>
    </section>
  );
}

export async function uploadCv(file: File) {
  const res = await fetch(`/api/jobs/cv?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok)
    throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed");
}

function AddDialog({
  open,
  onClose,
  onClosed,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
  onAdded: (id: string) => void;
}) {
  const toast = useToast();
  const empty = { url: "", title: "", companyName: "", location: "", description: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ url: "", title: "", companyName: "", location: "", description: "" });
  }, [open]);
  async function add() {
    setBusy(true);
    try {
      const r = await apiFetch<{ id: string }>("/api/jobs", { body: { ...f, location: f.location || null } });
      toast("Offer added and saved");
      onAdded(r.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not added", "error");
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    onClosed();
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add an offer"
      description="Found something on LinkedIn, Pracuj.pl or through a friend? Paste the link and the ad: it gets scored and lands in your pipeline as Saved."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={add}
            disabled={busy || !f.url || !f.title || !f.companyName}
          >
            {busy ? <span className="spinner" /> : null} Add
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Link to the offer</span>
        <input
          className="input"
          type="url"
          value={f.url}
          onChange={(e) => setF({ ...f, url: e.target.value })}
          placeholder="https://…"
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Role</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Company</span>
          <input
            className="input"
            value={f.companyName}
            onChange={(e) => setF({ ...f, companyName: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Place (optional)</span>
        <input
          className="input"
          value={f.location}
          onChange={(e) => setF({ ...f, location: e.target.value })}
          placeholder="e.g. Warsaw, hybrid"
        />
      </label>
      <label className="field">
        <span className="field-label">The ad text (optional, but it improves the score)</span>
        <textarea
          className="textarea"
          rows={6}
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </label>
    </Dialog>
  );
}
