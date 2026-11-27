"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { bookmarkletHref, decodeSavedAd, type SavedAd } from "@/lib/jobs/bookmarklet";
import type { AiFit } from "@/server/db/schema";

const KEY = "tals_save";

type Fields = { url: string; title: string; companyName: string; location: string; description: string };
type Extracted = { title: string; company: string; location: string; workplace: string } | null;

function fromAd(ad: SavedAd): Fields {
  const location = ad.r && !/remote|zdaln/i.test(ad.l) ? [ad.l, "Remote"].filter(Boolean).join(" · ") : ad.l;
  return { url: ad.u, title: ad.t, companyName: ad.c, location, description: ad.x };
}

function message(e: unknown): string {
  return e instanceof ApiError
    ? e.message
    : "Could not reach the Studio. Check your connection and try again.";
}

export function SaveOffer() {
  const [f, setF] = useState<Fields | null>(null);
  const [ready, setReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; ai: AiFit | null; aiNote: string | null } | null>(null);

  useEffect(() => {
    // Keep the ad for a reload of this window: the #fragment is cleared from the address below.
    let hash = window.location.hash;
    try {
      if (decodeSavedAd(hash)) sessionStorage.setItem(KEY, hash);
      else hash = sessionStorage.getItem(KEY) ?? "";
    } catch {
      /* private mode: the fragment alone is enough */
    }
    const ad = decodeSavedAd(hash);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    setReady(true);
    if (!ad) return;
    const fields = fromAd(ad);
    setF(fields);
    if (fields.title && fields.companyName && fields.location) return;
    if (fields.description.length < 80) return;
    setReading(true);
    apiFetch<{ fields: Extracted }>("/api/jobs/extract", {
      body: { url: ad.u, pageTitle: ad.p, text: ad.x },
    })
      .then(({ fields: x }) => {
        if (!x) return;
        const where = x.location || (x.workplace === "remote" ? "Remote" : "");
        // Only fill what the page left blank: never overwrite what the owner can already see.
        setF((cur) =>
          cur
            ? {
                ...cur,
                title: cur.title || x.title,
                companyName: cur.companyName || x.company,
                location: cur.location || where,
              }
            : cur,
        );
      })
      .catch(() => undefined)
      .finally(() => setReading(false));
  }, []);

  async function save() {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiFetch<{ id: string }>("/api/jobs", {
        body: { ...f, location: f.location || null, description: f.description || null },
      });
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      setSaved({ id, ai: null, aiNote: "Claude is reading it against your CV…" });
      apiFetch<{ ai: AiFit }>(`/api/jobs/${id}/score`, { method: "POST" })
        .then(({ ai }) => setSaved({ id, ai, aiNote: null }))
        .catch((e) => setSaved({ id, ai: null, aiNote: message(e) }));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <span className="spinner" role="status" aria-label="Loading" />;
  if (!f) return <Setup />;

  if (saved) {
    return (
      <div className="stack">
        <div>
          <h1>Saved</h1>
          <p className="login-lead">
            {f.title} · {f.companyName} is in your Pipeline as Saved.
          </p>
        </div>
        {saved.ai ? (
          <div className="save-fit">
            <div className="save-score">
              <strong>{saved.ai.score}</strong>
              <span>fit</span>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <p>{saved.ai.summary}</p>
              {saved.ai.gaps.length > 0 && <p className="small secondary">Watch out: {saved.ai.gaps[0]}</p>}
            </div>
          </div>
        ) : (
          <p className="small secondary" role="status">
            {saved.aiNote?.startsWith("Claude") ? <span className="spinner" aria-hidden="true" /> : null}{" "}
            {saved.aiNote}
          </p>
        )}
        <div className="save-actions">
          <a className="btn btn-primary" href={`/matches?o=${saved.id}&area=all`} target="tals_studio">
            Open in Studio
          </a>
          <a className="btn" href={`/cv?offer=${saved.id}`} target="tals_studio">
            Tailor my CV
          </a>
          <button type="button" className="btn btn-quiet" onClick={() => window.close()}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });
  const host = (() => {
    try {
      return new URL(f.url).hostname.replace(/^www\./, "");
    } catch {
      return "the page";
    }
  })();

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <h1>Save to Studio</h1>
        <p className="login-lead">From {host}. Check the details, then save.</p>
      </div>
      {reading && (
        <p className="small secondary" role="status">
          <span className="spinner" aria-hidden="true" /> Reading the ad for the missing details…
        </p>
      )}
      <label className="field">
        <span className="field-label">Job title</span>
        <input
          className="input"
          value={f.title}
          onChange={set("title")}
          required
          minLength={2}
          maxLength={300}
        />
      </label>
      <label className="field">
        <span className="field-label">Company</span>
        <input
          className="input"
          value={f.companyName}
          onChange={set("companyName")}
          required
          maxLength={200}
          placeholder={reading ? "Reading…" : "Who is hiring?"}
        />
      </label>
      <label className="field">
        <span className="field-label">Place</span>
        <input
          className="input"
          value={f.location}
          onChange={set("location")}
          maxLength={300}
          placeholder={reading ? "Reading…" : "e.g. Warszawa, Poland · Hybrid"}
        />
      </label>
      <label className="field">
        <span className="field-label">The ad ({f.description.length.toLocaleString("en")} characters)</span>
        <textarea
          className="textarea"
          rows={6}
          value={f.description}
          onChange={set("description")}
          maxLength={20000}
        />
      </label>
      {error && (
        <p role="alert" className="small" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
      <button
        className="btn btn-primary btn-lg"
        type="submit"
        disabled={busy || f.title.trim().length < 2 || !f.companyName.trim()}
      >
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        Save and score
      </button>
    </form>
  );
}

/** Shown when /save is opened directly: the button to drag to the bookmarks bar. */
function Setup() {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React refuses javascript: URLs in JSX, so the bookmarklet is set on the element directly.
    link.current?.setAttribute("href", bookmarkletHref(window.location.origin));
  }, []);
  return (
    <div className="stack">
      <div>
        <h1>Save to Studio</h1>
        <p className="login-lead">One click to bring any job ad into your Studio.</p>
      </div>
      <ol className="save-steps">
        <li>
          Show your bookmarks bar (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>, or <kbd>⌘</kbd>+
          <kbd>Shift</kbd>+<kbd>B</kbd> on a Mac).
        </li>
        <li>Drag this button onto the bar:</li>
      </ol>
      {/* biome-ignore lint/a11y/useValidAnchor: a bookmarklet must be a link to be dragged to the bookmarks bar; clicking it here does nothing. */}
      <a
        ref={link}
        className="btn btn-primary btn-lg save-bookmarklet"
        href="#drag"
        onClick={(e) => {
          e.preventDefault();
        }}
        title="Drag me to your bookmarks bar"
      >
        ＋ Save to Studio
      </a>
      <ol className="save-steps" start={3}>
        <li>On Pracuj.pl, RocketJobs, LinkedIn or any job site, open an ad and click the bookmark.</li>
        <li>
          A small window opens here with the ad filled in. Check it and press Save: Claude scores it at once.
        </li>
      </ol>
      <p className="small secondary">
        Tip: if a page shows the ad oddly, select the ad text first, then click the bookmark. Only what you
        select is sent.
      </p>
    </div>
  );
}
