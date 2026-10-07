"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, Save } from "lucide-react";
import { Panel, Pill, ScoreBar } from "@/components/ui";
import { StarRating } from "@/components/Rating";
import { CallDetailView } from "@/components/CallDetailView";
import { api } from "@/lib/client";
import type { CallRow, ScenarioRow } from "@/lib/types";
import type { SupervisorReport } from "@/db/schema";
import { scoreToStars, starLabel } from "@/lib/progress";

const CATEGORIES = [
  { key: "authentication", label: "Authentication Procedure", hint: "Identity verified before account data; correct lockout handling." },
  { key: "communication", label: "Communication Skills", hint: "Greeting, empathy, active listening, verbal recap, closing." },
  { key: "resolution", label: "Problem Resolution", hint: "Diagnosis, correct action, first-contact resolution." },
  { key: "documentation", label: "Documentation", hint: "Concern, troubleshooting, resolution, follow-up, escalation." },
  { key: "professionalism", label: "Professionalism", hint: "Tone, ownership, courtesy, hold and transfer etiquette." },
  { key: "productKnowledge", label: "Product Knowledge", hint: "Plans, add-ons, pricing, and positioning accuracy." },
  { key: "compliance", label: "Compliance", hint: "Disclosures, payment consent, terms and conditions capture." },
] as const;

type EvalRow = {
  id: string;
  scores: Record<string, number>;
  overall: number;
  feedback: string;
  coachingNotes: string;
  improvementPlan: string;
  recognition: string;
  released: boolean;
};

