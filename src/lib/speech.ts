"use client";

/* Browser voice pipeline: microphone capture, automatic recording,
 * real-time speech-to-text, and text-to-speech for the AI customer.
 * Voice-only — there is no chat input between agent and customer. */

export type RecognitionResultItem = { transcript: string; confidence: number };

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [i: number]: RecognitionResultItem;
    };
  };
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

type RecognitionWindow = Window & {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
};

export function recognitionSupported() {
  if (typeof window === "undefined") return false;
  const w = window as RecognitionWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as RecognitionWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const FEMALE_HINTS = ["samantha", "victoria", "karen", "moira", "tessa", "fiona", "zira", "susan", "google us english"];

export function pickCustomerVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const named = pool.find((v) => FEMALE_HINTS.some((h) => v.name.toLowerCase().includes(h)));
  return named ?? pool[0] ?? null;
}

export function speak(
  text: string,
  opts: { rate?: number; pitch?: number; onEnd?: () => void; onStart?: () => void } = {},
) {
  if (!ttsSupported()) {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickCustomerVoice();
  if (voice) utter.voice = voice;
  utter.rate = opts.rate ?? 1;
  utter.pitch = opts.pitch ?? 1.05;
  utter.volume = 1;
  utter.onstart = () => opts.onStart?.();
  utter.onend = () => opts.onEnd?.();
  utter.onerror = () => opts.onEnd?.();
  synth.speak(utter);
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** Extract the first account-number-like token from spoken text. */
export function parseAccountNumber(text: string) {
  const letters = text.toUpperCase().match(/\b[A-Z]{2}[-\s]?\d{6,10}\b/);
  if (letters) return letters[0].replace(/\s+/g, "-");
  const digits = text.match(/\b\d[\d\s-]{6,}\d\b/);
  if (digits) return digits[0].replace(/[\s-]+/g, "").replace(/(\d{2})(\d{6,})/, "$1-$2");
  return null;
}

/** Capture a dictated password, handling common spoken words. */
export function parsePassword(text: string) {
  const cleaned = text
    .replace(/\b(the )?password is\b/gi, "")
    .replace(/\bit is\b/gi, "")
    .replace(/\bsymbol\b/gi, "")
    .trim()
    .replace(/\s+/g, "");
  return cleaned.length >= 3 ? cleaned : null;
}

export function parseName(text: string) {
  const m = text.match(/\b(?:this is|my name is|i am|it'?s)\s+([A-Za-z]+)\s+([A-Za-z]+)/i);
  if (m) return { first: m[1], last: m[2] };
  return null;
}

export function recorderSupported() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function pickAudioMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export async function blobToDataUrl(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:;base64,${btoa(binary)}`;
}
