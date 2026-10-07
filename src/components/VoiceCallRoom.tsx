"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ear,
  Hand,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Square,
  Volume2,
} from "lucide-react";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { Panel } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/utils";
import type { CustomerEmotion, CustomerTurn, VoiceStage } from "@/lib/customer-brain";
import type { Memory } from "@/lib/customer-memory";
import {
  blobToDataUrl,
  createRecognition,
  recorderSupported,
  recognitionSupported,
  speak,
  stopSpeaking,
  ttsSupported,
  type SpeechRecognitionLike,
} from "@/lib/speech";
import { primeSoftphone, softphone } from "@/lib/softphone-audio";
import type { TranscriptLine } from "@/db/schema";

export type CallPhase = "ringing" | "active" | "hold" | "ended";

type Props = {
  callId: string;
  customerName: string;
  customerMobile: string;
  queue: string;
  transferEnabled: boolean;
  ringTimeoutSeconds?: number;
  answered?: boolean;
  phase: CallPhase;
  transcript: TranscriptLine[];
  onPhaseChange: (phase: CallPhase) => void;
  onTranscriptChange: (lines: TranscriptLine[]) => void;
  onDisclosure: (d: CustomerTurn["disclosure"]) => void;
  seconds: number;
  onReject: () => Promise<void>;
  onMissed?: (ringTimeoutSeconds: number) => Promise<void>;
  onTransfer: (target: string) => Promise<void>;
  onComplete: (payload: { hasRecording: boolean }) => Promise<void>;
};

const STAGE_LABEL: Record<VoiceStage, string> = {
  greeting: "Greeting",
  identity: "Verification",
  password: "Verification",
  security: "Verification",
  discover: "Discovery",
  troubleshoot: "Troubleshooting",
  resolve: "Resolution",
  offer: "Offer",
  payment: "Payment",
  terms: "Disclosures",
  closing: "Closing",
};

const GUIDE = [
  "Greet with the brand, your first name, and ask permission to proceed.",
  "Ask for the first name, last name, then the account number.",
  "Request the password once. If it locks, pivot to the security question.",
  "Probe for impact: when it started, how many devices, what changed.",
  "Recap the resolution verbally and confirm the customer agrees.",
  "Offer one relevant add-on after the issue is resolved.",
  "Read the disclosures, capture agreement, then thank and close.",
];

function emptyMemory(): Memory {
  return {
    greeted: false,
    nameGiven: false,
    accountGiven: false,
    passwordGiven: 0,
    securityGiven: false,
    concernTold: 0,
    repeats: 0,
    offered: 0,
    paymentDone: false,
    termsDone: false,
  };
}

