"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListOrdered, PhoneIncoming, Volume2 } from "lucide-react";
import { IncomingCallModal, type IncomingCallInfo } from "@/components/IncomingCallModal";
import { Pill } from "@/components/ui";
import { api } from "@/lib/client";
import { primeSoftphone, softphone } from "@/lib/softphone-audio";
import type { CallRow, CategoryRow, ScenarioRow } from "@/lib/types";

type StatusPayload = {
  status: string;
  label: string;
  ringTimeoutSeconds: number;
  queueAutoDispatch: boolean;
};

export function QueueBoard({
  categories,
  scenarios,
  calls,
  onRefresh,
}: {
  categories: CategoryRow[];
  scenarios: ScenarioRow[];
  calls: CallRow[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<StatusPayload | null>(null);
  const [incoming, setIncoming] = useState<IncomingCallInfo | null>(null);
  const [banner, setBanner] = useState("");
  const [queueTimer, setQueueTimer] = useState(0);
  const [armed, setArmed] = useState(false);
  const audioRef = useRef<ReturnType<typeof softphone> | null>(null);

  const completedIds = useMemo(
    () => new Set(calls.filter((c) => c.status === "completed").map((c) => c.scenarioId)),
    [calls],
  );
  const openIds = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of calls) {
      if (c.status === "ringing" || c.status === "in_progress") m.set(c.scenarioId, c.id);
    }
    return m;
  }, [calls]);

  const waiting = useMemo(
    () => scenarios.filter((s) => !openIds.has(s.id)),
    [scenarios, openIds],
  );

  useEffect(() => {
    api<StatusPayload>("/api/agent-status")
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  // Queue wait ticker while the agent is available and waiting for dispatch.
  useEffect(() => {
    if (meta?.status !== "available" || !meta.queueAutoDispatch || incoming) return;
    const id = setInterval(() => setQueueTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [meta?.status, meta?.queueAutoDispatch, incoming]);

  const dispatch = useCallback(async (scenario: ScenarioRow) => {
    primeSoftphone();
    setBanner("");
      try {
        const existing = openIds.get(scenario.id);
        const callId =
          existing ??
          (
            await api<{ call: CallRow }>("/api/calls", {
              method: "POST",
              body: JSON.stringify({ scenarioId: scenario.id }),
            })
          ).call.id;
        setIncoming({
          callId,
          customerName: `${scenario.customerFirstName} ${scenario.customerLastName}`,
          callType: scenario.categoryName ?? "Customer Care",
          queue: `${scenario.categoryName ?? "Residential"} · Skill 14`,
          mobile: scenario.mobile,
          difficulty: scenario.difficulty,
          ringTimeoutSeconds: meta?.ringTimeoutSeconds ?? 30,
        });
      } catch (e) {
        setBanner(e instanceof Error ? e.message : "Unable to present the call");
      }
    },
    [meta?.ringTimeoutSeconds, openIds],
  );

  // Auto-dispatch the next waiting customer shortly after the agent goes available.
  useEffect(() => {
    if (!armed || incoming || !meta?.queueAutoDispatch) return;
    if (meta.status !== "available") return;
    if (queueTimer < 6) return;
    const next = waiting.find((s) => !completedIds.has(s.id)) ?? waiting[0];
    if (!next) {
      setArmed(false);
      setBanner("Queue is empty — no customers waiting. Pick a scenario manually.");
      return;
    }
    setArmed(false);
    softphone()?.queueChirp();
    void dispatch(next);
  }, [armed, incoming, meta, queueTimer, waiting, completedIds, dispatch]);

  useEffect(() => {
    setArmed(false);
    setQueueTimer(0);
    if (meta?.status === "available" && meta.queueAutoDispatch) {
      setArmed(true);
    }
  }, [meta?.status, meta?.queueAutoDispatch]);

  useEffect(() => {
    audioRef.current = softphone();
    return () => audioRef.current?.stopAll();
  }, []);

  async function accept() {
    if (!incoming) return;
    setIncoming(null);
    setBanner("");
    router.push(`/student/calls/${incoming.callId}?answered=1`);
  }

  async function reject() {
    if (!incoming) return;
    const id = incoming.callId;
    setIncoming(null);
    setBanner("Call rejected. The customer returned to the queue.");
    try {
      await api(`/api/calls/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject" }),
      });
      onRefresh();
    } catch {
      /* non-blocking */
    }
  }

  async function missed() {
    if (!incoming) return;
    const { callId, ringTimeoutSeconds } = incoming;
    setIncoming(null);
    setBanner(
      `Missed call — the customer waited ${ringTimeoutSeconds}s and left the queue. Logged to Call History.`,
    );
    try {
      await api(`/api/calls/${callId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "missed", durationSeconds: ringTimeoutSeconds }),
      });
      onRefresh();
    } catch {
      /* non-blocking */
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Customer Care";

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Softphone queue</p>
            <h3 className="mt-1 text-lg font-semibold">
              {meta?.status === "available"
                ? meta.queueAutoDispatch
                  ? "In queue — waiting for the next customer"
                  : "Available — manual dispatch"
                : `Status: ${meta?.label ?? "Offline"}`}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {meta?.status === "available"
                ? "Keep your headset on. Calls arrive automatically from the skill queue and ring until you accept, reject, or the timeout elapses."
                : "Set your status to Available in the header to start receiving inbound calls from the queue."}
            </p>
            {meta?.status === "available" && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
                  <span className="font-mono text-xs">
                    {String(Math.floor(queueTimer / 60)).padStart(2, "0")}:
                    {String(queueTimer % 60).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] text-muted">in queue</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <ListOrdered className="h-3.5 w-3.5" />
                  {waiting.length} customer{waiting.length === 1 ? "" : "s"} waiting
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Volume2 className="h-3.5 w-3.5" />
                  Ring timeout {meta?.ringTimeoutSeconds ?? 30}s
                </span>
              </div>
            )}
            {meta?.status === "available" && meta?.queueAutoDispatch && (
              <div className="relative mt-4 h-1 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
                <div className="absolute inset-y-0 w-1/4 animate-[queueScan_2.4s_linear_infinite] rounded-full bg-accent/40" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-start justify-center gap-2 lg:items-end">
            <Pill tone={meta?.status === "available" ? "ok" : "slate"}>
              {meta?.label ?? "Offline"}
            </Pill>
            <button
              onClick={() => {
                primeSoftphone();
                const next = waiting.find((s) => !completedIds.has(s.id)) ?? waiting[0];
                if (!next) {
                  setBanner("No customers are waiting. Create scenarios as a teacher first.");
                  return;
                }
                void dispatch(next);
              }}
              disabled={waiting.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <PhoneIncoming className="h-4 w-4" />
              Present next call
            </button>
            <p className="max-w-[220px] text-[11px] text-muted">
              Manual presentation works in any status — useful for practice outside the live queue.
            </p>
          </div>
        </div>
      </section>

      {banner && (
        <p className="animate-[toastIn_0.3s_ease-out] rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {banner}
        </p>
      )}

      {incoming && (
        <IncomingCallModal info={incoming} onAccept={accept} onReject={reject} onMissed={missed} />
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {waiting.map((s) => {
          const done = completedIds.has(s.id);
          const cat = categories.find((c) => c.id === s.categoryId);
          return (
            <article key={s.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: cat?.color }}>
                    {catName(s.categoryId)}
                  </p>
                  <h4 className="mt-0.5 text-base font-semibold">{s.title}</h4>
                  <p className="mt-1 text-xs text-muted">{s.concern}</p>
                </div>
                <Pill tone={done ? "ok" : "warn"}>{done ? "practice" : "new"}</Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted">
                <p>
                  Customer
                  <span className="mt-0.5 block font-medium text-ink">
                    {s.customerFirstName} {s.customerLastName}
                  </span>
                </p>
                <p>
                  Difficulty
                  <span className="mt-0.5 block font-medium text-ink">{s.difficulty}</span>
                </p>
              </div>
              <button
                onClick={() => dispatch(s)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-xs font-semibold text-navy ring-1 ring-line"
              >
                <PhoneIncoming className="h-3.5 w-3.5" />
                Ring this customer
              </button>
            </article>
          );
        })}
        {waiting.length === 0 && (
          <p className="text-sm text-muted">Every assigned customer has been handled.</p>
        )}
      </section>
    </>
  );
}
