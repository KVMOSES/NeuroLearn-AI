/**
 * High-quality audio system for Focus Timer.
 * Generates calming, non-irritating sounds using Web Audio API synthesis.
 * All sounds are preloaded and low-latency.
 */

// ============================================================
// SOUND DEFINITIONS
// ============================================================

export interface SoundDefinition {
  key: string;
  label: string;
  icon: string;
}

export const TIMER_SOUNDS: SoundDefinition[] = [
  { key: "chime", label: "Soft Chime", icon: "🔔" },
  { key: "bell", label: "Gentle Bell", icon: "🔕" },
  { key: "natures", label: "Nature Ripple", icon: "🍃" },
  { key: "lofi", label: "Lo-fi Click", icon: "🎵" },
  { key: "zen", label: "Zen Bowl", icon: "🪇" },
  { key: "none", label: "Silent", icon: "🔇" },
];

// ============================================================
// AUDIO CONTEXT (lazy singleton)
// ============================================================

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

// ============================================================
// MASTER VOLUME CONTROL
// ============================================================

let masterVolume = 0.5;
let isMuted = false;

export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
}

export function getMasterVolume(): number {
  return masterVolume;
}

export function setMuted(muted: boolean) {
  isMuted = muted;
}

export function getMuted(): boolean {
  return isMuted;
}

function getGain(vol: number = 1): GainNode {
  const gain = getCtx().createGain();
  gain.gain.value = isMuted ? 0 : vol * masterVolume;
  return gain;
}

// ============================================================
// SOUND GENERATORS — high-quality, calming tones
// ============================================================

/**
 * Soft chime — for START timer.
 * A gentle rising tone with a soft attack.
 */
function playStartChime() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.4);
  gain.connect(c.destination);

  // Two-tone ascending chime
  [523.25, 659.25].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + i * 0.12);
    g.gain.linearRampToValueAtTime(0.5, now + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.6);
  });
}

/**
 * Soft chime descending — for PAUSE timer.
 */
function playPauseChime() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.3);
  gain.connect(c.destination);

  [440, 349.23].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + i * 0.15);
    g.gain.linearRampToValueAtTime(0.4, now + i * 0.15 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.5);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.5);
  });
}

/**
 * Ascending arpeggio — for RESUME timer.
 */
function playResumeChime() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.35);
  gain.connect(c.destination);

  [392, 523.25, 659.25].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + i * 0.08);
    g.gain.linearRampToValueAtTime(0.45, now + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.4);
  });
}

/**
 * Triumphant ring — for SESSION COMPLETE.
 * A satisfying, rewarding bell-like sound.
 */
function playSessionComplete() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.5);
  gain.connect(c.destination);

  // Rich chord: C major (C4, E4, G4)
  [261.63, 329.63, 392, 523.25].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    
    const g = c.createGain();
    const t = now + i * 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.linearRampToValueAtTime(0.3, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(t);
    osc.stop(t + 1.5);
  });

  // Add a gentle harmonic shimmer
  setTimeout(() => {
    try {
      const shimmer = c.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 1046.5; // C6
      const sg = c.createGain();
      sg.gain.setValueAtTime(0, c.currentTime);
      sg.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
      shimmer.connect(sg);
      sg.connect(gain);
      shimmer.start();
      shimmer.stop(c.currentTime + 0.8);
    } catch {}
  }, 500);
}

/**
 * Gentle notification — for BREAK COMPLETE.
 * A soft, non-intrusive tap.
 */
function playBreakComplete() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.3);
  gain.connect(c.destination);

  [392, 440].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    
    const g = c.createGain();
    const t = now + i * 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(t);
    osc.stop(t + 0.7);
  });
}

/**
 * Gentle bell — generic notification sound.
 */
function playGentleBell() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.3);
  gain.connect(c.destination);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 880;
  
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.4, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  
  osc.connect(g);
  g.connect(gain);
  osc.start(now);
  osc.stop(now + 1.2);
}

/**
 * Nature ripple — water drop like gentle plink.
 */
function playNatureRipple() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.25);
  gain.connect(c.destination);

  for (let i = 0; i < 3; i++) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 600 + i * 100;
    
    const g = c.createGain();
    const t = now + i * 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

/**
 * Lo-fi click — a warm, vinyl-like tap.
 */
function playLofiClick() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.3);
  gain.connect(c.destination);

  // Low-passed noise burst
  const bufferSize = c.sampleRate * 0.08;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.02));
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  
  source.connect(filter);
  filter.connect(gain);
  source.start(now);
}

/**
 * Zen bowl — a resonant, meditative tone.
 */
