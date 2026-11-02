"use client";

import { Copy, Download, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";

/**
 * A cover letter for one offer: Claude drafts it from the CV and the ad (English or Polish), Łukasz edits
 * it here. Edits save as he types; the letter downloads as a Word file.
 */
export function LetterDialog({
  id,
  title,
  company,
  initial,
  initialLang,
  adLanguage,
  open,
  onClose,
  onSaved,
}: {
  id: string;
  title: string;
  company: string;
  initial: string | null;
  initialLang: string | null;
  adLanguage: string;
  open: boolean;
  onClose: () => void;
  onSaved: (at: string | null) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "pl">("en");
  const [length, setLength] = useState<"short" | "standard">("standard");
  const [extra, setExtra] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"saved" | "pending">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");

  useEffect(() => {
    if (!open) return;
    setText(initial ?? "");
    textRef.current = initial ?? "";
    setLang(initialLang === "pl" || (!initialLang && adLanguage === "pl") ? "pl" : "en");
    setChecks([]);
    setState("saved");
  }, [open, initial, initialLang, adLanguage]);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      const r = await apiFetch<{ at: string | null }>(`/api/jobs/${id}/letter`, {
        method: "PUT",
        body: { text: textRef.current, language: lang },
      });
      setState("saved");
      onSaved(r.at);
    } catch {
      toast("The letter was not saved", "error");
    }
  }, [id, lang, toast, onSaved]);

  useEffect(
    () => () => {
      if (timer.current) void save();
    },
    [save],
  );

  function close() {
    if (timer.current) void save();
    onClose();
  }

  async function draft() {
    if (text.trim() && !window.confirm("Replace the current letter with a new draft?")) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ letter: string; checks: string[]; at: string }>(`/api/jobs/${id}/letter`, {
        body: { language: lang, length, extra: extra.trim() || undefined },
      });
      setText(r.letter);
      textRef.current = r.letter;
      setChecks(r.checks);
      setState("saved");
      onSaved(r.at);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Claude could not draft the letter", "error");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (timer.current || state === "pending") await save();
    window.location.assign(`/api/jobs/${id}/letter/docx`);
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Cover letter"
      description={`${title} · ${company}`}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={close}>
            Close
          </button>
          <button
            type="button"
            className="btn"
            disabled={!text.trim()}
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              toast("Copied");
            }}
          >
            <Copy size={14} /> Copy
          </button>
          <button type="button" className="btn btn-primary" onClick={download} disabled={!text.trim()}>
            <Download size={14} /> Word (.docx)
          </button>
        </>
      }
    >
      <div className="stack-lg">
        <div className="row wrap" style={{ gap: 12, alignItems: "flex-end" }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="field-label">Language</span>
            <div className="segmented" role="toolbar" aria-label="Language">
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                English
              </button>
              <button type="button" aria-pressed={lang === "pl"} onClick={() => setLang("pl")}>
                Polish
              </button>
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="field-label">Length</span>
            <div className="segmented" role="toolbar" aria-label="Length">
              <button type="button" aria-pressed={length === "short"} onClick={() => setLength("short")}>
                Short
              </button>
              <button
                type="button"
                aria-pressed={length === "standard"}
                onClick={() => setLength("standard")}
              >
                Standard
              </button>
            </div>
          </div>
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            <span className="field-label">Anything to stress (optional)</span>
            <input
              className="input"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. mention the AI campaign for…, keep it playful"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={draft} disabled={busy}>
            {busy ? <span className="spinner" /> : <Sparkles size={14} />}{" "}
            {busy ? "Claude is writing…" : text.trim() ? "Redraft" : "Draft with Claude"}
          </button>
        </div>

        <label className="field">
          <span className="field-label">
            Letter{" "}
            <span className="xsmall muted" aria-live="polite" style={{ fontWeight: 400 }}>
              {state === "pending" ? "Saving…" : text ? "Saved with this offer" : ""}
            </span>
          </span>
          <textarea
            className="textarea letter-editor"
            rows={16}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              textRef.current = e.target.value;
              setState("pending");
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => void save(), 800);
            }}
            placeholder="Draft with Claude, or write your own letter here."
          />
        </label>

        {checks.length ? (
          <Callout>
            <strong>Check before sending</strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <p className="xsmall muted" style={{ margin: 0 }}>
          Claude uses only facts from your CV and is told never to invent experience. Read the whole letter
          before sending anyway.
        </p>
      </div>
    </Dialog>
  );
}