export function VoiceCallRoom({
  callId,
  customerName,
  customerMobile,
  queue,
  transferEnabled,
  ringTimeoutSeconds = 30,
  answered = false,
  phase,
  transcript,
  onPhaseChange,
  onTranscriptChange,
  onDisclosure,
  seconds,
  onReject,
  onMissed,
  onTransfer,
  onComplete,
}: Props) {
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [emotion, setEmotion] = useState<CustomerEmotion>("neutral");
  const [stage, setStage] = useState<VoiceStage>("greeting");
  const [hint, setHint] = useState("");
  const [level, setLevel] = useState(0);
  const [notice, setNotice] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [recState, setRecState] = useState<"idle" | "recording" | "saved">("idle");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<CallPhase>(phase);
  const mutedRef = useRef(false);
  const memoryRef = useRef<Memory>(emptyMemory());
  const secondsRef = useRef(seconds);
  const savedRef = useRef(false);
  const disclosureRef = useRef(onDisclosure);
  const transcriptRef = useRef(onTranscriptChange);

  phaseRef.current = phase;
  secondsRef.current = seconds;
  disclosureRef.current = onDisclosure;
  transcriptRef.current = onTranscriptChange;

  const stt = recognitionSupported();
  const tts = ttsSupported();
  const canRecord = recorderSupported();

  const stopMeters = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevel(0);
  }, []);

  const startMeters = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 320)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already running */
    }
  }, []);

  const sayCustomerLine = useCallback(
    (turn: CustomerTurn) => {
      setStage(turn.stage);
      setEmotion(turn.emotion);
      setHint(turn.hint || "");
      if (turn.disclosure) disclosureRef.current(turn.disclosure);
      stopSpeaking();
      speak(turn.text, {
        rate: turn.emotion === "angry" ? 1.12 : turn.emotion === "frustrated" ? 1.06 : turn.emotion === "calm" ? 0.95 : 1,
        pitch: turn.emotion === "pleased" ? 1.12 : 1.02,
        onStart: () => {
          setSpeaking(true);
          try {
            recognitionRef.current?.abort();
          } catch {
            /* noop */
          }
        },
        onEnd: () => {
          setSpeaking(false);
          if (phaseRef.current === "active" && !mutedRef.current) startRecognition();
        },
      });
    },
    [startRecognition],
  );

  const handleAgentUtterance = useCallback(
    async (text: string) => {
      if (phaseRef.current !== "active") return;
      setInterim("");
      try {
        const data = await api<{ turn: CustomerTurn; transcript: TranscriptLine[]; memoryUpdate: Memory }>(
          `/api/calls/${callId}/voice`,
          {
            method: "POST",
            body: JSON.stringify({
              agentText: text,
              durationSeconds: secondsRef.current,
              memory: memoryRef.current,
            }),
          },
        );
        memoryRef.current = data.memoryUpdate;
        transcriptRef.current(data.transcript);
        sayCustomerLine(data.turn);
      } catch {
        setNotice("Voice channel hiccup — keep speaking, it reconnects on your next turn.");
      }
    },
    [callId, sayCustomerLine],
  );

  const wireRecognition = useCallback(
    (rec: SpeechRecognitionLike) => {
      rec.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          const alt = res[0];
          if (!alt) continue;
          if (res.isFinal) finalText += alt.transcript;
          else interimText += alt.transcript;
        }
        if (phaseRef.current === "active") setInterim(interimText);
        const clean = finalText.trim();
        if (clean.length > 1 && phaseRef.current === "active") void handleAgentUtterance(clean);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setNotice("Microphone blocked. Allow mic access in the browser, then unmute.");
          setListening(false);
        }
      };
      rec.onend = () => {
        if (phaseRef.current === "active" && !mutedRef.current && !speaking) {
          setTimeout(() => {
            if (phaseRef.current === "active" && !mutedRef.current) startRecognition();
          }, 250);
        } else {
          setListening(false);
        }
      };
    },
    [handleAgentUtterance, startRecognition, speaking],
  );

  const openVoiceChannel = useCallback(async () => {
    try {
      const data = await api<{ turn: CustomerTurn; transcript: TranscriptLine[]; memoryUpdate: Memory }>(
        `/api/calls/${callId}/voice`,
        {
          method: "POST",
          body: JSON.stringify({ agentText: "", durationSeconds: 0, memory: memoryRef.current }),
        },
      );
      memoryRef.current = data.memoryUpdate;
      transcriptRef.current(data.transcript);
      sayCustomerLine(data.turn);
    } catch {
      setNotice("Could not start the customer voice channel.");
    }
  }, [callId, sayCustomerLine]);

  const pipelineStartedRef = useRef(false);

  const startVoicePipeline = useCallback(async () => {
    if (pipelineStartedRef.current) return;
    pipelineStartedRef.current = true;
    softphone()?.connectBlip();
    setNotice("");
    onPhaseChange("active");
    let recognized = false;

    if (canRecord) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "";
        const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1500);
        recorderRef.current = recorder;
        setRecState("recording");

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;
        startMeters();
      } catch {
        setNotice("Microphone permission denied. A voice call cannot be answered without audio.");
        pipelineStartedRef.current = false;
        onPhaseChange("ringing");
        return;
      }
    } else {
      setNotice("This browser cannot record audio. Use Chrome or Edge on desktop for full voice simulation.");
    }

    if (stt) {
      const rec = createRecognition();
      if (rec) {
        wireRecognition(rec);
        recognitionRef.current = rec;
        startRecognition();
        recognized = true;
      }
    }
    if (!recognized) {
      setNotice(
        "Live speech-to-text is unavailable here. Use Chrome or Edge on desktop so the agent can answer by voice.",
      );
    }

    await openVoiceChannel();
  }, [canRecord, onPhaseChange, openVoiceChannel, startMeters, startRecognition, stt, wireRecognition]);

  const acceptCall = useCallback(async () => {
    primeSoftphone();
    softphone()?.stopRinging();
    await startVoicePipeline();
  }, [startVoicePipeline]);

  // Arriving from the queue after the agent pressed Accept Call: open the
  // microphone immediately (the browser asks for permission here) and let the
  // AI customer open the conversation.
  useEffect(() => {
    if (!answered) return;
    primeSoftphone();
    void startVoicePipeline();
  }, [answered, startVoicePipeline]);

  const stopAudioPipeline = useCallback(() => {
    softphone()?.stopAll();
    stopSpeaking();
    setSpeaking(false);
    try {
      recognitionRef.current?.abort();
    } catch {
      /* noop */
    }
    setInterim("");
    setListening(false);
    stopMeters();
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => undefined);
    analyserRef.current = null;
  }, [stopMeters]);

  const archiveRecording = useCallback(async () => {
    if (savedRef.current) return true;
    const recorder = recorderRef.current;
    if (!recorder || chunksRef.current.length === 0) return false;
    savedRef.current = true;
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
    chunksRef.current = [];
    if (blob.size < 1200) return false;
    try {
      const dataUrl = await blobToDataUrl(blob);
      await api(`/api/calls/${callId}/audio`, {
        method: "POST",
        body: JSON.stringify({
          audioData: dataUrl,
          audioMime: recorder.mimeType || "audio/webm",
          audioDurationSeconds: secondsRef.current,
        }),
      });
      setRecState("saved");
      return true;
    } catch {
      setNotice("Recording exceeded the archive limit; the transcript is still saved.");
      return false;
    }
  }, [callId]);

  const endCall = useCallback(async () => {
    onPhaseChange("ended");
    stopAudioPipeline();
    const hasRecording = await archiveRecording();
    await onComplete({ hasRecording });
  }, [archiveRecording, onComplete, onPhaseChange, stopAudioPipeline]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !next;
    if (next) {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      setInterim("");
      setListening(false);
    } else if (phaseRef.current === "active") {
      startRecognition();
    }
  }, [startRecognition]);

  const toggleHold = useCallback(() => {
    if (phaseRef.current === "active") {
      phaseRef.current = "hold";
      onPhaseChange("hold");
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      stopSpeaking();
      setSpeaking(false);
      setListening(false);
      setInterim("");
      softphone()?.startHoldMusic();
    } else if (phaseRef.current === "hold") {
      phaseRef.current = "active";
      onPhaseChange("active");
      softphone()?.stopHoldMusic();
      if (!mutedRef.current) startRecognition();
    }
  }, [onPhaseChange, startRecognition]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      const rec = recorderRef.current;
      if (rec && rec.state === "recording") rec.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  const micPct = muted ? 0 : level;

  return (
    <div className="space-y-4">
      {phase === "ringing" && (
        <IncomingCallModal
          info={{
            callId,
            customerName,
            callType: queue,
            queue: `${queue} · Skill 14`,
            mobile: customerMobile,
            ringTimeoutSeconds,
          }}
          onAccept={() => {
            void acceptCall();
          }}
          onReject={() => {
            void onReject();
          }}
          onMissed={() => {
            if (onMissed) void onMissed(ringTimeoutSeconds);
            else void onReject();
          }}
        />
      )}

      <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-12 w-12 place-items-center rounded-2xl ${
                phase === "active"
                  ? "bg-ok/15 text-ok"
                  : phase === "hold"
                    ? "bg-gold/20 text-gold"
                    : "bg-canvas text-muted"
              }`}
            >
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">{customerName}</p>
              <p className="font-mono text-xs text-muted">
                {queue} · {STAGE_LABEL[stage]} · customer sounds {emotion}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl text-navy">{formatDuration(seconds)}</p>
            <p className="flex items-center justify-end gap-1 text-[11px] text-muted">
              <Radio className={`h-3 w-3 ${recState === "recording" ? "text-danger" : ""}`} />
              {recState === "saved" ? "recording archived" : recState === "recording" ? "recording" : "no recording"}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-100 ${speaking ? "bg-accent" : muted ? "bg-slate-300" : "bg-navy"}`}
            style={{ width: `${speaking ? 100 : Math.max(4, micPct)}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {speaking ? "AI customer speaking…" : muted ? "Your microphone is muted" : "Your microphone"}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={toggleMute}
            disabled={phase !== "active" && phase !== "hold"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-40 ${muted ? "bg-danger text-white" : "bg-canvas"}`}
          >
            {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={toggleHold}
            disabled={phase !== "active" && phase !== "hold"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-40 ${phase === "hold" ? "bg-gold text-navy" : "bg-canvas"}`}
          >
            <Hand className="h-3.5 w-3.5" />
            {phase === "hold" ? "Resume" : "Hold"}
          </button>
          {transferEnabled && (
            <button
              onClick={() => setTransferring(true)}
              disabled={phase !== "active" && phase !== "hold"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-canvas px-3 py-2 text-xs font-medium disabled:opacity-40"
            >
              <Ear className="h-3.5 w-3.5" />
              Transfer
            </button>
          )}
          <button
            onClick={endCall}
            disabled={phase === "ended" || phase === "ringing"}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End call & evaluate
          </button>
        </div>

        {phase === "hold" && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            On hold — the timer runs, the customer cannot hear you, and recognition is paused. Press
            Resume to continue.
          </p>
        )}
        {notice && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">{notice}</p>}
        {!tts && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-danger">
            This browser cannot synthesise the customer voice. Use Chrome, Edge, or Safari.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
        <Panel
          title="Live voice transcript (speech-to-text)"
          action={
            <span className="flex items-center gap-2 text-[11px] text-muted">
              <span className={`h-2 w-2 rounded-full ${listening && !muted ? "animate-pulse bg-ok" : "bg-slate-300"}`} />
              {muted ? "mic muted" : listening ? "listening" : "idle"}
            </span>
          }
        >
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {transcript.length === 0 && (
              <p className="text-sm text-muted">
                {phase === "ringing"
                  ? "Transcript begins when you accept the call."
                  : "No speech captured."}
              </p>
            )}
            {transcript.map((line, i) => (
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
          </div>
          {interim && (
            <p className="mt-2 rounded-xl bg-navy/5 px-3 py-2 text-sm italic text-muted">{interim}…</p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Speech is transcribed automatically. There is no chat box — answer the customer by voice.
          </p>
        </Panel>

        <Panel title="Voice coaching guide">
          <ul className="space-y-2 text-xs text-muted">
            {GUIDE.map((g) => (
              <li key={g} className="flex gap-2">
                <Square className="mt-1 h-2 w-2 shrink-0 text-accent" />
                {g}
              </li>
            ))}
          </ul>
          {hint && <p className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-xs text-accent-2">{hint}</p>}
          <p className="mt-3 flex items-center gap-1 text-[11px] text-muted">
            <Volume2 className="h-3 w-3" />
            The AI customer replies out loud after every turn you speak.
          </p>
        </Panel>
      </div>

      {transferring && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-navy/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">Warm transfer</h3>
            <p className="mt-1 text-sm text-muted">
              Choose the receiving queue. Notes, transcript, and recording follow the contact.
            </p>
            <div className="mt-4 space-y-2">
              {["Tier 2 · Fiber Support", "Billing Back Office", "Retention Desk", "Fraud & Security"].map(
                (t) => (
                  <button
                    key={t}
                    onClick={async () => {
                      setTransferring(false);
                      phaseRef.current = "ended";
                      onPhaseChange("ended");
                      stopAudioPipeline();
                      await archiveRecording();
                      await onTransfer(t);
                    }}
                    className="w-full rounded-xl bg-canvas px-3 py-2 text-left text-sm hover:bg-line/40"
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            <button onClick={() => setTransferring(false)} className="mt-4 text-sm text-muted">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
