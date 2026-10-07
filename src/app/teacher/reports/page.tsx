"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Panel, Pill, StatCard } from "@/components/ui";
import { BarChart, Donut, GroupedBars, LineChart } from "@/components/Charts";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/utils";

type Report = {
  summary: {
    totalCalls: number;
    completed: number;
    averageRating: number;
    averageHandleTime: number;
    evaluationsFiled: number;
    averageEvaluation: number;
    supervisorAverage: number;
    authComplianceRate: number;
    documentationRate: number;
    transferred: number;
    rejected: number;
  };
  ratingsTrend: { label: string; overall: number; teacher: number; ai: number; supervisor: number; callId: string; callType: string }[];
  completionTrend: { label: string; completed: number; started: number }[];
  skillTrend: { skill: string; before: number; after: number }[];
  volumeByQueue: { name: string; color: string; handled: number }[];
  ranking: { id: string; name: string; agentId: string | null; totalCalls: number; averageRating: number; supervisorAverage: number; evaluations: number }[];
  supervisorFindings: {
    callId: string;
    callType: string;
    rating: number;
    verdict: string;
    missedAuthSteps: string[];
    missedDocumentation: string[];
    complianceFindings: string[];
  }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Report>("/api/teacher/reports")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Compiling reports…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Business intelligence</p>
          <h2 className="text-2xl font-semibold">Reports & Analytics</h2>
          <p className="text-sm text-muted">
            Performance, completion, volume, AI evaluation, and supervisor audit reporting.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Printer className="h-4 w-4" /> Export / print
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed Calls" value={data.summary.completed} tone="navy" hint={`${data.summary.totalCalls} total attempted`} />
        <StatCard label="Average Student Rating" value={data.summary.averageRating || "—"} tone="gold" />
        <StatCard label="Average Handle Time" value={formatDuration(data.summary.averageHandleTime)} tone="teal" />
        <StatCard label="Supervisor Average" value={data.summary.supervisorAverage || "—"} tone="rose" hint="Automated audit" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Auth Compliance" value={`${data.summary.authComplianceRate}%`} tone="teal" hint="Contacts with clean verification" />
        <StatCard label="Documentation Rate" value={`${data.summary.documentationRate}%`} tone="navy" hint="Complete CRM notes" />
        <StatCard label="Evaluations Filed" value={data.summary.evaluationsFiled} tone="gold" hint={`Avg ${data.summary.averageEvaluation || "—"}`} />
        <StatCard label="Transferred / Rejected" value={`${data.summary.transferred} / ${data.summary.rejected}`} tone="slate" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Ratings trend (per contact)">
          {data.ratingsTrend.length > 1 ? (
            <LineChart
              series={data.ratingsTrend.map((r) => ({
                label: r.label,
                values: [
                  { name: "Overall", color: "#0b1d36", value: r.overall },
                  { name: "Teacher", color: "#12b5a7", value: r.teacher },
                  { name: "AI", color: "#d4a24a", value: r.ai },
                  { name: "Supervisor", color: "#dc4a4a", value: r.supervisor },
                ],
              }))}
            />
          ) : (
            <p className="text-sm text-muted">Need at least two completed contacts to plot a trend.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
            {[
              ["Overall", "#0b1d36"],
              ["Teacher", "#12b5a7"],
              ["AI", "#d4a24a"],
              ["Supervisor", "#dc4a4a"],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1">
                <span className="h-2 w-4 rounded-sm" style={{ background: color }} /> {label}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Call completion trend (last 7 days)">
          <BarChart data={data.completionTrend.map((c) => ({ label: c.label, value: c.completed }))} />
          <div className="mt-4">
            <BarChart data={data.completionTrend.map((c) => ({ label: c.label, value: c.started }))} color="#0b1d36" />
            <p className="mt-1 text-[11px] text-muted">Top: completed · Bottom: calls started (incl. rejected)</p>
          </div>
        </Panel>

        <Panel title="Skill improvement trend (early vs recent)">
          <GroupedBars data={data.skillTrend} beforeLabel="Earliest half" afterLabel="Recent half" />
        </Panel>

        <Panel title="Call volume by queue">
          {data.volumeByQueue.some((q) => q.handled > 0) ? (
            <Donut
              segments={data.volumeByQueue.filter((q) => q.handled > 0).map((q) => ({ name: q.name, value: q.handled, color: q.color }))}
              centerLabel="completed"
              centerValue={String(data.summary.completed)}
            />
          ) : (
            <p className="text-sm text-muted">No completed contacts by queue yet.</p>
          )}
        </Panel>
      </div>

      <Panel title="Student performance report — top performer rankings">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-muted">
              <tr>
                <th className="pb-2 font-medium">Rank</th>
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium">Calls</th>
                <th className="pb-2 font-medium">Average rating</th>
                <th className="pb-2 font-medium">Supervisor avg</th>
                <th className="pb-2 font-medium">Evaluations</th>
              </tr>
            </thead>
            <tbody>
              {data.ranking.map((r, i) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-3 font-mono text-muted">{i + 1}</td>
                  <td className="py-3">
                    <Link href={`/teacher/students/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted">{r.agentId}</p>
                  </td>
                  <td className="py-3 font-mono">{r.totalCalls}</td>
                  <td className="py-3">
                    <Pill tone={r.averageRating >= 85 ? "ok" : r.averageRating >= 70 ? "warn" : "danger"}>
                      {r.averageRating}
                    </Pill>
                  </td>
                  <td className="py-3 font-mono">{r.supervisorAverage || "—"}</td>
                  <td className="py-3 font-mono">{r.evaluations}</td>
                </tr>
              ))}
              {data.ranking.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No ranked performance data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="AI evaluation report — supervisor findings">
        <div className="grid gap-3 md:grid-cols-2">
          {data.supervisorFindings.map((f) => (
            <div key={f.callId} className="rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{f.callType}</p>
                  <Link href={`/teacher/evaluations/${f.callId}`} className="text-[11px] text-accent-2">
                    Open contact
                  </Link>
                </div>
                <Pill tone={f.rating >= 85 ? "ok" : f.rating >= 70 ? "warn" : "danger"}>{f.rating}</Pill>
              </div>
              <p className="mt-1 text-xs text-muted">{f.verdict}</p>
              {f.missedAuthSteps.length > 0 && (
                <p className="mt-2 text-xs text-danger">Auth gaps: {f.missedAuthSteps.length}</p>
              )}
              {f.missedDocumentation.length > 0 && (
                <p className="text-xs text-amber-700">Documentation gaps: {f.missedDocumentation.length}</p>
              )}
              {f.complianceFindings.length > 0 && (
                <p className="text-xs text-muted">Compliance notes: {f.complianceFindings.length}</p>
              )}
            </div>
          ))}
          {data.supervisorFindings.length === 0 && (
            <p className="text-sm text-muted">No supervisor audits yet — complete a simulation first.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
