"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { CallRow } from "@/lib/types";

export default function CallHistoryPage() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ calls: CallRow[] }>("/api/calls")
      .then((d) =>
        setRows(d.calls.filter((c) => c.status !== "ringing" && c.status !== "in_progress")),
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Performance archive</p>
        <h2 className="text-2xl font-semibold">Call History</h2>
      </div>
      {error && <p className="text-danger">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Customer name</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Call duration</th>
              <th className="px-4 py-3 font-medium">Call type</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">Final rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-line hover:bg-canvas/70">
                <td className="px-4 py-3">
                  <Link href={`/student/history/${c.id}`} className="font-medium text-navy hover:underline">
                    {c.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(c.startedAt)}</td>
                <td className="px-4 py-3 font-mono">{formatDuration(c.durationSeconds)}</td>
                <td className="px-4 py-3">{c.callType}</td>
                <td className="px-4 py-3">
                  {c.status === "missed" ? (
                    <Pill tone="danger">Missed</Pill>
                  ) : c.status === "rejected" ? (
                    <Pill tone="warn">Rejected</Pill>
                  ) : c.transferred ? (
                    <Pill tone="warn">Transferred</Pill>
                  ) : (
                    <Pill tone="ok">Completed</Pill>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.overallRating != null ? (
                    <Pill tone={c.overallRating >= 85 ? "ok" : c.overallRating >= 70 ? "warn" : "danger"}>
                      {c.overallRating}
                    </Pill>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No completed calls yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
