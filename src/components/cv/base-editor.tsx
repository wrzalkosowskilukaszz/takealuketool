"use client";

import { Check, Download, FileUp, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import {
  allFacts,
  baseToMarkdown,
  type ExperienceBase,
  FACT_STATUSES,
  type Fact,
  type FactStatus,
  KIND_LABEL,
  KINDS,
  type Role,
  STATUS_LABEL,
  sortedRoles,
} from "@/lib/cv/base";

const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
type Filter = "all" | FactStatus;

function saveBlob(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BaseEditor({ initial, aiReady }: { initial: ExperienceBase | null; aiReady: boolean }) {
  const toast = useToast();
  const [base, setBase] = useState<ExperienceBase | null>(initial ? structuredClone(initial) : null);
  const loadedAt = useRef<string | null>(initial?.updatedAt ?? null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Mutations edit the draft in place and bump state, so typing never loses the caret.
  const [, force] = useState(0);
  const changed = () => {
    setDirty(true);
    force((n) => n + 1);
  };

  async function save() {
    if (!base) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ base: ExperienceBase }>("/api/cv/base", {
        method: "PUT",
        body: { base, expected: loadedAt.current },
      });
      loadedAt.current = r.base.updatedAt ?? null;
      setBase(structuredClone(r.base));
      setDirty(false);
      toast("Base saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not saved", "error");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    try {
      const data = JSON.parse(await file.text()) as unknown;
      if (
        base &&
        !window.confirm("Replace your current base with this file? Versions you already have stay.")
      )
        return;
      const r = await apiFetch<{ facts: number; versions: number }>("/api/cv/base/import", { body: data });
      const fresh = await apiFetch<{ base: ExperienceBase | null }>("/api/cv/base");
      setBase(fresh.base ? structuredClone(fresh.base) : null);
      loadedAt.current = fresh.base?.updatedAt ?? null;
      setDirty(false);
      toast(`Imported ${r.facts} facts${r.versions ? ` and ${r.versions} CV versions` : ""}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "This file could not be read as JSON", "error");
    }
  }

  const toolbar = (
    <div className="toolbar">
      <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || busy || !base}>
        <Save size={14} /> {busy ? "Saving…" : "Save base"}
      </button>
      <button type="button" className="btn" onClick={() => setNoteOpen(true)} disabled={!base || !aiReady}>
        <Sparkles size={14} /> Add facts from a note
      </button>
      <button type="button" className="btn btn-quiet" onClick={() => fileRef.current?.click()}>
        <FileUp size={14} /> Import JSON
      </button>
      {base ? (
        <>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() =>
              saveBlob("experience-base.json", JSON.stringify(base, null, 1), "application/json")
            }
          >
            <Download size={14} /> JSON
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => saveBlob("experience-base.md", baseToMarkdown(base), "text/markdown")}
          >
            <Download size={14} /> Markdown
          </button>
        </>
      ) : null}
      <span className="toolbar-spacer" />
      {dirty ? <span className="small text-warn">Unsaved changes</span> : null}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importFile(f);
        }}
      />
    </div>
  );

  if (!base)
    return (
      <div className="stack-lg">
        {toolbar}
        <Callout tone="info">
          <span>
            Your base is empty. Import the JSON export from your Kreator (Baza doświadczenia → Pobierz JSON),
            or the migration file in your project files. It brings your CV versions too.
          </span>
        </Callout>
      </div>
    );

  const facts = allFacts(base);
  const counts = { all: facts.length } as Record<Filter, number>;
  for (const s of FACT_STATUSES) counts[s] = facts.filter((f) => f.status === s).length;
  const p = base.personal;
  const pf = (k: keyof typeof p, label: string, wide = false) => (
    <label className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span className="field-label">{label}</span>
      <input
        className="input"
        value={p[k]}
        onChange={(e) => {
          p[k] = e.target.value;
          changed();
        }}
      />
    </label>
  );

  return (
    <div className="stack-lg">
      {toolbar}
      <p className="small secondary" style={{ margin: 0 }}>
        The base is separate from your CVs: shortening a CV for one posting removes nothing here. The status
        decides what may be used: only confirmed facts reach a CV.
      </p>
      <div className="segmented" role="toolbar" aria-label="Show">
        {(["all", ...FACT_STATUSES] as Filter[]).map((k) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k === "all" ? "All" : STATUS_LABEL[k]} ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      <section className="card card-pad stack">
        <h3 className="section-title" style={{ margin: 0 }}>
          Contact and headline
        </h3>
        <div className="grid-3 cv-fields">
          {pf("name", "Name")}
          {pf("phone", "Phone")}
          {pf("email", "Email")}
          {pf("linkedin", "LinkedIn")}
          {pf("website", "Website / portfolio")}
          {pf("location", "Location")}
          {pf("headline", "Headline (a starting point; Claude adapts it to each posting)", true)}
        </div>
      </section>

      <FactSection title="Profile" list={base.profile} kind="profil" filter={filter} onChange={changed} />

      <section className="card card-pad stack">
        <div className="row-between">
          <h3 className="section-title" style={{ margin: 0 }}>
            Experience
          </h3>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              base.roles.unshift({
                id: uid("r_"),
                company: "",
                title: "",
                contract: "",
                start: "",
                end: null,
                dateFormat: "month",
                facts: [],
              });
              changed();
            }}
          >
            <Plus size={13} /> Add a role
          </button>
        </div>
        {sortedRoles(base).map((r) => (
          <RoleBlock
            key={r.id}
            role={r}
            filter={filter}
            onChange={changed}
            onDelete={() => {
              if (
                r.facts.length &&
                !window.confirm(`Delete “${r.title} — ${r.company}” and its ${r.facts.length} facts?`)
              )
                return;
              base.roles.splice(base.roles.indexOf(r), 1);
              changed();
            }}
          />
        ))}
      </section>

      <FactSection
        title="Skills and tools"
        list={base.skills}
        kind="kompetencja"
        filter={filter}
        onChange={changed}
      />
      <FactSection
        title="Education, certificates, training"
        list={base.education}
        kind="edukacja"
        filter={filter}
        onChange={changed}
      />
      <FactSection title="Languages" list={base.languages} kind="język" filter={filter} onChange={changed} />

      <NoteDialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onDone={(b, added) => {
          setBase(structuredClone(b));
          loadedAt.current = b.updatedAt ?? null;
          setDirty(false);
          setFilter("to_verify");
          toast(`Added ${added} facts to confirm`);
        }}
        disabled={dirty}
      />
    </div>
  );
}

function RoleBlock({
  role: r,
  filter,
  onChange,
  onDelete,
}: {
  role: Role;
  filter: Filter;
  onChange: () => void;
  onDelete: () => void;
}) {
  const fld = (k: "title" | "company" | "contract" | "start" | "end", label: string, ph = "") => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        placeholder={ph}
        value={r[k] ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (k === "end") r.end = v.trim() ? v.trim() : null;
          else r[k] = v;
          onChange();
        }}
      />
    </label>
  );
  return (
    <div className="cv-role-block stack">
      <div className="cv-role-fields">
        {fld("title", "Official title")}
        {fld("company", "Company")}
        {fld("contract", "Contract (optional)")}
        {fld("start", "From (YYYY-MM or YYYY)", "2024-05")}
        {fld("end", "To (empty = ongoing)", "2025-06")}
        <label className="field">
          <span className="field-label">Dates as</span>
          <select
            className="select"
            value={r.dateFormat}
            onChange={(e) => {
              r.dateFormat = e.target.value as Role["dateFormat"];
              onChange();
            }}
          >
            <option value="month">month.year</option>
            <option value="year">year only</option>
          </select>
        </label>
      </div>
      <FactList list={r.facts} kind="obowiązek" filter={filter} onChange={onChange} />
      <div>
        <button type="button" className="btn btn-sm btn-quiet" onClick={onDelete}>
          <Trash2 size={13} /> Delete role
        </button>
      </div>
    </div>
  );
}

function FactSection(props: {
  title: string;
  list: Fact[];
  kind: string;
  filter: Filter;
  onChange: () => void;
}) {
  return (
    <section className="card card-pad stack">
      <h3 className="section-title" style={{ margin: 0 }}>
        {props.title}
      </h3>
      <FactList {...props} />
    </section>
  );
}

function FactList({
  list,
  kind,
  filter,
  onChange,
}: {
  list: Fact[];
  kind: string;
  filter: Filter;
  onChange: () => void;
}) {
  const confirm = (f: Fact) => {
    f.status = "confirmed";
    f.source = `${f.source ?? ""} · confirmed by you ${today()}`.replace(/^ · /, "");
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      {list
        .filter((f) => filter === "all" || f.status === filter)
        .map((f) => (
          <div key={f.id} className={`cv-fact cv-fact-${f.status}`}>
            <textarea
              className="textarea"
              rows={2}
              aria-label="Fact"
              value={f.text}
              onChange={(e) => {
                f.text = e.target.value;
                onChange();
              }}
            />
            <select
              className="select"
              aria-label="Kind"
              value={f.kind}
              onChange={(e) => {
                f.kind = e.target.value;
                onChange();
              }}
            >
              {[...new Set([...KINDS, f.kind])].map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Status"
              value={f.status}
              onChange={(e) => {
                const s = e.target.value as FactStatus;
                if (s === "confirmed") confirm(f);
                else f.status = s;
                onChange();
              }}
            >
              {FACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <div className="btn-group">
              {f.status !== "confirmed" ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  title="Mark as confirmed"
                  onClick={() => {
                    confirm(f);
                    onChange();
                  }}
                >
                  <Check size={13} /> Confirm
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                title="Delete this fact"
                onClick={() => {
                  list.splice(list.indexOf(f), 1);
                  onChange();
                }}
              >
                <Trash2 size={13} />
                <span className="sr-only">Delete</span>
              </button>
            </div>
            <div className="cv-fact-src xsmall muted">
              {f.id} · source: {f.source || "—"}
              {f.note ? ` · note: ${f.note}` : ""}
            </div>
          </div>
        ))}
      <div>
        <button
          type="button"
          className="btn btn-sm btn-quiet"
          onClick={() => {
            list.push({
              id: uid("f"),
              text: "",
              kind,
              status: "confirmed",
              source: `added by hand ${today()}`,
              note: "",
            });
            onChange();
          }}
        >
          <Plus size={13} /> Add a fact
        </button>
      </div>
    </div>
  );
}

function NoteDialog({
  open,
  onClose,
  onDone,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (b: ExperienceBase, added: number) => void;
  disabled: boolean;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ added: number; base: ExperienceBase }>("/api/cv/base/note", {
        body: { note },
      });
      onDone(r.base, r.added);
      setNote("");
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Claude could not read the note");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add facts from a note"
      description="Claude splits the note into facts and files them under your roles. New facts are marked “to confirm”: check and confirm them before they can be used."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={run}
            disabled={busy || !note.trim() || disabled}
          >
            {busy ? <span className="spinner" /> : <Sparkles size={14} />}{" "}
            {busy ? "Reading…" : "Split into facts"}
          </button>
        </>
      }
    >
      <div className="stack">
        {disabled ? (
          <Callout>
            <span>Save your changes to the base first.</span>
          </Callout>
        ) : null}
        <textarea
          className="textarea"
          rows={10}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="E.g. answers to the questions under a CV, a project description, campaign results…"
        />
        {err ? (
          <Callout tone="bad">
            <span>{err}</span>
          </Callout>
        ) : null}
      </div>
    </Dialog>
  );
}