export function EvaluationWorkspace() {
  const params = useParams<{ id: string }>();
  const callId = params.id;

  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, 3])),
  );
  const [feedback, setFeedback] = useState("");
  const [coachingNotes, setCoachingNotes] = useState("");
  const [improvementPlan, setImprovementPlan] = useState("");
  const [recognition, setRecognition] = useState("");
  const [released, setReleased] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [supervisor, setSupervisor] = useState<SupervisorReport | null>(null);
  const [call, setCall] = useState<CallRow | null>(null);
  const [scenario, setScenario] = useState<ScenarioRow | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ call: CallRow; scenario: ScenarioRow }>(`/api/calls/${callId}`)
      .then((d) => {
        setCall(d.call);
        setScenario(d.scenario);
        setSupervisor(d.call.supervisor ?? null);
      })
      .catch((e: Error) => setMessage(e.message));
    api<{ evaluations: EvalRow[] }>(`/api/evaluations?callId=${callId}`)
      .then((d) => {
        const ev = d.evaluations[0];
        if (ev) {
          setExistingId(ev.id);
          setScores({ ...Object.fromEntries(CATEGORIES.map((c) => [c.key, 3])), ...ev.scores });
          setFeedback(ev.feedback);
          setCoachingNotes(ev.coachingNotes);
          setImprovementPlan(ev.improvementPlan);
          setRecognition(ev.recognition);
          setReleased(ev.released);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [callId]);

  const overall = Math.round(
    CATEGORIES.reduce((a, c) => a + (scores[c.key] ?? 3) / 5, 0) * 100,
  );

  const applySupervisorSuggestion = useCallback(() => {
    if (!supervisor) return;
    const penalties = supervisor.missedAuthSteps.length * 0.8 +
      supervisor.missedDocumentation.length * 0.6 +
      supervisor.complianceFindings.length * 0.6;
    const base = Math.max(1, Math.min(5, Math.round(supervisor.rating / 20)));
    const next: Record<string, number> = {};
    for (const c of CATEGORIES) {
      const adjust =
        c.key === "authentication"
          ? supervisor.missedAuthSteps.length
          : c.key === "documentation"
            ? supervisor.missedDocumentation.length
            : c.key === "compliance"
              ? supervisor.complianceFindings.length
              : c.key === "communication"
                ? supervisor.communicationNotes.length
                : 0;
      next[c.key] = Math.max(1, Math.min(5, base - Math.round(adjust * 0.6)));
    }
    setScores(next);
    setImprovementPlan(supervisor.improvementPlan.join("\n• "));
    setCoachingNotes(supervisor.recommendations.join("\n• "));
    setMessage(`AI Supervisor draft applied (${penalties.toFixed(1)} penalty weight). Review before saving.`);
  }, [supervisor]);

  async function save() {
    setMessage("");
    try {
      await api("/api/evaluations", {
        method: "POST",
        body: JSON.stringify({
          callId,
          scores,
          feedback,
          coachingNotes,
          improvementPlan,
          recognition,
          released,
        }),
      });
      setMessage("Evaluation saved. The overall score is now on the student record.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save evaluation");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-navy p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-accent">Evaluation & rating</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {scenario ? `${scenario.customerFirstName} ${scenario.customerLastName}` : "Contact"}
            </h2>
            <p className="text-sm text-white/70">
              {call?.callType} · Agent {call?.studentName} · recording{" "}
              {call?.hasAudio ? "archived" : "missing"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase text-accent">Overall score</p>
            <p className="font-mono text-4xl">{overall}</p>
            <div className="mt-1 flex justify-end">
              <StarRating value={scoreToStars(overall)} readOnly size="sm" />
            </div>
            <p className="text-[11px] text-white/60">{starLabel(scoreToStars(overall))}</p>
          </div>
        </div>
      </div>

      {message && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-accent-2">{message}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="QA scorecard"
          action={
            supervisor ? (
              <button
                onClick={applySupervisorSuggestion}
                className="inline-flex items-center gap-1 rounded-lg bg-navy px-2.5 py-1.5 text-[11px] font-medium text-white"
              >
                <Bot className="h-3 w-3" /> Apply AI Supervisor draft
              </button>
            ) : null
          }
        >
          <div className="space-y-4">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-[11px] text-muted">{c.hint}</p>
                  </div>
                  <div className="text-right">
                    <StarRating value={scores[c.key]} onChange={(v) => setScores({ ...scores, [c.key]: v })} />
                    <p className="text-[10px] uppercase text-muted">
                      {scores[c.key]}★ · {starLabel(scores[c.key])}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Teacher feedback">
            {(
              [
                ["Written feedback", feedback, setFeedback, "What the agent did well and what to fix."],
                ["Coaching notes", coachingNotes, setCoachingNotes, "Specific behaviour-based coaching points."],
                ["Improvement plan", improvementPlan, setImprovementPlan, "Time-boxed actions, one per line."],
                ["Recognition comments", recognition, setRecognition, "Public praise worth sharing with the cohort."],
              ] as const
            ).map(([label, value, setter, hint]) => (
              <label key={label} className="mb-3 block text-xs">
                {label}
                <textarea
                  rows={label === "Improvement plan" ? 3 : 2}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={hint}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={released} onChange={(e) => setReleased(e.target.checked)} />
              Release this evaluation to the student
            </label>
            <button
              onClick={save}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Save className="h-4 w-4" />
              {existingId ? "Update evaluation" : "Save evaluation"}
            </button>
          </Panel>

          {supervisor && (
            <Panel
              title="AI Supervisor review"
              action={<Pill tone={supervisor.rating >= 85 ? "ok" : supervisor.rating >= 70 ? "warn" : "danger"}>{supervisor.rating}</Pill>}
            >
              <p className="text-sm font-medium">{supervisor.verdict}</p>
              <div className="mt-3 space-y-2 text-xs">
                <p className="text-muted">
                  Transcript reviewed: {supervisor.transcriptReviewed ? "yes" : "no"} · Communication notes:{" "}
                  {supervisor.communicationNotes.length}
                </p>
                {(
                  [
                    ["Missed authentication steps", supervisor.missedAuthSteps],
                    ["Missed documentation", supervisor.missedDocumentation],
                    ["Compliance findings", supervisor.complianceFindings],
                    ["Communication observations", supervisor.communicationNotes],
                    ["Recommendations", supervisor.recommendations],
                  ] as const
                ).map(([label, items]) => (
                  <div key={label}>
                    <p className="font-medium">{label}</p>
                    {items.length ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                        {items.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-ok">None detected.</p>
                    )}
                  </div>
                ))}
                <div>
                  <p className="font-medium">Improvement plan</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                    {supervisor.improvementPlan.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
          )}

          {call?.aiScores && (
            <Panel title="AI scoring breakdown">
              <div className="grid gap-3">
                <ScoreBar label="Communication" value={call.aiScores.communication} />
                <ScoreBar label="Authentication" value={call.aiScores.authentication} />
                <ScoreBar label="Documentation" value={call.aiScores.documentation} />
                <ScoreBar label="Sales" value={call.aiScores.sales} />
                <ScoreBar label="Compliance" value={call.aiScores.compliance} />
              </div>
            </Panel>
          )}
        </div>
      </div>

      <CallDetailView callId={callId} teacherMode embedded />
    </div>
  );
}
