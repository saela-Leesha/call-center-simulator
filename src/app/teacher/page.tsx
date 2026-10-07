"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Bot, ClipboardCheck, Headset, Users } from "lucide-react";
import { Panel, Pill, StatCard } from "@/components/ui";
import { BarChart, Donut } from "@/components/Charts";
import { ProgressRing } from "@/components/Rating";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";
import type { CallRow } from "@/lib/types";

type Overview = {
  config: { cohortName: string; passingScore: number; floorTarget: number } | null;
  stats: {
    totalStudents: number;
    activeSimulations: number;
    completedCalls: number;
    averageStudentRating: number;
    supervisorAverage: number;
    pendingEvaluations: number;
    customers: number;
    activeCustomers: number;
    categories: number;
    certificatesIssued: number;
    unreadMessages: number;
  };
  topStudents: {
    id: string;
    name: string;
    averageRating: number;
    totalCalls: number;
    progressLevel: string;
  }[];
  students: {
    id: string;
    name: string;
    averageRating: number;
    completionRate: number;
    progressLevel: string;
    progressPercent: number;
  }[];
  recentActivities: { id: string; kind: string; title: string; detail: string; at: string; link: string }[];
  recentCalls: CallRow[];
  queueMix: { name: string; color: string; count: number; handled: number }[];
};

export default function TeacherDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Overview>("/api/teacher/overview")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading operations console…</p>;

  const segments = data.queueMix.filter((q) => q.handled > 0);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-navy text-white">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">
              {data.config?.cohortName ?? "Nesting Wave 14"} · Quality & Training
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Teacher Management Console</h2>
            <p className="mt-3 max-w-xl text-sm text-white/70">
              Manage customer profiles, scenario queues, student progress, QA evaluations,
              communications, certificates, and analytics from one floor console.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/teacher/customers" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-navy">
                Manage customers
              </Link>
              <Link href="/teacher/evaluations" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">
                {data.stats.pendingEvaluations} call(s) to evaluate
              </Link>
            </div>
          </div>
          <img src="/images/team.jpg" alt="Training floor" className="hidden h-full w-full object-cover opacity-80 lg:block" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={data.stats.totalStudents} tone="navy" hint="Rostered agents" />
        <StatCard label="Active Simulations" value={data.stats.activeSimulations} tone="teal" hint="Live or ringing now" />
        <StatCard label="Completed Calls" value={data.stats.completedCalls} tone="gold" hint="Voice contacts archived" />
        <StatCard
          label="Average Student Rating"
          value={data.stats.averageStudentRating || "—"}
          tone="rose"
          hint={`Supervisor avg ${data.stats.supervisorAverage || "—"}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Top performing students"
          action={<Link href="/teacher/students" className="text-xs text-accent-2">Full roster</Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Calls</th>
                  <th className="pb-2 font-medium">Rating</th>
                  <th className="pb-2 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {data.topStudents.map((s, i) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-3 font-mono text-muted">{i + 1}</td>
                    <td className="py-3">
                      <Link href={`/teacher/students/${s.id}`} className="font-medium hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-3 font-mono">{s.totalCalls}</td>
                    <td className="py-3">
                      <Pill tone={s.averageRating >= 85 ? "ok" : s.averageRating >= 70 ? "warn" : "danger"}>
                        {s.averageRating}
                      </Pill>
                    </td>
                    <td className="py-3 text-xs text-muted">{s.progressLevel}</td>
                  </tr>
                ))}
                {data.topStudents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      No rated contacts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent activities">
          <ul className="space-y-2">
            {data.recentActivities.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.link}
                  className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-canvas"
                >
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      a.kind === "certificate"
                        ? "bg-gold/15 text-gold"
                        : a.kind === "evaluation"
                          ? "bg-teal-50 text-accent-2"
                          : "bg-navy/8 text-navy"
                    }`}
                  >
                    {a.kind === "certificate" ? (
                      <Award className="h-3.5 w-3.5" />
                    ) : a.kind === "evaluation" ? (
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Headset className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted">{a.detail}</span>
                    <span className="block text-[10px] text-muted">{formatDateTime(a.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {data.recentActivities.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Queue volume handled">
          {segments.length ? (
            <Donut
              segments={segments.map((q) => ({ name: q.name, value: q.handled, color: q.color }))}
              centerLabel="completed calls"
              centerValue={String(data.stats.completedCalls)}
            />
          ) : (
            <p className="text-sm text-muted">No completed contacts by queue yet.</p>
          )}
        </Panel>
        <Panel title="Roster progress level">
          <div className="space-y-3">
            {data.students.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <Users className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-xs">
                    <Link href={`/teacher/students/${s.id}`} className="truncate font-medium hover:underline">
                      {s.name}
                    </Link>
                    <span className="text-muted">
                      {s.completionRate}% complete · avg {s.averageRating || "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-accent-2" style={{ width: `${s.progressPercent}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{s.progressLevel}</p>
                </div>
              </div>
            ))}
            {data.students.length === 0 && <p className="text-sm text-muted">No students rostered.</p>}
          </div>
        </Panel>
      </div>

      <Panel title="AI Supervisor watchlist">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-canvas p-4">
            <p className="flex items-center gap-1 text-xs uppercase text-muted">
              <Bot className="h-3.5 w-3.5" /> Supervisor average
            </p>
            <p className="font-mono text-3xl">{data.stats.supervisorAverage || "—"}</p>
            <p className="mt-1 text-xs text-muted">Automated post-call audit score</p>
          </div>
          <div className="rounded-2xl bg-canvas p-4">
            <p className="text-xs uppercase text-muted">Passing threshold</p>
            <p className="font-mono text-3xl">{data.config?.passingScore ?? 75}</p>
            <p className="mt-1 text-xs text-muted">Floor target {data.config?.floorTarget ?? 85}</p>
          </div>
          <div className="rounded-2xl bg-canvas p-4">
            <p className="text-xs uppercase text-muted">Evaluations pending</p>
            <p className="font-mono text-3xl">{data.stats.pendingEvaluations}</p>
            <ProgressRing
              percent={
                data.stats.completedCalls
                  ? Math.round(
                      ((data.stats.completedCalls - data.stats.pendingEvaluations) /
                        data.stats.completedCalls) *
                        100,
                    )
                  : 0
              }
              label="reviewed"
            />
          </div>
        </div>
        <div className="mt-5">
          <BarChart
            data={data.queueMix.map((q) => ({ label: q.name.split(" ")[0], value: q.handled }))}
          />
        </div>
      </Panel>
    </div>
  );
}
