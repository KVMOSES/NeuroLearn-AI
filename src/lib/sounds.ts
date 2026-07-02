/**
 * Sound effects system — subtle audio feedback for interactions.
 * Uses Web Audio API to generate tones (no audio files needed).
 * Sounds can be enabled/disabled via localStorage.
 */

let audioCtx: AudioContext | null = null;
let enabled: boolean | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function isEnabled(): boolean {
  if (enabled === null) {
    if (typeof window === "undefined") return false;
    enabled = localStorage.getItem("nl-sounds") !== "false";
  }
  return enabled;
}

export function setSoundsEnabled(value: boolean) {
  enabled = value;
  if (typeof window !== "undefined") {
    localStorage.setItem("nl-sounds", String(value));
  }
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.1, delay = 0) {
  if (!isEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export const sounds = {
  click: () => playTone(800, 0.05, "sine", 0.05),
  correct: () => {
    playTone(523, 0.1, "sine", 0.08); // C5
    playTone(659, 0.1, "sine", 0.08, 0.08); // E5
    playTone(784, 0.15, "sine", 0.08, 0.16); // G5
  },
  wrong: () => {
    playTone(300, 0.15, "sawtooth", 0.06);
    playTone(200, 0.2, "sawtooth", 0.06, 0.1);
  },
  achievement: () => {
    playTone(523, 0.1, "sine", 0.08);
    playTone(659, 0.1, "sine", 0.08, 0.1);
    playTone(784, 0.1, "sine", 0.08, 0.2);
    playTone(1047, 0.3, "sine", 0.1, 0.3); // C6
  },
  levelUp: () => {
    playTone(523, 0.08, "triangle", 0.08);
    playTone(659, 0.08, "triangle", 0.08, 0.08);
    playTone(784, 0.08, "triangle", 0.08, 0.16);
    playTone(1047, 0.08, "triangle", 0.08, 0.24);
    playTone(1319, 0.4, "triangle", 0.1, 0.32); // E6
  },
  lessonComplete: () => {
    playTone(659, 0.12, "sine", 0.08);
    playTone(880, 0.12, "sine", 0.08, 0.1);
    playTone(1047, 0.3, "sine", 0.1, 0.2);
  },
  missionComplete: () => {
    playTone(587, 0.1, "sine", 0.08); // D5
    playTone(698, 0.1, "sine", 0.08, 0.1); // F5
    playTone(880, 0.1, "sine", 0.08, 0.2); // A5
    playTone(1175, 0.4, "sine", 0.1, 0.3); // D6
  },
  timerFinish: () => {
    playTone(440, 0.2, "sine", 0.1);
    playTone(554, 0.2, "sine", 0.1, 0.2);
    playTone(659, 0.5, "sine", 0.1, 0.4);
  },
  documentAnalyzed: () => {
    playTone(523, 0.08, "sine", 0.06);
    playTone(784, 0.2, "sine", 0.08, 0.08);
  },
};
