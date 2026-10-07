"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Lock, Save, ShieldQuestion, Sparkles } from "lucide-react";
import { Panel, Pill, ScoreBar } from "@/components/ui";
import { VoiceCallRoom, type CallPhase } from "@/components/VoiceCallRoom";
import { api } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import type { AiCoaching, AiScores, CallNotes, PaymentRecord, SoldProduct, TranscriptLine } from "@/db/schema";
import type { CallRow, ProductRow, ScenarioRow } from "@/lib/types";
import type { CustomerTurn } from "@/lib/customer-brain";
import { primeSoftphone, softphone } from "@/lib/softphone-audio";

const emptyNotes: CallNotes = {
  concern: "",
  troubleshooting: "",
  resolution: "",
  followUp: "",
  escalation: "",
};

const TERMS =
  "By confirming, the customer authorizes AetherLink Communications to apply the selected plan or add-on, process the stated payment, and send a confirmation to the email on file. Recurring charges may appear on the next bill cycle. Add-ons may be cancelled with 30 days notice. This simulation uses fictional accounts for training only.";

export function SimulationWorkspace() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const answered = searchParams.get("answered") === "1";

  const [call, setCall] = useState<CallRow | null>(null);
  const [scenario, setScenario] = useState<ScenarioRow | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [ringTimeoutSeconds, setRingTimeoutSeconds] = useState(30);
  const [phase, setPhase] = useState<CallPhase>("ringing");
  const [seconds, setSeconds] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [authError, setAuthError] = useState("");

  const [notes, setNotes] = useState<CallNotes>(emptyNotes);
  const [cart, setCart] = useState<SoldProduct[]>([]);
  const [payMethod, setPayMethod] = useState<"cash" | "online" | "bank">("online");
  const [payAmount, setPayAmount] = useState(0);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [terms, setTerms] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [coaching, setCoaching] = useState<{ scores: AiScores; coaching: AiCoaching } | null>(null);
  const [busy, setBusy] = useState(false);

  const verifyRef = useRef<(m: "password" | "security") => Promise<void>>(async () => {});

  useEffect(() => {
    let live = true;
    api<{ ringTimeoutSeconds: number }>("/api/agent-status")
      .then((d) => setRingTimeoutSeconds(d.ringTimeoutSeconds))
      .catch(() => undefined);

    api<{
      call: CallRow;
      scenario: ScenarioRow;
      products: ProductRow[];
      securityQuestion: string;
      transferEnabled: boolean;
    }>(`/api/calls/${id}`)
      .then((data) => {
        if (!live) return;
        setCall(data.call);
        setScenario(data.scenario);
        setProducts(data.products);
        setSecurityQuestion(data.securityQuestion);
        setTransferEnabled(data.transferEnabled ?? true);
        setNotes(data.call.notes ?? { ...emptyNotes, concern: data.scenario.concern });
        setCart(data.call.productsSold ?? []);
        setPayment(data.call.payment);
        setTerms(data.call.termsAgreed);
        setSeconds(data.call.durationSeconds || 0);
        setPayAmount(data.scenario.outstandingBalance || data.scenario.currentBalance || 0);
        setPhase(answered || (data.call.status !== "ringing" && data.call.status !== "in_progress") ? "active" : "ringing");
        if (data.call.status === "completed") router.replace(`/student/history/${id}`);
      })
      .catch((e: Error) => setMessage(e.message));
    return () => {
      live = false;
    };
  }, [id, router]);

  useEffect(() => {
    if (phase !== "active" && phase !== "hold") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!answered) return;
    primeSoftphone();
    softphone()?.connectBlip();
  }, [answered]);

  const authenticated = Boolean(call?.authSuccess);
  const locked = Boolean(call?.passwordLocked);
  const transcript = useMemo(() => call?.transcript ?? [], [call]);

  const monthlyAdd = useMemo(
    () => cart.filter((p) => p.action === "sold").reduce((s, p) => s + p.monthlyFee, 0),
    [cart],
  );

  /** Voice-captured verification data: the agent repeats what they heard into the CRM. */
  const onDisclosure = useCallback((d: CustomerTurn["disclosure"]) => {
    if (!d) return;
    if (d.firstName) setFirstName((v) => v || d.firstName!);
    if (d.lastName) setLastName((v) => v || d.lastName!);
    if (d.accountNumber) setAccountNumber((v) => v || d.accountNumber!);
    if (d.password) setPassword((v) => v || d.password!);
    if (d.securityAnswer) setSecurityAnswer((v) => v || d.securityAnswer!);
  }, []);

  const verify = useCallback(
    async (method: "password" | "security") => {
      setBusy(true);
      setAuthError("");
      try {
        const data = await api<{
          success: boolean;
          error?: string;
          call?: CallRow;
        }>(`/api/calls/${id}/auth`, {
          method: "POST",
          body: JSON.stringify({
            firstName,
            lastName,
            accountNumber,
            password,
            securityAnswer,
            method,
            durationSeconds: seconds,
          }),
        });
        if (data.call) setCall(data.call);
        setAuthError(data.success ? "" : data.error || "Verification failed");
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "Verification failed");
      } finally {
        setBusy(false);
      }
    },
    [accountNumber, firstName, id, lastName, password, securityAnswer, seconds],
  );
  verifyRef.current = verify;

  // Auto-submit verification once the customer has spoken all identity details.
  useEffect(() => {
    if (authenticated || busy) return;
    if (firstName && lastName && accountNumber && password && !locked) {
      void verifyRef.current("password");
    } else if (locked && firstName && lastName && accountNumber && securityAnswer) {
      void verifyRef.current("security");
    }
  }, [firstName, lastName, accountNumber, password, securityAnswer, locked, authenticated, busy]);

  const persist = useCallback(
    async (action: "save_notes" | "save_changes" | "complete", hasRecording?: boolean) => {
      setBusy(true);
      setMessage("");
      try {
        const data = await api<{ call: CallRow; scores?: AiScores; coaching?: AiCoaching }>(
          `/api/calls/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              action,
              notes,
              productsSold: cart,
              payment,
              termsAgreed: terms,
              durationSeconds: seconds,
              transcript,
              hasRecording,
            }),
          },
        );
        setCall(data.call);
        if (action === "save_notes") setMessage("Agent notes saved to the CRM.");
        if (action === "save_changes") setMessage("Account changes saved.");
        if (action === "complete" && data.scores && data.coaching) {
          setCoaching({ scores: data.scores, coaching: data.coaching });
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [cart, id, notes, payment, seconds, terms, transcript],
  );

  const endCallAction = useCallback(
    async ({ hasRecording }: { hasRecording: boolean }) => {
      await persist("complete", hasRecording);
    },
    [persist],
  );

  const rejectCall = useCallback(async () => {
    await api(`/api/calls/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "reject", notes, transcript, durationSeconds: seconds }),
    });
    router.push("/student/calls");
  }, [id, notes, router, seconds, transcript]);

  const missCall = useCallback(
    async (ringTimeoutSeconds: number) => {
      await api(`/api/calls/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "missed", durationSeconds: ringTimeoutSeconds }),
      });
      router.push("/student/history");
    },
    [id, router],
  );

  const transferCall = useCallback(
    async (target: string) => {
      await api(`/api/calls/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "transfer",
          transferTarget: target,
          notes,
          transcript,
          durationSeconds: seconds,
          hasRecording: true,
        }),
      });
      router.push("/student/history");
    },
    [id, notes, router, seconds, transcript],
  );

  function toggleProduct(p: ProductRow, action: "offered" | "sold") {
    setCart((prev) => {
      const exists = prev.find((x) => x.id === p.id && x.action === action);
      if (exists) return prev.filter((x) => !(x.id === p.id && x.action === action));
      return [
        ...prev.filter((x) => x.id !== p.id || x.action !== action),
        { id: p.id, name: p.name, monthlyFee: p.monthlyFee, action },
      ];
    });
  }

  function processPayment() {
    if (!terms) {
      setConfirmTerms(true);
      return;
    }
    setPayment({
      method: payMethod,
      amount: payAmount,
      reference: `${payMethod.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      processedAt: new Date().toISOString(),
    });
    setMessage("Payment posted to the training ledger.");
  }

  if (!call || !scenario) return <p className="text-muted">{message || "Opening contact…"}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy px-4 py-3 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">Voice channel · no chat</p>
          <p className="text-sm font-semibold">
            {scenario.customerFirstName} {scenario.customerLastName} · {call.callType}
          </p>
        </div>
        <Pill tone={authenticated ? "ok" : "warn"}>
          {authenticated ? `Verified by ${call.authMethod}` : "Verification pending"}
        </Pill>
      </div>

      {message && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-accent-2">{message}</p>}

      <VoiceCallRoom
        callId={id}
        customerName={`${scenario.customerFirstName} ${scenario.customerLastName}`}
        customerMobile={scenario.mobile}
        queue={call.callType}
        transferEnabled={transferEnabled}
        ringTimeoutSeconds={ringTimeoutSeconds}
        answered={answered}
        phase={phase}
        transcript={transcript}
        seconds={seconds}
        onPhaseChange={setPhase}
        onTranscriptChange={(lines) => setCall((c) => (c ? { ...c, transcript: lines } : c))}
        onDisclosure={onDisclosure}
        onReject={rejectCall}
        onMissed={missCall}
        onTransfer={transferCall}
        onComplete={endCallAction}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Panel
            title="CRM verification (voice-captured)"
            action={authenticated ? <Pill tone="ok">Verified</Pill> : <Pill tone="warn">Required</Pill>}
          >
            <p className="mb-3 text-[11px] text-muted">
              These fields fill from what you hear on the call. Re-keying data is expected agent
              behaviour — it is not a chat message to the customer.
            </p>
            <div className="space-y-3">
              {(
                [
                  ["First name", firstName, setFirstName],
                  ["Last name", lastName, setLastName],
                ] as const
              ).map(([label, value, setter]) => (
                <label key={label} className="block text-xs">
                  {label}
                  <input
                    value={value}
                    disabled={authenticated}
                    onChange={(e) => setter(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </label>
              ))}
              <label className="block text-xs">
                Account number
                <input
                  value={accountNumber}
                  disabled={authenticated}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="block text-xs">
                Password
                <input
                  type="password"
                  value={password}
                  disabled={locked || authenticated}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
              {locked && (
                <p className="flex items-center gap-1 text-xs text-danger">
                  <Lock className="h-3 w-3" /> Locked after 3 failed attempts — ask the security question.
                </p>
              )}
              {(locked || authenticated) && (
                <div className="rounded-xl bg-canvas p-3">
                  <p className="flex items-center gap-1 text-xs font-medium">
                    <ShieldQuestion className="h-3.5 w-3.5" /> {securityQuestion}
                  </p>
                  <input
                    value={securityAnswer}
                    disabled={authenticated}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
                    placeholder="Answer heard on the call"
                  />
                </div>
              )}
              {authError && <p className="text-xs text-danger">{authError}</p>}
              <p className="text-[11px] text-muted">
                Password attempts {call.passwordAttempts}/3 · security {call.securityAttempts}/3
              </p>
            </div>
          </Panel>

          {authenticated && (
            <>
              <Panel title="Customer profile">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Account number</dt>
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
                    <dt className="text-[11px] uppercase text-muted">Gmail address</dt>
                    <dd>{scenario.email}</dd>
                  </div>
                </dl>
              </Panel>
              <Panel title="Internet subscription">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Current plan</dt>
                    <dd>{scenario.currentPlan}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Monthly fee</dt>
                    <dd>{formatCurrency(scenario.monthlyFee)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Speed</dt>
                    <dd>{scenario.internetSpeed}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Contract</dt>
                    <dd>{scenario.contractDuration}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] uppercase text-muted">Service status</dt>
                    <dd>{scenario.serviceStatus}</dd>
                  </div>
                </dl>
              </Panel>
              <Panel title="Billing information">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Current balance</dt>
                    <dd>{formatCurrency(scenario.currentBalance)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Outstanding</dt>
                    <dd>{formatCurrency(scenario.outstandingBalance)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Due date</dt>
                    <dd>{scenario.dueDate}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Previous payment</dt>
                    <dd>{formatCurrency(scenario.previousPayment)}</dd>
                  </div>
                </dl>
              </Panel>
            </>
          )}
        </div>

        <div className="space-y-4">
          <Panel
            title="Agent notes"
            action={
              <button
                onClick={() => persist("save_notes")}
                disabled={!authenticated || busy}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent-2 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> Save notes
              </button>
            }
          >
            {(
              [
                ["concern", "Customer concern"],
                ["troubleshooting", "Troubleshooting notes"],
                ["resolution", "Resolution notes"],
                ["followUp", "Follow-up notes"],
                ["escalation", "Escalation notes"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="mb-3 block text-xs">
                {label}
                <textarea
                  rows={2}
                  disabled={!authenticated}
                  value={notes[key]}
                  onChange={(e) => setNotes({ ...notes, [key]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-slate-50"
                />
              </label>
            ))}
          </Panel>

          <Panel title="Products and upgrades">
            <div className="grid gap-3">
              {products.map((p) => {
                const offered = cart.some((c) => c.id === p.id && c.action === "offered");
                const sold = cart.some((c) => c.id === p.id && c.action === "sold");
                return (
                  <div key={p.id} className="rounded-xl border border-line p-3">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.description}</p>
                    <p className="mt-1 font-mono text-xs">
                      {formatCurrency(p.monthlyFee)}/mo {p.speed ? `· ${p.speed}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={!authenticated}
                        onClick={() => toggleProduct(p, "offered")}
                        className={`rounded-lg px-2.5 py-1 text-xs ${offered ? "bg-navy text-white" : "bg-canvas"}`}
                      >
                        {offered ? "Offered" : "Mark offered"}
                      </button>
                      <button
                        disabled={!authenticated}
                        onClick={() => toggleProduct(p, "sold")}
                        className={`rounded-lg px-2.5 py-1 text-xs ${sold ? "bg-accent-2 text-white" : "bg-canvas"}`}
                      >
                        {sold ? "Sold" : "Add to order"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Added monthly value {formatCurrency(monthlyAdd)}</p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Payment module">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["cash", "Cash"],
                  ["online", "Online payment"],
                  ["bank", "Bank transfer"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  disabled={!authenticated}
                  onClick={() => setPayMethod(m)}
                  className={`rounded-lg px-3 py-2 text-xs ${payMethod === m ? "bg-navy text-white" : "bg-canvas"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs">
              Amount (cents)
              <input
                type="number"
                disabled={!authenticated}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-sm"
              />
            </label>
            <p className="mt-1 text-xs text-muted">
              Posting {formatCurrency(payAmount)} via {payMethod}
            </p>
            <button
              disabled={!authenticated}
              onClick={processPayment}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ok px-3 py-2 text-xs font-semibold text-white"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Process payment
            </button>
            {payment && (
              <p className="mt-2 font-mono text-xs text-ok">
                {payment.method} · {payment.reference} · {formatCurrency(payment.amount)}
              </p>
            )}
          </Panel>

          <Panel title="Terms and conditions">
            <p className="text-xs leading-5 text-muted">{TERMS}</p>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!authenticated}
                checked={terms}
                onChange={(e) => {
                  if (e.target.checked) setConfirmTerms(true);
                  else setTerms(false);
                }}
              />
              Customer verbally agreed to the terms and conditions
            </label>
            <button
              disabled={!authenticated || busy}
              onClick={() => persist("save_changes")}
              className="mt-4 w-full rounded-xl bg-accent-2 py-2.5 text-sm font-semibold text-white"
            >
              Save changes
            </button>
          </Panel>

          <Panel title="QA checklist">
            <ul className="space-y-1 text-xs text-muted">
              <li>Branded greeting delivered by voice</li>
              <li>Identity verified before account details</li>
              <li>Empathy statement spoken</li>
              <li>Resolution recap confirmed verbally</li>
              <li>Relevant offer presented</li>
              <li>Disclosures read and agreement captured</li>
              <li>Notes documented during the call</li>
            </ul>
          </Panel>
        </div>
      </div>

      {confirmTerms && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-navy/70 p-4">
          <div className="max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">Confirm customer agreement</h3>
            <p className="mt-2 text-sm text-muted">
              Did you read the disclosures out loud and hear the customer agree before billing or plan
              changes?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmTerms(false);
                  setTerms(false);
                }}
                className="rounded-lg px-3 py-2 text-sm"
              >
                No
              </button>
              <button
                onClick={() => {
                  setTerms(true);
                  setConfirmTerms(false);
                }}
                className="rounded-lg bg-navy px-3 py-2 text-sm text-white"
              >
                Yes, customer agreed
              </button>
            </div>
          </div>
        </div>
      )}

      {coaching && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/80 p-4">
          <div className="mx-auto my-8 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.16em] text-accent-2">AI coaching system</p>
            <h3 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <Sparkles className="h-5 w-5 text-gold" />
              Voice contact scored {coaching.scores.overall}/100
            </h3>
            <p className="mt-2 text-sm text-muted">{coaching.coaching.summary}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ScoreBar label="Communication score" value={coaching.scores.communication} />
              <ScoreBar label="Authentication score" value={coaching.scores.authentication} />
              <ScoreBar label="Documentation score" value={coaching.scores.documentation} />
              <ScoreBar label="Sales score" value={coaching.scores.sales} />
              <ScoreBar label="Compliance score" value={coaching.scores.compliance} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(
                [
                  ["Recommendations", coaching.coaching.recommendations],
                  ["Areas for improvement", coaching.coaching.improvements],
                  ["Best practices", coaching.coaching.bestPractices],
                  ["Strengths", coaching.coaching.strengths],
                ] as const
              ).map(([label, items]) => (
                <div key={label}>
                  <h4 className="text-sm font-semibold">{label}</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                    {items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/student/history/${id}`)}
                className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white"
              >
                Open recording & transcript
              </button>
              <button onClick={() => router.push("/student/calls")} className="rounded-xl bg-canvas px-4 py-2 text-sm">
                Back to queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