function playZenBowl() {
  const c = getCtx();
  const now = c.currentTime;
  const gain = getGain(0.3);
  gain.connect(c.destination);

  // Rich harmonic series
  [220, 330, 440, 550].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + i * 0.05);
    g.gain.linearRampToValueAtTime(0.3 - i * 0.05, now + i * 0.05 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 3);
    
    osc.connect(g);
    g.connect(gain);
    osc.start(now + i * 0.05);
    osc.stop(now + 3);
  });
}

// ============================================================
// AMBIENT SOUND GENERATORS (replacing the old implementation)
// ============================================================

export interface AmbientDefinition {
  key: string;
  label: string;
  icon: string;
}

export const AMBIENT_SOUNDS: AmbientDefinition[] = [
  { key: "none", label: "None", icon: "🔇" },
  { key: "rain", label: "Rain", icon: "🌧️" },
  { key: "forest", label: "Forest", icon: "🌲" },
  { key: "ocean", label: "Ocean", icon: "🌊" },
  { key: "cafe", label: "Café", icon: "☕" },
  { key: "lofi", label: "Lo-fi", icon: "🎵" },
  { key: "whitenoise", label: "White Noise", icon: "📻" },
];

let ambientCtx: AudioContext | null = null;
let ambientNodes: AudioNode[] = [];

export function startAmbient(type: string, vol: number) {
  stopAmbient();
  if (type === "none") return;
  if (typeof window === "undefined") return;

  try {
    ambientCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch { return; }

  const masterGain = ambientCtx.createGain();
  masterGain.gain.value = (isMuted ? 0 : vol) * 0.3;
  masterGain.connect(ambientCtx.destination);

  if (type === "rain") {
    // Filtered noise — calming rain
    const bufferSize = 2 * ambientCtx.sampleRate;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ambientCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    source.connect(filter);
    filter.connect(masterGain);
    source.start();
    ambientNodes.push(source, filter);
  } else if (type === "whitenoise") {
    // Softer white noise
    const bufferSize = 2 * ambientCtx.sampleRate;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ambientCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 3000;
    filter.Q.value = 0.3;
    source.connect(filter);
    filter.connect(masterGain);
    source.start();
    ambientNodes.push(source, filter);
  } else if (type === "ocean") {
    // Gentle wave oscillation
    const osc = ambientCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 0.08;
    const gain = ambientCtx.createGain();
    gain.gain.value = 0.4;
    const lfo = ambientCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    const lfoGain = ambientCtx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    lfo.start();
    ambientNodes.push(osc, lfo, gain, lfoGain);
  } else if (type === "forest") {
    // Brown noise — deeper, more natural
    const bufferSize = 2 * ambientCtx.sampleRate;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const source = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ambientCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    source.connect(filter);
    filter.connect(masterGain);
    source.start();
    ambientNodes.push(source, filter);
  } else if (type === "cafe") {
    // Brown noise with higher frequency — cafe bustle
    const bufferSize = 2 * ambientCtx.sampleRate;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const source = ambientCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ambientCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.4;
    source.connect(filter);
    filter.connect(masterGain);
    source.start();
    ambientNodes.push(source, filter);
  } else if (type === "lofi") {
    // Warm hum with gentle wobble
    const osc = ambientCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 220;
    const gain = ambientCtx.createGain();
    gain.gain.value = 0.12;
    const wobble = ambientCtx.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = 0.3;
    const wobbleGain = ambientCtx.createGain();
    wobbleGain.gain.value = 10;
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    wobble.start();
    ambientNodes.push(osc, wobble, gain, wobbleGain);
  }
}

export function stopAmbient() {
  ambientNodes.forEach((n) => {
    try {
      if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) {
        n.stop();
      }
    } catch {}
  });
  ambientNodes = [];
  if (ambientCtx) {
    try { ambientCtx.close(); } catch {}
    ambientCtx = null;
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export type TimerEvent = "start" | "pause" | "resume" | "session_complete" | "break_complete";

/**
 * Play a timer event sound based on the selected sound profile.
 */
export function playTimerSound(event: TimerEvent, soundKey: string = "chime") {
  if (isMuted || soundKey === "none") return;

  // Map event to the sound function based on selected sound profile
  // The profile determines the sound CHARACTER, the event determines the MELODY
  switch (event) {
    case "start":
      if (soundKey === "natures") playNatureRipple();
      else if (soundKey === "lofi") playLofiClick();
      else if (soundKey === "zen") playZenBowl();
      else playStartChime(); // default: chime, bell
      break;
    case "pause":
      playPauseChime();
      break;
    case "resume":
      playResumeChime();
      break;
    case "session_complete":
      playSessionComplete();
      break;
    case "break_complete":
      if (soundKey === "bell") playGentleBell();
      else playBreakComplete();
      break;
  }
}

/**
 * Preload audio context (call on user interaction to ensure audio works).
 */
export function preloadAudio() {
  getCtx(); // Initialize context
}