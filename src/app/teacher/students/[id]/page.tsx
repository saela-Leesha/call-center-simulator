"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Panel, Pill, StatCard } from "@/components/ui";
import { ProgressRing } from "@/components/Rating";
import { GroupedBars } from "@/components/Charts";
import { api } from "@/lib/client";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { AiScores, EvaluationScores } from "@/db/schema";
import { scoreToStars } from "@/lib/progress";

type StudentCall = {
  id: string;
  customerName: string;
  callType: string;
  status: string;
  startedAt: string;
  durationSeconds: number;
  overallRating: number | null;
  aiScores: AiScores | null;
  hasAudio: boolean;
  transferred: boolean;
  notes: { concern: string; troubleshooting: string; resolution: string; followUp: string; escalation: string } | null;
  transcript: { at: string; speaker: string; text: string }[] | null;
  evaluationId: string | null;
};

type Detail = {
  student: { id: string; firstName: string; lastName: string; email: string; phone: string | null; agentId: string | null; department: string | null; bio: string | null; createdAt: string };
  stats: {
    totalCalls: number; completed: number; rejected: number; transferred: number;
    averageRating: number; completionRate: number; passRate: number; totalHandleTime: number;
    progressLevel: string; progressPercent: number; recordings: number; certificates: number;
  };
  calls: StudentCall[];
  evaluations: { id: string; callId: string; scores: EvaluationScores; overall: number; feedback: string; coachingNotes: string; improvementPlan: string; recognition: string; released: boolean; updatedAt: string }[];
  assignedScenarios: { id: string; title: string; done: boolean }[];
  categoryAverages: { name: string; average: number; count: number }[];
  passingScore: number;
};

