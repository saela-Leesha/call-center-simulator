"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, Pill, StatCard } from "@/components/ui";
import { ProgressRing } from "@/components/Rating";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  email: string;
  agentId: string | null;
  totalCalls: number;
  averageRating: number;
  completionRate: number;
  progressLevel: string;
  progressPercent: number;
  evaluations: number;
  certificates: number;
  lastActive: string;
};

type Overview = {
  stats: { totalStudents: number; completedCalls: number; averageStudentRating: number };
  students: Row[];
};

export default function StudentManagementPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<Overview>("/api/teacher/overview")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading roster…</p>;

  const rows = data.students.filter((s) =>
    `${s.name} ${s.email} ${s.agentId ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const avgCompletion = data.students.length
    ? Math.round(data.students.reduce((a, s) => a + s.completionRate, 0) / data.students.length)
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Workforce</p>
        <h2 className="text-2xl font-semibold">Student Management</h2>
        <p className="text-sm text-muted">
          Open a student profile to review their call history, voice recordings, transcripts, and
          documentation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={data.stats.totalStudents} tone="navy" />
        <StatCard label="Completed Calls" value={data.stats.completedCalls} tone="teal" />
        <StatCard label="Average Rating" value={data.stats.averageStudentRating || "—"} tone="gold" />
        <StatCard label="Avg Completion Rate" value={`${avgCompletion}%`} tone="rose" />
      </div>

      <Panel
        title="Roster"
        action={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, agent ID"
            className="w-56 rounded-lg border border-line px-3 py-1.5 text-xs"
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Total Calls</th>
                <th className="pb-2 font-medium">Average Rating</th>
                <th className="pb-2 font-medium">Completion Rate</th>
                <th className="pb-2 font-medium">Progress Level</th>
                <th className="pb-2 font-medium">Last Active</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-3">
                    <Link href={`/teacher/students/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted">{s.agentId}</p>
                  </td>
                  <td className="py-3 text-xs text-muted">{s.email}</td>
                  <td className="py-3 font-mono">{s.totalCalls}</td>
                  <td className="py-3">
                    <Pill tone={s.averageRating >= 85 ? "ok" : s.averageRating >= 70 ? "warn" : s.averageRating ? "danger" : "slate"}>
                      {s.averageRating || "—"}
                    </Pill>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-accent-2" style={{ width: `${s.completionRate}%` }} />
                      </div>
                      <span className="font-mono text-xs">{s.completionRate}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <Pill tone="navy">{s.progressLevel}</Pill>
                  </td>
                  <td className="py-3 text-xs text-muted">{formatDate(s.lastActive)}</td>
                  <td className="py-3 text-right">
                    <Link href={`/teacher/students/${s.id}`} className="text-xs font-medium text-accent-2">
                      Open profile
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No students match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.students.slice(0, 6).map((s) => (
          <Panel key={s.id} title={s.name} action={<Pill tone="navy">{s.progressLevel}</Pill>}>
            <ProgressRing percent={s.progressPercent} label="progress" />
            <p className="mt-3 text-xs text-muted">
              {s.totalCalls} calls · {s.evaluations} evaluations · {s.certificates} certificates
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
