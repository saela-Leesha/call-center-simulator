"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { api } from "@/lib/client";

type Config = {
  id?: string;
  cohortName: string;
  passingScore: number;
  floorTarget: number;
  maxPasswordAttempts: number;
  allowTransfer: boolean;
  autoReleaseCertificates: boolean;
  aiStrictness: string;
  requireRecording: boolean;
  ringTimeoutSeconds: number;
  queueAutoDispatch: boolean;
};

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ settings: Config }>("/api/settings")
      .then((d) => setCfg(d.settings))
      .catch((e: Error) => setMessage(e.message));
  }, []);

  async function save() {
    if (!cfg) return;
    setMessage("");
    try {
      const d = await api<{ settings: Config }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(cfg),
      });
      setCfg(d.settings);
      setMessage("Settings saved. Live scenarios and the AI Supervisor now use these values.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    }
  }

  if (!cfg) return <p className="text-muted">{message || "Loading settings…"}</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Configuration</p>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted">
          Control the simulation floor: passing thresholds, verification rules, transfer permission,
          recording policy, and AI Supervisor strictness.
        </p>
      </div>

      {message && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-accent-2">{message}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Cohort & scoring">
          <label className="block text-sm">
            Cohort name
            <input
              value={cfg.cohortName}
              onChange={(e) => setCfg({ ...cfg, cohortName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="mt-3 block text-sm">
            Passing score ({cfg.passingScore})
            <input
              type="range"
              min={50}
              max={100}
              value={cfg.passingScore}
              onChange={(e) => setCfg({ ...cfg, passingScore: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="mt-3 block text-sm">
            Floor / promotion target ({cfg.floorTarget})
            <input
              type="range"
              min={50}
              max={100}
              value={cfg.floorTarget}
              onChange={(e) => setCfg({ ...cfg, floorTarget: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
        </Panel>

        <Panel title="Verification & compliance">
          <label className="block text-sm">
            Max password attempts before lockout ({cfg.maxPasswordAttempts})
            <input
              type="range"
              min={1}
              max={5}
              value={cfg.maxPasswordAttempts}
              onChange={(e) => setCfg({ ...cfg, maxPasswordAttempts: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.allowTransfer}
              onChange={(e) => setCfg({ ...cfg, allowTransfer: e.target.checked })}
            />
            Allow call transfer (applies to all scenarios)
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.requireRecording}
              onChange={(e) => setCfg({ ...cfg, requireRecording: e.target.checked })}
            />
            Require automatic call recording
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.autoReleaseCertificates}
              onChange={(e) => setCfg({ ...cfg, autoReleaseCertificates: e.target.checked })}
            />
            Auto-release newly issued certificates to students
          </label>
        </Panel>

        <Panel title="AI Supervisor">
          <div className="flex gap-2">
            {(["lenient", "balanced", "strict"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setCfg({ ...cfg, aiStrictness: s })}
                className={`flex-1 rounded-xl px-3 py-2 text-sm capitalize ${
                  cfg.aiStrictness === s ? "bg-navy text-white" : "bg-canvas"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            <strong>Lenient</strong> rewards effort and forgives minor documentation gaps.{" "}
            <strong>Balanced</strong> matches a typical BPO QA scorecard.{" "}
            <strong>Strict</strong> mirrors a regulated telecommunications floor where a missed
            verification step or disclosure is a critical failure.
          </p>
        </Panel>

        <Panel title="Incoming call & queue behaviour">
          <label className="block text-sm">
            Ring timeout — seconds before a call is marked missed ({cfg.ringTimeoutSeconds}s)
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={cfg.ringTimeoutSeconds}
              onChange={(e) => setCfg({ ...cfg, ringTimeoutSeconds: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.queueAutoDispatch}
              onChange={(e) => setCfg({ ...cfg, queueAutoDispatch: e.target.checked })}
            />
            Auto-dispatch inbound calls to available agents
          </label>
          <p className="mt-3 text-xs text-muted">
            When auto-dispatch is on, any agent whose status is <strong>Available</strong> receives the
            next waiting customer after a short queue delay. The ringtone loops until they accept,
            reject, or the timeout above elapses — after which the contact is logged as a missed call.
          </p>
        </Panel>

        <Panel title="Voice simulation policy">
          <ul className="space-y-2 text-sm text-muted">
            <li>• Contacts are voice-only: microphone input, no chat channel.</li>
            <li>• The AI customer speaks via speech synthesis and expects verbal answers.</li>
            <li>• Speech-to-text produces the live transcript, saved automatically at call end.</li>
            <li>• Recordings and transcripts are stored in Call History for QA review.</li>
          </ul>
        </Panel>
      </div>

      <button onClick={save} className="rounded-xl bg-accent-2 px-5 py-2.5 text-sm font-semibold text-white">
        Save settings
      </button>
    </div>
  );
}
