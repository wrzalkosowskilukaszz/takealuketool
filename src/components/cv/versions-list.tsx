"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { CvVersionRow } from "@/server/cv/service";

const STAGE: Record<string, string> = {
  new: "not started",
  analyzed: "analyzed",
  drafted: "not checked",
  failed: "failed",
};

export function VersionsList({ initial }: { initial: CvVersionRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState(initial);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok);
      setRows((await apiFetch<{ versions: CvVersionRow[] }>("/api/cv/versions")).versions);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
    }
  }

  if (!rows.length)
    return (
      <Empty
        icon={<FileText size={28} />}
        title="No CVs yet"
        actions={
          <Link className="btn btn-primary" href="/cv">
            Write your first CV
          </Link>
        }
      >
        Paste a posting, or use Tailor CV on any offer.
      </Empty>
    );

  return (
    <div className="card table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Position</th>
            <th>Date</th>
            <th>Language</th>
            <th>Check</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="cell-primary">
                <Link href={`/cv/${v.id}`}>{v.company || "—"}</Link>
              </td>
              <td>{v.position || "—"}</td>
              <td className="tabular small">
                {new Date(v.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="small">{(v.language ?? "").toUpperCase()}</td>
              <td>
                {v.stage !== "done" ? (
                  <span className="tag tag-warn">{STAGE[v.stage] ?? v.stage}</span>
                ) : v.issues ? (
                  <span className="tag tag-warn">{v.issues} notes</span>
                ) : (
                  <span className="tag tag-ok">checked</span>
                )}
              </td>
              <td>
                <div className="btn-group" style={{ justifyContent: "flex-end" }}>
                  <Link className="btn btn-sm" href={`/cv/${v.id}`}>
                    Open
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() =>
                      act(() => apiFetch(`/api/cv/versions/${v.id}/duplicate`, { body: {} }), "Copied")
                    }
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete “${v.position} — ${v.company}”? Your experience base stays as it is.`,
                        )
                      )
                        void act(() => apiFetch(`/api/cv/versions/${v.id}`, { method: "DELETE" }), "Deleted");
                    }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
