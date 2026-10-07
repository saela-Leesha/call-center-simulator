"use client";

import { useEffect, useState } from "react";
import { Panel, Pill, ScoreBar } from "@/components/ui";
import { api } from "@/lib/client";
import { formatCurrency, formatDateTime, formatDuration } from "@/lib/utils";
import type { CallRow, ProductRow, ScenarioRow } from "@/lib/types";

export function CallDetailView({
  callId,
  teacherMode = false,
  embedded = false,
}: {
  callId: string;
  teacherMode?: boolean;
  embedded?: boolean;
}) {
  const [call, setCall] = useState<CallRow | null>(null);
  const [scenario, setScenario] = useState<ScenarioRow | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(85);
  const [comments, setComments] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api<{ call: CallRow; scenario: ScenarioRow; products: ProductRow[] }>(`/api/calls/${callId}`)
      .then((d) => {
        setCall(d.call);
        setScenario(d.scenario);
        setRating(d.call.teacherRating ?? 85);
        setComments(d.call.teacherComments ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, [callId]);

  async function submitReview() {
    setSaved("");
    try {
      const data = await api<{ call: CallRow }>(`/api/calls/${callId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "teacher_review",
          teacherRating: rating,
          teacherComments: comments,
        }),
      });
      setCall(data.call);
      setSaved("Teacher rating saved and the student was notified.");
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Unable to save");
    }
  }

  if (error) return <p className="text-danger">{error}</p>;
  if (!call || !scenario) return <p className="text-muted">Loading contact record…</p>;

  const notes = call.notes;
  const scores = call.aiScores;
  const coach = call.aiCoaching;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-navy p-6 text-white">
        <p className="text-xs uppercase tracking-[0.16em] text-accent">{call.callType}</p>
        <h2 className="mt-1 text-2xl font-semibold">
          {scenario.customerFirstName} {scenario.customerLastName}
        </h2>
        <p className="mt-1 text-sm text-white/70">
          {formatDateTime(call.startedAt)} · Duration {formatDuration(call.durationSeconds)} ·{" "}
          {call.status}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="teal">Auth {call.authMethod || "pending"}</Pill>
          {call.overallRating != null && <Pill tone="ok">Overall {call.overallRating}</Pill>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Customer information">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase text-muted">Account</dt>
              <dd className="font-mono">{scenario.accountNumber}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Mobile</dt>
              <dd>{scenario.mobile}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] uppercase text-muted">Address</dt>
              <dd>{scenario.address}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] uppercase text-muted">Gmail</dt>
              <dd>{scenario.email}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Plan</dt>
              <dd>{scenario.currentPlan}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-muted">Status</dt>
              <dd>{scenario.serviceStatus}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Audio recording playback">
          <p className="mb-3 text-xs text-muted">
            {call.hasAudio
              ? "Automatic voice recording captured from the live call. Review it alongside the transcript."
              : "No microphone recording was archived for this contact. The transcript below is still available."}
          </p>
          {call.hasAudio ? (
            <audio controls className="w-full" src={`/api/calls/${callId}/recording`}>
              Your browser does not support audio playback.
            </audio>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Recording unavailable — QA scored this contact on the transcript and notes only.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
            <span>Duration {formatDuration(call.durationSeconds)}</span>
            <span>·</span>
            <span>Transcript lines {(call.transcript ?? []).length}</span>
            {call.transferred && (
              <>
                <span>·</span>
                <span>Transferred to {call.transferTarget}</span>
              </>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Full call transcript">
        <div className="max-h-[360px] space-y-2 overflow-y-auto">
          {(call.transcript ?? []).map((line, i) => (
            <div key={`${line.at}-${i}`} className="rounded-xl bg-canvas px-3 py-2 text-sm">
              <p className="font-mono text-[10px] uppercase text-muted">
                {line.speaker} · {line.at}
              </p>
              <p>{line.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Notes taken during the call">
          <div className="space-y-2 text-sm">
            <p><span className="text-muted">Concern:</span> {notes?.concern || "—"}</p>
            <p><span className="text-muted">Troubleshooting:</span> {notes?.troubleshooting || "—"}</p>
            <p><span className="text-muted">Follow-up:</span> {notes?.followUp || "—"}</p>
            <p><span className="text-muted">Escalation:</span> {notes?.escalation || "—"}</p>
          </div>
        </Panel>
        <Panel title="Resolution provided">
          <p className="text-sm">{notes?.resolution || "No resolution documented."}</p>
        </Panel>
        <Panel title="Products & payments">
          <ul className="space-y-1 text-sm">
            {(call.productsSold ?? []).length === 0 && <li className="text-muted">No products captured.</li>}
            {(call.productsSold ?? []).map((p) => (
              <li key={`${p.id}-${p.action}`}>
                {p.name} · {p.action} · {formatCurrency(p.monthlyFee)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            {call.payment
              ? `${call.payment.method} ${call.payment.reference} · ${formatCurrency(call.payment.amount)}`
              : "No payment processed."}
          </p>
        </Panel>
      </div>

      <Panel title="Ratings">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-canvas p-4">
            <p className="text-xs uppercase text-muted">AI rating</p>
            <p className="font-mono text-3xl">{scores?.overall ?? "—"}</p>
          </div>
          <div className="rounded-2xl bg-canvas p-4">
            <p className="text-xs uppercase text-muted">Teacher rating</p>
            <p className="font-mono text-3xl">{call.teacherRating ?? "Pending"}</p>
          </div>
          <div className="rounded-2xl bg-navy p-4 text-white">
            <p className="text-xs uppercase text-accent">Overall rating</p>
            <p className="font-mono text-3xl">{call.overallRating ?? "—"}</p>
          </div>
        </div>
        {scores && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ScoreBar label="Communication" value={scores.communication} />
            <ScoreBar label="Authentication" value={scores.authentication} />
            <ScoreBar label="Documentation" value={scores.documentation} />
            <ScoreBar label="Sales" value={scores.sales} />
            <ScoreBar label="Compliance" value={scores.compliance} />
          </div>
        )}
      </Panel>

      {call.supervisor && (
        <Panel
          title="AI Supervisor audit"
          action={
            <Pill tone={call.supervisor.rating >= 85 ? "ok" : call.supervisor.rating >= 70 ? "warn" : "danger"}>
              {call.supervisor.rating}
            </Pill>
          }
        >
          <p className="text-sm font-medium">{call.supervisor.verdict}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {(
              [
                ["Missed authentication steps", call.supervisor.missedAuthSteps],
                ["Missed documentation", call.supervisor.missedDocumentation],
                ["Compliance findings", call.supervisor.complianceFindings],
                ["Communication observations", call.supervisor.communicationNotes],
                ["Recommendations", call.supervisor.recommendations],
                ["Improvement plan", call.supervisor.improvementPlan],
              ] as const
            ).map(([label, items]) => (
              <div key={label}>
                <h4 className="text-sm font-semibold">{label}</h4>
                {items.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted">
                    {items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ok">None detected.</p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Feedback">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold">AI comments</h4>
            <p className="mt-1 text-sm text-muted">{coach?.comments || "—"}</p>
            <h4 className="mt-4 text-sm font-semibold">Improvement suggestions</h4>
            <ul className="mt-1 list-disc pl-4 text-sm text-muted">
              {(coach?.improvements ?? []).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Teacher comments</h4>
            <p className="mt-1 text-sm text-muted">{call.teacherComments || "Awaiting coach review."}</p>
            <h4 className="mt-4 text-sm font-semibold">Strengths</h4>
            <ul className="mt-1 list-disc pl-4 text-sm text-muted">
              {(coach?.strengths ?? []).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {teacherMode && !embedded && (
        <Panel title="Quick teacher rating">
          <p className="mb-3 text-xs text-muted">
            For the full seven-category QA scorecard use Evaluations &amp; Ratings.
          </p>
          <label className="block text-sm">
            Score (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="mt-3 block text-sm">
            Coaching comments
            <textarea
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <button onClick={submitReview} className="mt-3 rounded-xl bg-navy px-4 py-2 text-sm text-white">
            Save teacher rating
          </button>
          {saved && <p className="mt-2 text-sm text-accent-2">{saved}</p>}
        </Panel>
      )}
    </div>
  );
}
