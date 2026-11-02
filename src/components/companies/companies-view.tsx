"use client";

import { Ban, Building2, ExternalLink, Heart, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { SECTOR_LABEL, SECTORS, type Sector } from "@/lib/jobs/sectors";
import { formatWarsaw } from "@/lib/time";
import type { CompanyRow } from "@/server/careers/service";

export function CompaniesView() {
  const toast = useToast();
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<Sector | "all" | "favourites">("all");
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ rows: CompanyRow[] }>(
        `/api/companies${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
      );
      setRows(r.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load companies");
    }
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  async function patch(r: CompanyRow, body: { favourite?: boolean; excluded?: boolean }) {
    setRows((xs) => xs?.map((x) => (x.id === r.id ? { ...x, ...body } : x)) ?? null);
    try {
      await apiFetch(`/api/companies/${r.id}`, { method: "PATCH", body });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not saved", "error");
      await load();
    }
  }

  if (error) return <Callout tone="bad">{error}</Callout>;
  const shown =
    rows?.filter((r) =>
      sector === "all" ? true : sector === "favourites" ? r.favourite : (r.sector ?? "other") === sector,
    ) ?? null;
  const count = (s: Sector) => rows?.filter((r) => (r.sector ?? "other") === s).length ?? 0;

  return (
    <div className="stack-lg">
      <div className="views" role="toolbar" aria-label="Groups">
        <button type="button" aria-pressed={sector === "all"} onClick={() => setSector("all")}>
          All <span className="views-count">{rows?.length ?? ""}</span>
        </button>
        <button type="button" aria-pressed={sector === "favourites"} onClick={() => setSector("favourites")}>
          Favourites <span className="views-count">{rows?.filter((r) => r.favourite).length ?? ""}</span>
        </button>
        {SECTORS.filter((s) => count(s)).map((s) => (
          <button key={s} type="button" aria-pressed={sector === s} onClick={() => setSector(s)}>
            {SECTOR_LABEL[s]} <span className="views-count">{count(s)}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={15} />
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies…"
            aria-label="Search companies"
          />
        </label>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add a company
        </button>
      </div>

      {!shown ? (
        <div className="card card-pad">
          <span className="skeleton" style={{ width: "60%" }} />
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <Empty icon={<Building2 size={22} />} title="No companies here">
            Add companies whose career pages you want watched. Run <code>pnpm companies:import</code> to load
            the suggested list.
          </Empty>
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th className="hide-mobile">Group</th>
                <th>Careers page</th>
                <th>Open roles</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={r.excluded ? "is-muted" : ""} style={{ cursor: "default" }}>
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary">
                        {r.brand ?? r.name}{" "}
                        <a
                          href={r.website ?? `https://${r.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${r.name} website`}
                        >
                          <ExternalLink size={11} />
                        </a>
                      </span>
                      {r.note ? (
                        <span className="cell-sub">{r.note}</span>
                      ) : (
                        <span className="cell-sub">{r.domain}</span>
                      )}
                    </div>
                  </td>
                  <td className="hide-mobile small secondary">
                    {SECTOR_LABEL[(r.sector ?? "other") as Sector] ?? r.sector}
                  </td>
                  <td className="small">
                    {r.boards ? (
                      <span className="status">
                        <span className="dot dot-ok" /> Watched
                      </span>
                    ) : r.careersCheckedAt ? (
                      <span className="status" title={`Checked ${formatWarsaw(r.careersCheckedAt, "d LLL")}`}>
                        <span className="dot dot-hollow" /> No readable board
                      </span>
                    ) : (
                      <span className="status">
                        <span className="dot dot-neutral" /> Not checked yet
                      </span>
                    )}
                    {r.careersUrl ? (
                      <>
                        {" "}
                        <a href={r.careersUrl} target="_blank" rel="noopener noreferrer" className="xsmall">
                          open
                        </a>
                      </>
                    ) : null}
                  </td>
                  <td className="small">
                    {r.open ? (
                      <Link href={`/matches?view=all&q=${encodeURIComponent(r.brand ?? r.name)}`}>
                        {r.open}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-quiet btn-icon btn-sm"
                        aria-pressed={r.favourite}
                        aria-label={r.favourite ? "Remove from favourites" : "Favourite: show all its roles"}
                        title={r.favourite ? "Favourite" : "Favourite: show all its roles"}
                        onClick={() => patch(r, { favourite: !r.favourite })}
                      >
                        <Heart size={14} className={r.favourite ? "heart-on" : ""} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet btn-icon btn-sm"
                        aria-pressed={r.excluded}
                        aria-label={r.excluded ? "Watch again" : "Never show this company"}
                        title={r.excluded ? "Excluded: click to watch again" : "Never show this company"}
                        onClick={() => patch(r, { excluded: !r.excluded })}
                      >
                        <Ban size={14} className={r.excluded ? "text-warn" : ""} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="xsmall muted">
        The app looks for a public job board on each company's site (Greenhouse, Lever, Ashby, Workable,
        SmartRecruiters, Recruitee, Teamtailor, Personio and others) and reads it every few hours, politely
        and within robots.txt. Companies without a readable board are skipped.
      </p>
      <AddCompanyDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={async () => {
          setAddOpen(false);
          toast("Added. Its careers page is checked on the next refresh.");
          await load();
        }}
      />
    </div>
  );
}

function AddCompanyDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", website: "", sector: "other" as Sector, note: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ name: "", website: "", sector: "other", note: "" });
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a company"
      description="Its own site is searched for a job board. Favourite it to see every role it posts."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !f.name.trim() || !f.website.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await apiFetch("/api/companies", { body: { ...f, note: f.note || undefined } });
                onAdded();
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Not added", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <span className="spinner" /> : null} Add
          </button>
        </>
      }
    >
      <div className="field-row">
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Website</span>
          <input
            className="input"
            value={f.website}
            onChange={(e) => setF({ ...f, website: e.target.value })}
            placeholder="example.com"
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Group</span>
        <select
          className="select"
          value={f.sector}
          onChange={(e) => setF({ ...f, sector: e.target.value as Sector })}
        >
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Why it is interesting (optional)</span>
        <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </label>
    </Dialog>
  );
}
