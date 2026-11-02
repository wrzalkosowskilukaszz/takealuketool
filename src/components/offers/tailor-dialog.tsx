"use client";

import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { LANGUAGE_LABEL } from "@/lib/jobs/match";
import { splitTailored } from "@/lib/jobs/tailor";
import type { TailoredCv } from "@/server/careers/service";

/**
 * CV tailored to one offer: the app checks the offer's keywords against the CV and prepares a prompt;
 * Łukasz runs it in Claude or ChatGPT, pastes the answer back and downloads a Word file.
 */
export function TailorDialog({
  id,
  title,
  company,
  open,
  onClose,
  onSaved,
}: {
  id: string;
  title: string;
  company: string;
  open: boolean;
  onClose: () => void;
  onSaved: (savedAt: string | null) => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<TailoredCv | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"saved" | "pending">("saved");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      const r = await apiFetch<{ savedAt: string | null }>(`/api/jobs/${id}/tailored`, {
        method: "PUT",
        body: { text: textRef.current },
      });
      setState("saved");
      onSaved(r.savedAt);
    } catch {
      toast("The CV was not saved", "error");
    }
  }, [id, toast, onSaved]);

  useEffect(() => {
    if (!open) return;
    setD(null);
    setCopied(false);
    apiFetch<TailoredCv>(`/api/jobs/${id}/tailored`)
      .then((x) => {
        setD(x);
        setText(x.text);
        textRef.current = x.text;
        setState("saved");
      })
      .catch(() => toast("Could not load", "error"));
  }, [open, id, toast]);

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

  async function copyPrompt() {
    try {
      const r = await apiFetch<{ prompt: string }>(`/api/jobs/${id}/tailored/prompt`, { body: {} });
      await navigator.clipboard.writeText(r.prompt);
      setCopied(true);
      toast("Copied. Paste it into Claude or ChatGPT.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Not copied", "error");
    }
  }

  const { cv, checks } = splitTailored(text);
  async function download() {
    if (timer.current || state === "pending") await save();
    window.location.assign(`/api/jobs/${id}/tailored/docx`);
  }

  const lang = d?.language ? LANGUAGE_LABEL[d.language] : null;
  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Tailor your CV to this offer"
      description={`${title} · ${company}`}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={close}>
            Close
          </button>
          {cv ? (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(cv);
                toast("CV copied");
              }}
            >
              <Copy size={14} /> Copy CV
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={download} disabled={!cv}>
            <Download size={14} /> Word (.docx)
          </button>
        </>
      }
    >
      {!d ? (
        <div className="stack">
          {[70, 90, 60].map((w) => (
            <span key={w} className="skeleton" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : !d.hasCv ? (
        <Callout tone="info">
          <span>Upload your CV in Settings first. Without it there is nothing to tailor.</span>
        </Callout>
      ) : (
        <div className="stack-lg">
          <section className="stack" style={{ gap: 8 }}>
            <h4 className="section-title" style={{ margin: 0 }}>
              Keywords from the offer
            </h4>
            {d.gap.inCv.length + d.gap.missing.length === 0 ? (
              <p className="small muted">
                This offer has none of the usual keywords from your field. The prompt still tailors the CV to
                the whole ad.
              </p>
            ) : (
              <>
                {d.gap.missing.length ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="xsmall muted">Not visible in your CV</span>
                    <div className="job-reasons">
                      {d.gap.missing.map((w) => (
                        <span key={w} className="reason reason-warn">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {d.gap.inCv.length ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="xsmall muted">Already in your CV</span>
                    <div className="job-reasons">
                      {d.gap.inCv.map((w) => (
                        <span key={w} className="reason reason-good">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="xsmall muted">Add missing ones only if you really have that experience.</p>
              </>
            )}
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h4 className="section-title" style={{ margin: 0 }}>
              1. Copy the prompt
            </h4>
            <p className="small secondary" style={{ margin: 0 }}>
              It contains the offer and your CV{d.cvFilename ? ` (${d.cvFilename})` : ""}. The CV will be
              written in {lang ?? "the offer's language"}. The prompt forbids adding anything that is not in
              your CV.
            </p>
            <div className="btn-group">
              <button type="button" className="btn btn-primary btn-sm" onClick={copyPrompt}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy prompt"}
              </button>
              <a
                className="btn btn-quiet btn-sm"
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Claude <ExternalLink size={12} />
              </a>
              <a
                className="btn btn-quiet btn-sm"
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ChatGPT <ExternalLink size={12} />
              </a>
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h4 className="section-title" style={{ margin: 0 }}>
              2. Paste the answer
              <span className="xsmall muted" aria-live="polite" style={{ fontWeight: 400 }}>
                {state === "pending" ? "Saving…" : text ? "Saved with this offer" : ""}
              </span>
            </h4>
            <textarea
              className="textarea"
              rows={10}
              value={text}
              aria-label="CV tailored to this offer"
              onChange={(e) => {
                setText(e.target.value);
                textRef.current = e.target.value;
                setState("pending");
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => void save(), 800);
              }}
              placeholder="Paste the whole answer here…"
            />
            <p className="xsmall muted" style={{ margin: 0 }}>
              The “To check” part is left out of the Word file.
            </p>
          </section>

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
        </div>
      )}
    </Dialog>
  );
}
