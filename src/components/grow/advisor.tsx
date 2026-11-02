"use client";

import { CheckCircle2, ExternalLink, RotateCcw, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { Markdown } from "./markdown";

type Msg = {
  id: string;
  role: string;
  content: string;
  links: { title: string; url: string; checked: boolean }[];
  createdAt: string;
};

/** The career advisor chat. One conversation per path, plus a general one. */
export function Advisor({
  thread,
  suggestions,
  aiConfigured,
}: {
  thread: string;
  suggestions: string[];
  aiConfigured: boolean;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await apiFetch<{ messages: Msg[] }>(`/api/advisor/${thread}`).catch(() => ({ messages: [] }));
    setMessages(r.messages);
  }, [thread]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (messages?.length) end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    const optimistic: Msg = {
      id: "pending",
      role: "user",
      content: question,
      links: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...(m ?? []), optimistic]);
    setQ("");
    try {
      const r = await apiFetch<{ messages: Msg[] }>(`/api/advisor/${thread}`, { body: { question } });
      setMessages(r.messages);
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== "pending"));
      setQ(question);
      toast(e instanceof ApiError ? e.message : "The advisor could not answer", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad advisor" aria-label="Career advisor">
      <header className="row-between">
        <div className="row" style={{ gap: 10 }}>
          <span className="metric-icon" style={{ marginBottom: 0, width: 38, height: 38 }}>
            <Sparkles size={18} />
          </span>
          <div>
            <h3 style={{ margin: 0 }}>Career advisor</h3>
            <span className="xsmall muted">
              Claude, with your CV, these paths and your job search in mind
            </span>
          </div>
        </div>
        {messages?.length ? (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={async () => {
              if (!window.confirm("Start this conversation over?")) return;
              await apiFetch(`/api/advisor/${thread}`, { method: "DELETE" });
              await load();
            }}
          >
            <RotateCcw size={13} /> New conversation
          </button>
        ) : null}
      </header>

      {!aiConfigured ? (
        <Callout tone="info">
          <span>
            Connect Claude (ANTHROPIC_API_KEY) to ask questions. The paths and links work without it.
          </span>
        </Callout>
      ) : null}

      <div className="chat" aria-live="polite">
        {messages?.map((m) => (
          <div key={m.id} className={`chat-msg chat-${m.role === "user" ? "me" : "ai"}`}>
            {m.role === "user" ? <p>{m.content}</p> : <Markdown text={m.content} />}
            {m.links.length ? (
              <ul className="chat-links">
                {m.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                      {l.title} <ExternalLink size={11} />
                    </a>
                    {l.checked ? (
                      <span className="xsmall link-checked" title="From the checked library">
                        <CheckCircle2 size={11} /> checked
                      </span>
                    ) : (
                      <span className="xsmall muted" title="Suggested by Claude; not in the checked library">
                        not checked
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {busy ? (
          <div className="chat-msg chat-ai">
            <span className="spinner" /> <span className="small muted">Thinking it through…</span>
          </div>
        ) : null}
        <div ref={end} />
      </div>

      {!messages?.length && suggestions.length ? (
        <div className="filter-chips">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chip chip-button"
              disabled={!aiConfigured || busy}
              onClick={() => ask(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <textarea
          className="textarea"
          rows={2}
          value={q}
          disabled={!aiConfigured}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(q);
            }
          }}
          placeholder="Ask anything: what the first year looks like, what to learn first, how to talk about the switch…"
          aria-label="Your question"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!aiConfigured || busy || q.trim().length < 2}
        >
          <Send size={14} /> Ask
        </button>
      </form>
      <p className="xsmall muted" style={{ margin: 0 }}>
        Answers can be wrong, especially about laws and pay. Links marked “checked” come from the curated
        library.
      </p>
    </section>
  );
}
