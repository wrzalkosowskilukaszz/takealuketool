"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api-client";

export function FollowButton({ slug, followed }: { slug: string; followed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(followed);
  return (
    <button
      type="button"
      className={`btn btn-sm ${on ? "" : "btn-quiet"}`}
      aria-pressed={on}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn(!on);
        await apiFetch("/api/grow", { method: "PATCH", body: { slug, followed: !on } });
        toast(on ? "Unfollowed" : "Following: the advisor will keep it in mind");
        router.refresh();
      }}
    >
      <Star size={13} className={on ? "star-on" : ""} /> {on ? "Following" : "Follow"}
    </button>
  );
}

export function PathNotes({ slug, initial }: { slug: string; initial: string }) {
  const toast = useToast();
  const [note, setNote] = useState(initial);
  const [state, setState] = useState<"saved" | "pending">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef(initial);
  const save = async () => {
    timer.current = null;
    await apiFetch("/api/grow", { method: "PATCH", body: { slug, note: ref.current } }).catch(() =>
      toast("Notes not saved", "error"),
    );
    setState("saved");
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void apiFetch("/api/grow", { method: "PATCH", body: { slug, note: ref.current } }).catch(() => null);
      }
    },
    [slug],
  );
  return (
    <label className="field">
      <span className="field-label">
        Your notes{" "}
        <span className="xsmall muted" style={{ fontWeight: 400 }} aria-live="polite">
          {state === "pending" ? "Saving…" : note ? "Saved" : ""}
        </span>
      </span>
      <textarea
        className="textarea"
        rows={4}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          ref.current = e.target.value;
          setState("pending");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(), 800);
        }}
        placeholder="People you talked to, what surprised you, what you would try first…"
      />
      <span className="field-hint">The advisor reads these when you ask about this path.</span>
    </label>
  );
}
