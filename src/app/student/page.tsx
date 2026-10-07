"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, PhoneCall } from "lucide-react";
import { Panel, Pill, StatCard } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";
import type { AchievementRow, CallRow, CategoryRow, ScenarioRow } from "@/lib/types";

type Dash = {
  stats: {
    totalCalls: number;
    averageRating: number;
    completedSimulations: number;
    pendingSimulations: number;
    achievementsEarned: number;
  };
  recentCalls: CallRow[];
  pendingScenarios: ScenarioRow[];
  achievements: AchievementRow[];
  categories: CategoryRow[];
};

export default function StudentDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dash>("/api/dashboard")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading floor metrics…</p>;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-navy text-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">Residential Care · Wave 14</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight">
              Your queue is live. Authenticate first, document everything, close with a recap.
            </h2>
            <p className="mt-3 max-w-lg text-sm text-white/70">
              AetherLink scores every contact on communication, authentication, documentation, sales,
              and compliance — the same five pillars used on the production floor.
            </p>
            <Link
              href="/student/calls"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-navy"
            >
              <PhoneCall className="h-4 w-4" />
              Open customer queue
            </Link>
          </div>
          <img
            src="/images/agent-female.jpg"
            alt="Agent on headset"
            className="hidden h-48 w-full rounded-2xl object-cover opacity-90 lg:block"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Calls Handled" value={data.stats.totalCalls} tone="navy" hint="Completed simulations" />
        <StatCard label="Average Rating" value={data.stats.averageRating || "—"} tone="gold" hint="AI + teacher blend" />
        <StatCard label="Completed Simulations" value={data.stats.completedSimulations} tone="teal" />
        <StatCard label="Pending Simulations" value={data.stats.pendingSimulations} tone="rose" />
        <StatCard label="Achievements Earned" value={data.stats.achievementsEarned} tone="slate" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Recent contacts" action={<Link href="/student/history" className="text-xs text-accent-2">View history</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 font-medium">Customer / type</th>
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCalls.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-3">
                      <p className="font-medium">{c.callType}</p>
                      <p className="text-xs text-muted">{c.status}</p>
                    </td>
                    <td className="py-3 text-muted">{formatDateTime(c.startedAt)}</td>
                    <td className="py-3">
                      {c.overallRating != null ? (
                        <Pill tone={c.overallRating >= 85 ? "ok" : c.overallRating >= 70 ? "warn" : "danger"}>
                          {c.overallRating}
                        </Pill>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.recentCalls.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted">
                      No calls yet. Take a customer from the queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
            <Panel title="Assigned queue">
            <ul className="space-y-3">
              {data.pendingScenarios.map((s) => (
                <li key={s.id} className="rounded-xl border border-line px-3 py-3">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted">
                    {s.customerFirstName} {s.customerLastName} · {s.difficulty}
                  </p>
                </li>
              ))}
              {data.pendingScenarios.length === 0 && (
                <p className="text-sm text-muted">All assigned simulations are complete.</p>
              )}
            </ul>
          </Panel>
          <Panel title="Achievements" action={<Award className="h-4 w-4 text-gold" />}>
            <ul className="space-y-2">
              {data.achievements.map((a) => (
                <li key={a.id} className="rounded-xl bg-canvas px-3 py-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted">{a.description}</p>
                </li>
              ))}
              {data.achievements.length === 0 && (
                <p className="text-sm text-muted">Complete a call to earn your first badge.</p>
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
