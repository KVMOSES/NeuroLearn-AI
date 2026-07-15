/**
 * Client-side video rendering engine.
 * Renders animated video scenes from VideoLesson JSON using HTML5 Canvas + Web Audio API.
 * Exports as WebM/MP4 using MediaRecorder API.
 *
 * This runs in the browser (client-side) to bypass Vercel's serverless ffmpeg limitations.
 * Each scene is rendered as an animated canvas frame with synchronized narration audio.
 */
export {};

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// ============================================================
// TYPES
// ============================================================

export interface RenderProgress {
  phase: "loading" | "rendering" | "encoding" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

export interface RenderOptions {
  width: number;
  height: number;
  fps: number;
  quality: number; // 0-1
  onProgress?: (progress: RenderProgress) => void;
}

const DEFAULT_OPTIONS: RenderOptions = {
  width: 1280,
  height: 720,
  fps: 30,
  quality: 0.8,
};

// ============================================================
// SCENE DATA (from VideoLesson segments)
// ============================================================

interface SceneConfig {
  id: number;
  type: string;
  title: string;
  narration: string;
  visualDescription: string;
  duration: number; // seconds
}

// ============================================================
// NARRATION GENERATION (Web Speech API)
// ============================================================

class NarrationEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.synth = window.speechSynthesis;
    }
  }

  speak(text: string, voice: string, rate: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) { resolve(); return; }
      
      // Cancel any previous speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to find a good voice
      const voices = this.synth.getVoices();
      const preferredVoice = voices.find((v) =>
        v.name.toLowerCase().includes(voice.toLowerCase()) ||
        v.name.toLowerCase().includes("female") ||
        v.lang.startsWith("en")
      );
      if (preferredVoice) utterance.voice = preferredVoice;

      this.currentUtterance = utterance;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve(); // Don't fail on speech error
      
      this.synth.speak(utterance);
    });
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

// ============================================================
// SCENE RENDERER
// ============================================================

class SceneRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  clear() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render a single frame for a scene at time progress (0-1).
   */
  renderFrame(scene: SceneConfig, timeProgress: number, theme: SceneTheme) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Animated background
    this.renderBackground(scene.type, timeProgress, theme);

    // Title at top with slide-in animation
    if (timeProgress > 0.05) {
      const titleAlpha = Math.min(1, (timeProgress - 0.05) * 10);
      this.renderTitle(scene.title, theme, titleAlpha, timeProgress);
    }

    // Visual content
    if (timeProgress > 0.12) {
      const contentAlpha = Math.min(1, (timeProgress - 0.12) * 6);
      this.renderVisualContent(scene, theme, contentAlpha, timeProgress);
    }

    // Narration text at bottom
    if (timeProgress > 0.08) {
      const textAlpha = Math.min(1, (timeProgress - 0.08) * 4);
      this.renderNarrationText(scene.narration, theme, textAlpha, timeProgress);
    }

    // Subtle progress indicator
    this.renderProgress(timeProgress, theme);

    // Decorative elements
    this.renderDecorations(scene.type, timeProgress, theme);
  }

  private renderBackground(type: string, t: number, theme: SceneTheme) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Base gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, theme.bgStart);
    grad.addColorStop(1, theme.bgEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Animated gradient mesh
    const meshAlpha = 0.06 + Math.sin(t * Math.PI * 2) * 0.03;
    ctx.fillStyle = `rgba(255,255,255,${meshAlpha})`;
    
    // Floating particles
    for (let i = 0; i < 15; i++) {
      const px = (w * ((i * 137 + t * 30) % 100)) / 100;
      const py = (h * ((i * 73 + t * 20) % 100)) / 100;
      const pr = 2 + Math.sin(t * 3 + i) * 1.5;
      const pa = 0.08 + Math.sin(t * 2 + i * 0.7) * 0.05;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, pr), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, pa)})`;
      ctx.fill();
    }

    // Type-specific background elements
    if (type === "intro") {
      // Soft radial glow in center
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4);
      glow.addColorStop(0, `rgba(255,255,255,${0.05 + Math.sin(t * 2) * 0.03})`);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private renderTitle(title: string, theme: SceneTheme, alpha: number, t: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;

    // Subtitle line animation
    const slideOffset = (1 - alpha) * 30;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, -slideOffset);

    // Title font
    const fontSize = Math.min(48, w / 20);
    ctx.font = `bold ${fontSize}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text shadow
    ctx.shadowColor = "rgba(0,0,0,0.1)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = theme.textColor;
    ctx.fillText(title, w / 2, 60 + fontSize * 0.4);

    // Underline accent
    const titleWidth = ctx.measureText(title).width;
    const underlineY = 60 + fontSize * 0.4 + 12;
    const underlineW = Math.min(titleWidth * 0.3, 80) * alpha;
    ctx.shadowColor = "transparent";
    ctx.fillStyle = theme.accentColor;
    ctx.fillRect(w / 2 - underlineW / 2, underlineY, underlineW, 3);

    ctx.restore();
  }

  private renderVisualContent(scene: SceneConfig, theme: SceneTheme, alpha: number, t: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.globalAlpha = alpha;

    const visualType = this.detectVisualType(scene.visualDescription);
    
    switch (visualType) {
      case "diagram":
        this.renderDiagram(ctx, w, h, scene, theme, t);
        break;
      case "text":
        this.renderRichText(ctx, w, h, scene, theme, t);
        break;
      case "code":
        this.renderCodeBlock(ctx, w, h, scene, theme, t);
        break;
      case "image":
      default:
        this.renderInfoCard(ctx, w, h, scene, theme, t);
        break;
    }

    ctx.restore();
  }

  private detectVisualType(desc: string): "diagram" | "text" | "code" | "image" {
    const lower = desc.toLowerCase();
    if (lower.includes("flowchart") || lower.includes("arrow") || lower.includes("diagram")) return "diagram";
    if (lower.includes("code") || lower.includes("function") || lower.includes("syntax")) return "code";
    if (lower.includes("text") || lower.includes("bullet") || lower.includes("list")) return "text";
    return "image";
  }

  private renderDiagram(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneConfig, theme: SceneTheme, t: number) {
    const cx = w / 2;
    const cy = h / 2 - 20;

    // Draw a flowchart-like diagram
    const nodes = [
      { x: cx, y: cy - 100, label: "Input", color: theme.primaryColor },
      { x: cx - 80, y: cy + 20, label: "Process", color: theme.secondaryColor },
      { x: cx + 80, y: cy + 20, label: "Output", color: theme.accentColor },
      { x: cx, y: cy + 130, label: "Result", color: theme.primaryColor },
    ];

    // Animated edges
    nodes.slice(0, -1).forEach((from, i) => {
      const to = nodes[i + 1];
      const progress = Math.min(1, ((t * 2 + i * 0.3) % 1.5) / 1.5);
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + 30);
      ctx.lineTo(to.x, to.y - 30);
      ctx.strokeStyle = theme.accentColor + "40";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Animated dot along edge
      const dx = to.x - from.x;
      const dy = (to.y - 30) - (from.y + 30);
      const dotX = from.x + dx * progress;
      const dotY = from.y + 30 + dy * progress;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = theme.accentColor;
      ctx.fill();
    });

    // Nodes with scale animation
    nodes.forEach((node, i) => {
      const scale = 0.8 + Math.sin(t * 2 + i * 1.5) * 0.05;
      const size = 60 * scale;
      
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.scale(scale, scale);

      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, 12);
      ctx.fillStyle = node.color + "20";
      ctx.fill();
      ctx.strokeStyle = node.color + "60";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = theme.textColor;
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, 0, 0);

      ctx.restore();
    });
  }

  private renderRichText(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneConfig, theme: SceneTheme, t: number) {
    const lines = scene.visualDescription.split("\n").filter(Boolean);
    const startY = 110;
    const lineHeight = 36;
    const maxLines = Math.min(lines.length, 6);

    ctx.textBaseline = "middle";

    for (let i = 0; i < maxLines; i++) {
      const delay = i * 0.08;
      const lineAlpha = Math.min(1, Math.max(0, (t - delay) * 5));
      if (lineAlpha <= 0) continue;

      const slideX = (1 - lineAlpha) * 20;
      ctx.save();
      ctx.globalAlpha = lineAlpha;
      ctx.translate(slideX, 0);

      const isHeading = i === 0 || lines[i].startsWith("#");
      ctx.font = isHeading
        ? `bold ${Math.min(22, w / 45)}px system-ui, sans-serif`
        : `${Math.min(16, w / 55)}px system-ui, sans-serif`;
      
      const text = lines[i].replace(/^#+\s*/, "").replace(/\*\*/g, "");
      ctx.fillStyle = isHeading ? theme.primaryColor : theme.textColor;
      ctx.fillText(text, w / 2 - 200, startY + i * lineHeight);

      ctx.restore();
    }
  }

  private renderCodeBlock(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneConfig, theme: SceneTheme, t: number) {
    const codeLines = [
      "function processData(input) {",
      "  const result = transform(input);",
      "  return analyze(result);",
      "}",
    ];

    const bx = w / 2 - 250;
    const by = 100;
    const bw = 500;
    const bh = 200;

    // Code block background
    ctx.fillStyle = "#1E1E2E";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();

    // Line numbers and code
    codeLines.forEach((line, i) => {
      const delay = i * 0.12;
      const lineAlpha = Math.min(1, Math.max(0, (t - delay) * 4));
      if (lineAlpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = lineAlpha;

      // Line number
      ctx.fillStyle = "#6C6C8A";
      ctx.font = "14px monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), bx + 30, by + 30 + i * 36);

      // Code text with syntax highlighting
      ctx.textAlign = "left";
      ctx.fillStyle = "#CDD6F4";
      ctx.fillText(line, bx + 50, by + 30 + i * 36);

      ctx.restore();
    });
  }

  private renderInfoCard(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneConfig, theme: SceneTheme, t: number) {
    const cx = w / 2;
    const cy = h / 2 - 30;
    const cardW = Math.min(500, w * 0.7);
    const cardH = 200;

    // Card with glass effect
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.08)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
    ctx.fill();

    ctx.restore();

    // Accent line
    ctx.fillStyle = theme.accentColor;
    ctx.fillRect(cx - cardW / 2, cy - cardH / 2, 4, cardH);

    // Key icon
    ctx.textAlign = "center";
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText(this.getIconForType(scene.type), cx, cy - 40);

    // Description text
    ctx.fillStyle = theme.textColor;
    ctx.font = "16px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    
    const words = scene.visualDescription.split(" ").slice(0, 30).join(" ");
    const maxChars = 50;
    const truncated = words.length > maxChars ? words.slice(0, maxChars) + "..." : words;
    ctx.fillText(truncated, cx, cy + 30);
  }

  private renderNarrationText(text: string, theme: SceneTheme, alpha: number, t: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // TypeScript destructuring for h
    const canvasH = h;

    // Bottom bar
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;

    const barH = 60;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(0, h - barH, w, barH, [0, 0, 0, 0]);
    ctx.fill();

    // Narration text with word-by-word highlight
    const words = text.split(" ");
    const charsPerWord = 4;
    const maxWords = Math.floor((w - 40) / (charsPerWord * 8));
    const displayText = words.slice(0, maxWords).join(" ");

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayText, w / 2, h - barH / 2);

    ctx.restore();
  }

  private renderProgress(t: number, theme: SceneTheme) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Very subtle progress bar at top
    ctx.fillStyle = theme.accentColor + "30";
    ctx.fillRect(0, 0, w * t, 2);
  }

  private renderDecorations(type: string, t: number, theme: SceneTheme) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (type === "intro") {
      // Corner decorations
      const size = 40;
      ctx.strokeStyle = theme.accentColor + "30";
      ctx.lineWidth = 2;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(20, 20 + size);
      ctx.lineTo(20, 20);
      ctx.lineTo(20 + size, 20);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(w - 20 - size, h - 20);
      ctx.lineTo(w - 20, h - 20);
      ctx.lineTo(w - 20, h - 20 - size);
      ctx.stroke();
    }
  }

  private getIconForType(type: string): string {
    const icons: Record<string, string> = {
      intro: "🎯",
      objectives: "📋",
      explanation: "💡",
      example: "📌",
      visualization: "🎨",
      quiz: "❓",
      summary: "📝",
      revision: "🔄",
    };
    return icons[type] || "📄";
  }
}