const TABS = ["Call history", "Call recordings", "Notes review", "Evaluations"] as const;

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Call history");
  const [openCall, setOpenCall] = useState<StudentCall | null>(null);

  useEffect(() => {
    api<Detail>(`/api/students/${params.id}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading student profile…</p>;

  const completed = data.calls.filter((c) => c.status === "completed");
  const skillTrend = [
    { skill: "communication", before: completed[completed.length - 1]?.aiScores?.communication ?? 0, after: completed[0]?.aiScores?.communication ?? 0 },
    { skill: "authentication", before: completed[completed.length - 1]?.aiScores?.authentication ?? 0, after: completed[0]?.aiScores?.authentication ?? 0 },
    { skill: "documentation", before: completed[completed.length - 1]?.aiScores?.documentation ?? 0, after: completed[0]?.aiScores?.documentation ?? 0 },
    { skill: "sales", before: completed[completed.length - 1]?.aiScores?.sales ?? 0, after: completed[0]?.aiScores?.sales ?? 0 },
    { skill: "compliance", before: completed[completed.length - 1]?.aiScores?.compliance ?? 0, after: completed[0]?.aiScores?.compliance ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-navy p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-accent">
              {data.student.agentId} · {data.student.department}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              {data.student.firstName} {data.student.lastName}
            </h2>
            <p className="text-sm text-white/70">
              {data.student.email} · joined {formatDateTime(data.student.createdAt)}
            </p>
            {data.student.bio && <p className="mt-2 max-w-xl text-sm text-white/60">{data.student.bio}</p>}
          </div>
          <div className="text-right">
            <Pill tone="teal">{data.stats.progressLevel}</Pill>
            <p className="mt-2 font-mono text-3xl">{data.stats.averageRating || "—"}</p>
            <p className="text-[11px] text-white/60">average rating</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Calls" value={data.stats.totalCalls} tone="navy" />
        <StatCard label="Completed" value={data.stats.completed} tone="teal" />
        <StatCard label="Average Rating" value={data.stats.averageRating || "—"} tone="gold" />
        <StatCard label="Completion Rate" value={`${data.stats.completionRate}%`} tone="rose" />
        <StatCard label="Pass Rate" value={`${data.stats.passRate}%`} tone="slate" hint={`Passing ${data.passingScore}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <Panel title="Progress">
          <ProgressRing percent={data.stats.progressPercent} label={data.stats.progressLevel} />
          <p className="mt-3 text-xs text-muted">
            {data.stats.recordings} recordings · {data.stats.certificates} certificates ·{" "}
            {formatDuration(data.stats.totalHandleTime)} total handle time
          </p>
        </Panel>
        <Panel title="Skill improvement (first vs latest call)">
          <GroupedBars data={skillTrend} beforeLabel="Earliest" afterLabel="Latest" />
        </Panel>
        <Panel title="Queue averages">
          {data.categoryAverages.length ? (
            <ul className="space-y-2 text-sm">
              {data.categoryAverages.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <Pill tone={c.average >= 85 ? "ok" : c.average >= 70 ? "warn" : "danger"}>{c.average}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No rated contacts yet.</p>
          )}
        </Panel>
      </div>

      <div className="flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setOpenCall(null);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? "border-accent-2 text-navy" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Call history" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.calls.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.customerName}</p>
                    <p className="text-[11px] text-muted">{c.status}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDateTime(c.startedAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDuration(c.durationSeconds)}</td>
                  <td className="px-4 py-3 text-xs">{c.callType}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.overallRating != null && (
                        <Pill tone={c.overallRating >= 85 ? "ok" : c.overallRating >= 70 ? "warn" : "danger"}>
                          {c.overallRating}
                        </Pill>
                      )}
                      {c.transferred && <Pill tone="warn">transferred</Pill>}
                      {c.status === "rejected" && <Pill tone="danger">rejected</Pill>}
                      {c.status === "missed" && <Pill tone="danger">missed</Pill>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setTab("Call recordings"); setOpenCall(c); }} className="text-xs text-accent-2">
                        Recording
                      </button>
                      <Link href={`/teacher/evaluations/${c.id}`} className="text-xs text-accent-2">
                        Evaluate
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {data.calls.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No calls handled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Call recordings" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {completed.map((c) => (
              <button
                key={c.id}
                onClick={() => setOpenCall(c)}
                className={`w-full rounded-xl border p-3 text-left text-sm ${
                  openCall?.id === c.id ? "border-accent-2 bg-teal-50/50" : "border-line bg-white"
                }`}
              >
                <p className="font-medium">{c.customerName}</p>
                <p className="text-[11px] text-muted">
                  {c.callType} · {formatDateTime(c.startedAt)}
                </p>
                <p className="mt-1 text-[11px]">
                  {c.hasAudio ? "🔊 recording available" : "no recording"} ·{" "}
                  {(c.transcript ?? []).length} transcript lines
                </p>
              </button>
            ))}
            {completed.length === 0 && <p className="text-sm text-muted">No recordings yet.</p>}
          </div>
          {openCall ? (
            <Panel title={`Recording & transcript · ${openCall.customerName}`}>
              {openCall.hasAudio ? (
                <audio controls className="w-full" src={`/api/calls/${openCall.id}/recording`} />
              ) : (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No microphone recording was archived for this contact.
                </p>
              )}
              <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
                {(openCall.transcript ?? []).map((line, i) => (
                  <div
                    key={`${line.at}-${i}`}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      line.speaker === "customer"
                        ? "bg-teal-50"
                        : line.speaker === "agent"
                          ? "bg-navy/5"
                          : "bg-slate-100 text-muted"
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase opacity-60">
                      {line.speaker} · {line.at}
                    </p>
                    <p className="mt-0.5">{line.text}</p>
                  </div>
                ))}
                {(openCall.transcript ?? []).length === 0 && (
                  <p className="text-sm text-muted">No transcript captured.</p>
                )}
              </div>
            </Panel>
          ) : (
            <Panel title="Select a call">
              <p className="text-sm text-muted">Pick a contact on the left to play the recording and read the transcript.</p>
            </Panel>
          )}
        </div>
      )}

      {tab === "Notes review" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {completed.map((c) => (
            <Panel key={c.id} title={`${c.customerName} · ${c.callType}`}>
              <dl className="space-y-2 text-sm">
                {(
                  [
                    ["Agent notes — concern", c.notes?.concern],
                    ["Troubleshooting", c.notes?.troubleshooting],
                    ["Resolution", c.notes?.resolution],
                    ["Follow-up", c.notes?.followUp],
                    ["Escalation", c.notes?.escalation],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] uppercase text-muted">{label}</dt>
                    <dd className={value && value.trim().length > 12 ? "" : "text-danger"}>
                      {value && value.trim().length ? value : "— not documented —"}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
          {completed.length === 0 && <p className="text-sm text-muted">No documentation to review.</p>}
        </div>
      )}

      {tab === "Evaluations" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.evaluations.map((e) => {
            const call = data.calls.find((c) => c.id === e.callId);
            return (
              <Panel
                key={e.id}
                title={`${call?.customerName ?? "Contact"} · ${e.overall}/100`}
                action={<Pill tone={e.released ? "ok" : "slate"}>{e.released ? "released" : "draft"}</Pill>}
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {Object.entries(e.scores).map(([k, v]) => (
                    <p key={k} className="flex justify-between">
                      <span className="capitalize text-muted">{k.replace(/([A-Z])/g, " $1")}</span>
                      <span className="font-mono">{v}★</span>
                    </p>
                  ))}
                </div>
                {e.feedback && <p className="mt-3 text-sm"><span className="text-muted">Feedback:</span> {e.feedback}</p>}
                {e.coachingNotes && <p className="mt-2 text-sm"><span className="text-muted">Coaching:</span> {e.coachingNotes}</p>}
                {e.improvementPlan && <p className="mt-2 text-sm"><span className="text-muted">Plan:</span> {e.improvementPlan}</p>}
                {e.recognition && <p className="mt-2 text-sm text-accent-2">Recognition: {e.recognition}</p>}
                <Link href={`/teacher/evaluations/${e.callId}`} className="mt-3 inline-block text-xs font-medium text-accent-2">
                  Edit evaluation
                </Link>
              </Panel>
            );
          })}
          {data.evaluations.length === 0 && (
            <p className="text-sm text-muted">No evaluations filed yet.</p>
          )}
        </div>
      )}

      <Panel title="Assigned simulations">
        <ul className="grid gap-2 md:grid-cols-2">
          {data.assignedScenarios.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
              <span className="truncate">{s.title}</span>
              <Pill tone={s.done ? "ok" : "warn"}>{s.done ? "completed" : "pending"}</Pill>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
