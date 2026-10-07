"use client";

/**
 * Softphone audio engine.
 * Generates realistic contact-centre tones with the Web Audio API so no
 * media files are required: incoming call ring cadence, queue chirps,
 * connect blip, hold music and busy/missed tone.
 */

const RING_ON = 2000;
const RING_OFF = 2000;

export class SoftphoneAudio {
  private ctx: AudioContext | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private holdTimer: ReturnType<typeof setInterval> | null = null;
  private master: GainNode | null = null;

  /** Must be called from a user gesture (click) to satisfy autoplay policy. */
  prime() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freqs: number[], durationMs: number, volume: number, type: OscillatorType = "sine") {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const seconds = durationMs / 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.setValueAtTime(volume, Math.max(now + 0.03, now + seconds - 0.04));
    gain.gain.linearRampToValueAtTime(0, now + seconds);
    gain.connect(master);
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    }
  }

  /** North-American style dual-tone ring burst (440 + 480 Hz) with tremolo. */
  private ringBurst() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const duration = RING_ON / 1000;

    const gain = ctx.createGain();
    const trem = ctx.createGain();
    trem.gain.value = 1;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.22;
    lfo.connect(lfoGain);
    lfoGain.connect(trem.gain);
    lfo.start(now);
    lfo.stop(now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.setValueAtTime(0.18, now + duration - 0.06);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    trem.connect(gain);
    gain.connect(master);

    for (const f of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(trem);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
  }

  /** Starts the ringing loop. onBurst fires at the start of every ring. */
  startRinging(onBurst?: () => void) {
    this.prime();
    this.stopRinging();
    const loop = () => {
      this.ringBurst();
      onBurst?.();
      this.ringTimer = setTimeout(loop, RING_ON + RING_OFF);
    };
    loop();
  }

  stopRinging() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
  }

  connectBlip() {
    this.prime();
    this.tone([880], 90, 0.12);
    setTimeout(() => this.tone([1320], 120, 0.1), 110);
  }

  queueChirp() {
    this.prime();
    this.tone([620, 780], 220, 0.07);
  }

  busyTone() {
    this.prime();
    this.tone([480, 620], 420, 0.13);
    setTimeout(() => this.tone([480, 620], 420, 0.13), 620);
  }

  click() {
    this.prime();
    this.tone([1100], 60, 0.06, "triangle");
  }

  /** Gentle looping hold "music" so hold feels real. */
  startHoldMusic() {
    this.prime();
    this.stopHoldMusic();
    const bar = () => {
      this.tone([523.25], 500, 0.045, "triangle");
      setTimeout(() => this.tone([659.25], 500, 0.045, "triangle"), 550);
      setTimeout(() => this.tone([783.99], 700, 0.04, "triangle"), 1100);
    };
    bar();
    this.holdTimer = setInterval(bar, 3600);
  }

  stopHoldMusic() {
    if (this.holdTimer) {
      clearInterval(this.holdTimer);
      this.holdTimer = null;
    }
  }

  stopAll() {
    this.stopRinging();
    this.stopHoldMusic();
  }

  dispose() {
    this.stopAll();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}

let shared: SoftphoneAudio | null = null;

export function softphone() {
  if (typeof window === "undefined") return null;
  if (!shared) shared = new SoftphoneAudio();
  return shared;
}

export function primeSoftphone() {
  softphone()?.prime();
}
