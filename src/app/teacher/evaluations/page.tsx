"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Panel, Pill } from "@/components/ui";
import { StarRating } from "@/components/Rating";
import { api } from "@/lib/client";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { CallRow } from "@/lib/types";
import { scoreToStars } from "@/lib/progress";

type EvalRow = {
  id: string;
  callId: string;
  studentId: string;
  scores: Record<string, number>;
  overall: number;
  feedback: string;
  coachingNotes: string;
  improvementPlan: string;
  recognition: string;
  released: boolean;
  updatedAt: string;
};

export default function EvaluationsPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"pending" | "evaluated" | "all">("pending");

  useEffect(() => {
    Promise.all([
      api<{ calls: CallRow[] }>("/api/calls"),
      api<{ evaluations: EvalRow[] }>("/api/evaluations"),
    ])
      .then(([c, e]) => {
        setCalls(c.calls.filter((x) => x.status === "completed"));
        setEvals(e.evaluations);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const byCall = useMemo(() => new Map(evals.map((e) => [e.callId, e])), [evals]);
  const rows = useMemo(() => {
    if (filter === "pending") return calls.filter((c) => !byCall.has(c.id));
    if (filter === "evaluated") return calls.filter((c) => byCall.has(c.id));
    return calls;
  }, [calls, filter, byCall]);

  const avg = evals.length ? Math.round(evals.reduce((a, e) => a + e.overall, 0) / evals.length) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Quality assurance</p>
          <h2 className="text-2xl font-semibold">Evaluations & Ratings</h2>
          <p className="text-sm text-muted">
            Seven QA categories on a 1–5 star scale. Overall scores write to the student record.
          </p>
        </div>
        <div className="flex gap-2">
          {(["pending", "evaluated", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                filter === f ? "bg-navy text-white" : "bg-white ring-1 ring-line"
              }`}
            >
              {f} ({f === "pending" ? calls.length - byCall.size : f === "evaluated" ? byCall.size : calls.length})
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-danger">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Evaluations filed">
          <p className="font-mono text-3xl">{evals.length}</p>
        </Panel>
        <Panel title="Average evaluation">
          <div className="flex items-center gap-3">
            <p className="font-mono text-3xl">{avg || "—"}</p>
            <StarRating value={scoreToStars(avg)} readOnly size="sm" />
          </div>
        </Panel>
        <Panel title="Awaiting teacher score">
          <p className="font-mono text-3xl">{calls.length - byCall.size}</p>
        </Panel>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-[11px] uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Queue</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">AI</th>
              <th className="px-4 py-3">Supervisor</th>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const ev = byCall.get(c.id);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3">{c.studentName}</td>
                  <td className="px-4 py-3">
                    <Link href={`/teacher/evaluations/${c.id}`} className="font-medium text-navy hover:underline">
                      {c.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.callType}</td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDateTime(c.startedAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDuration(c.durationSeconds)}</td>
                  <td className="px-4 py-3 font-mono">{c.aiScores?.overall ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.supervisor ? (
                      <Pill tone={c.supervisor.rating >= 85 ? "ok" : c.supervisor.rating >= 70 ? "warn" : "danger"}>
                        {c.supervisor.rating}
                      </Pill>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ev ? (
                      <span className="flex items-center gap-2">
                        <StarRating value={scoreToStars(ev.overall)} readOnly size="sm" />
                        <span className="font-mono text-xs">{ev.overall}</span>
                      </span>
                    ) : (
                      <Pill tone="warn">Pending</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/teacher/evaluations/${c.id}`} className="text-xs font-medium text-accent-2">
                      {ev ? "Review" : "Evaluate"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  Nothing in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