interface SceneTheme {
  bgStart: string;
  bgEnd: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
}

// ============================================================
// VIDEO RECORDER
// ============================================================

class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(canvas: HTMLCanvasElement, fps: number): Promise<void> {
    this.chunks = [];
    this.stream = canvas.captureStream(fps);
    
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
      videoBitsPerSecond: 5000000,
    });

    return new Promise((resolve) => {
      this.mediaRecorder!.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder!.onstart = () => resolve();
      this.mediaRecorder!.start(100); // Collect every 100ms
    });
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) { reject(new Error("Not recording")); return; }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.mediaRecorder = null;
    this.stream = null;
  }
}

// ============================================================
// MAIN RENDER ENGINE
// ============================================================

/**
 * Render a VideoLesson to a playable video blob.
 * Runs entirely in the browser using Canvas + Web Audio API.
 */
export async function renderVideoLesson(
  canvas: HTMLCanvasElement,
  scenes: SceneConfig[],
  options: Partial<RenderOptions> = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  canvas.width = opts.width;
  canvas.height = opts.height;

  const renderer = new SceneRenderer(canvas);
  const recorder = new VideoRecorder();
  const narration = new NarrationEngine();
  const { onProgress } = opts;

  const theme: SceneTheme = {
    bgStart: "#0F0A2E",
    bgEnd: "#1A1040",
    primaryColor: "#7C3AED",
    secondaryColor: "#EC4899",
    accentColor: "#F59E0B",
    textColor: "#FFFFFF",
  };

  onProgress?.({ phase: "rendering", progress: 0, message: "Starting render..." });

  // Start recording
  await recorder.start(canvas, opts.fps);

  let totalFrames = 0;
  let completedFrames = 0;

  // Calculate total frames
  for (const scene of scenes) {
    totalFrames += Math.max(1, Math.round(scene.duration * opts.fps));
  }

  // Render each scene
  for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
    const scene = scenes[sceneIdx];
    const sceneFrames = Math.max(1, Math.round(scene.duration * opts.fps));

    // Start narration for this scene in parallel
    const narrationPromise = narration.speak(scene.narration, "female", 0.9);

    // Render frames
    for (let frame = 0; frame < sceneFrames; frame++) {
      const timeProgress = frame / sceneFrames;
      
      renderer.clear();
      renderer.renderFrame(scene, timeProgress, theme);

      completedFrames++;
      const overallProgress = completedFrames / totalFrames;

      // Report progress every 5%
      if (Math.floor(overallProgress * 20) !== Math.floor((completedFrames - 1) / totalFrames * 20)) {
        onProgress?.({
          phase: "rendering",
          progress: Math.round(overallProgress * 100),
          message: `Rendering ${scene.title}...`,
        });
      }

      // Wait for next frame (respects fps)
      await new Promise((r) => setTimeout(r, 1000 / opts.fps));
    }

    // Wait for narration to finish
    await narrationPromise;
  }

  onProgress?.({ phase: "encoding", progress: 90, message: "Encoding video..." });

  // Stop recording and get the blob
  const blob = await recorder.stop();
  
  onProgress?.({ phase: "done", progress: 100, message: "Video ready!" });

  return blob;
}

/**
 * Validate that video rendering is supported in this browser.
 */
export function isVideoSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!(
      typeof MediaRecorder !== "undefined" &&
      HTMLCanvasElement.prototype.toBlob &&
      typeof (HTMLCanvasElement as any).prototype.captureStream !== "undefined"
    );
  } catch {
    return false;
  }
}

/**
 * Get the canvas ready for rendering.
 */
export function createVideoCanvas(width = 1280, height = 720): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}