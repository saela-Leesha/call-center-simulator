"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Headphones, ListOrdered, PhoneCall, PhoneOff, Signal } from "lucide-react";
import { softphone } from "@/lib/softphone-audio";

export type IncomingCallInfo = {
  callId: string;
  customerName: string;
  callType: string;
  queue: string;
  mobile?: string;
  difficulty?: string;
  ringTimeoutSeconds: number;
};

/**
 * Full-screen incoming-call pop-up with a looping softphone ringtone.
 * Rings until the agent accepts, rejects, or the configured timeout elapses.
 */
export function IncomingCallModal({
  info,
  onAccept,
  onReject,
  onMissed,
}: {
  info: IncomingCallInfo;
  onAccept: () => void;
  onReject: () => void;
  onMissed: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [ring, setRing] = useState(0);
  const [closing, setClosing] = useState<null | "accept" | "reject" | "missed">(null);
  const settled = useRef(false);
  const audio = softphone();

  const remaining = Math.max(0, info.ringTimeoutSeconds - elapsed);

  useEffect(() => {
    audio?.startRinging(() => setRing((r) => r + 1));
    return () => audio?.stopRinging();
  }, [audio]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining > 0 || settled.current) return;
    settled.current = true;
    audio?.stopRinging();
    audio?.busyTone();
    setClosing("missed");
    setTimeout(() => onMissed(), 900);
  }, [remaining, audio, onMissed]);

  function settle(kind: "accept" | "reject") {
    if (settled.current) return;
    settled.current = true;
    audio?.stopRinging();
    if (kind === "accept") audio?.connectBlip();
    else audio?.busyTone();
    setClosing(kind);
    setTimeout(() => (kind === "accept" ? onAccept() : onReject()), 700);
  }

  const pct = info.ringTimeoutSeconds > 0 ? (remaining / info.ringTimeoutSeconds) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-navy/85 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-[0_40px_120px_rgba(7,20,40,0.5)] ${
          closing ? "animate-[callPop_0.3s_ease-out_reverse]" : "animate-[callPop_0.45s_cubic-bezier(0.2,1.2,0.3,1)]"
        }`}
      >
        <div className="relative bg-navy px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-accent">
              <Signal className="h-3.5 w-3.5" /> Incoming call
            </p>
            <p className="font-mono text-xs text-white/60">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <span key={ring} className="relative grid h-16 w-16 shrink-0 place-items-center">
              <span className="absolute inset-0 animate-[ringPulse_2s_ease-out_infinite] rounded-full bg-accent/25" />
              <span className="absolute inset-2 animate-[ringPulse_2s_ease-out_infinite_0.35s] rounded-full bg-accent/20" />
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-accent text-navy">
                <Headphones className="h-7 w-7" />
              </span>
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-semibold">{info.customerName}</h3>
              <p className="font-mono text-sm text-white/70">{info.mobile ?? "Unknown number"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <p className="rounded-xl bg-white/8 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-white/50">Call type</span>
              <span className="font-medium">{info.callType}</span>
            </p>
            <p className="rounded-xl bg-white/8 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-white/50">Queue</span>
              <span className="flex items-center gap-1 font-medium">
                <ListOrdered className="h-3 w-3" /> {info.queue}
              </span>
            </p>
            <p className="rounded-xl bg-white/8 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-white/50">Status</span>
              <span className="font-medium text-accent">
                {closing === "missed" ? "Missed call" : closing ? "Answering" : `Ringing · ring ${ring + 1}`}
              </span>
            </p>
            <p className="rounded-xl bg-white/8 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-white/50">Time left to answer</span>
              <span className={`font-mono font-medium ${remaining <= 10 ? "text-danger" : "text-accent"}`}>
                {remaining}s
              </span>
            </p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                remaining <= 10 ? "bg-danger" : "bg-accent"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <p className="max-w-[46%] text-xs text-muted">
            <Clock className="mr-1 inline h-3 w-3" />
            Voice-only contact. Accept to open the headset channel — there is no chat.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => settle("reject")}
              className="inline-flex items-center gap-2 rounded-2xl bg-canvas px-5 py-3 text-sm font-semibold text-danger ring-1 ring-line transition hover:bg-rose-50"
            >
              <PhoneOff className="h-4 w-4" />
              Reject call
            </button>
            <button
              onClick={() => settle("accept")}
              className="inline-flex items-center gap-2 rounded-2xl bg-ok px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-ok/25 transition hover:brightness-110"
            >
              <PhoneCall className="h-4 w-4 animate-[ringPulse_1.6s_ease-out_infinite]" />
              Accept call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
