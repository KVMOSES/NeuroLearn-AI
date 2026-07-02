"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Presentation, FileText, BookOpen, Map, Layers, Sparkles, Download,
  Loader2, ChevronRight, ArrowLeft, Plus, Clock, Zap, Brain, Target,
  Video, PenTool, Briefcase, Lightbulb, Play, Pause, SkipForward, SkipBack,
  Maximize2, Volume2, Bookmark, MessageSquare, Check, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import type { MaterialSummary } from "@/lib/types";
import { LoadingState, EmptyState, PageHeader } from "@/components/empty-states";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Tool = "presentation" | "notes" | "cheatsheet" | "mindmap" | "course" | "summary" | "video" | "whiteboard" | "textbook" | "concept-map" | "career" | null;

const TOOLS = [
  { key: "video" as Tool, label: "Video Lesson", icon: Video, description: "AI-narrated lesson with chapters, quizzes & visuals", color: "from-rose-500 to-pink-500", badge: "NEW" },
  { key: "course" as Tool, label: "Course", icon: BookOpen, description: "Complete structured course with modules & lessons", color: "from-primary to-primary" },
  { key: "presentation" as Tool, label: "Presentation", icon: Presentation, description: "Professional slides with speaker notes", color: "from-amber-500 to-orange-500" },
  { key: "whiteboard" as Tool, label: "Whiteboard", icon: PenTool, description: "Animated step-by-step diagrams & explanations", color: "from-cyan-500 to-blue-500", badge: "NEW" },
  { key: "notes" as Tool, label: "Study Notes", icon: FileText, description: "10 note styles: quick, detailed, exam, revision", color: "from-emerald-600 to-teal-600" },
  { key: "textbook" as Tool, label: "Textbook", icon: BookOpen, description: "Complete textbook with chapters, exercises & glossary", color: "from-indigo-500 to-purple-500", badge: "NEW" },
  { key: "cheatsheet" as Tool, label: "Cheat Sheet", icon: Zap, description: "Formulas, definitions, shortcuts, exam tips", color: "from-rose-500 to-pink-500" },
  { key: "concept-map" as Tool, label: "Concept Map", icon: Map, description: "Interactive map with mastery tracking", color: "from-violet-500 to-fuchsia-500", badge: "NEW" },
  { key: "career" as Tool, label: "Career Paths", icon: Briefcase, description: "See where this knowledge leads professionally", color: "from-teal-500 to-emerald-500", badge: "NEW" },
  { key: "summary" as Tool, label: "Summary", icon: Layers, description: "7 summary styles: executive, exam, last-minute", color: "from-primary to-primary" },
  { key: "mindmap" as Tool, label: "Mind Map", icon: Map, description: "Interactive expandable concept tree", color: "from-cyan-500 to-blue-500" },
];

export function LessonStudioView() {
  const { setView } = useAppStore();
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<MaterialSummary | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ materials: MaterialSummary[] }>("/api/teaching/materials");
      setMaterials(d.materials.filter((m) => m.analyzed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectDoc(doc: MaterialSummary) {
    setSelectedDoc(doc);
    setActiveTool(null);
    setResult(null);
  }

  function selectTool(tool: Tool) {
    setActiveTool(tool);
    setResult(null);
  }

  async function generate(tool: Tool, options?: Record<string, unknown>) {
    if (!selectedDoc) return;
    setGenerating(true);
    setResult(null);
    try {
      const endpoint = `/api/lesson-studio/${tool}`;
      const body = { documentId: selectedDoc.id, ...options };
      const d = await api.post<any>(endpoint, body);
      setResult(d);
      toast.success(`${tool} generated!`);
    } catch (err) {
      toast.error((err as Error).message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function exportPDF(title: string, content: string) {
    try {
      const response = await fetch("/api/lesson-studio/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("PDF export failed");
    }
  }

  async function exportPPTX(presentation: any, style: string) {
    try {
      const response = await fetch("/api/lesson-studio/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ presentation, style }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presentation.title.replace(/[^a-zA-Z0-9]/g, "_")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PowerPoint downloaded!");
    } catch {
      toast.error("PPTX export failed");
    }
  }

  if (loading) return <LoadingState message="Loading your materials…" />;

  // Doc selection stage
  if (!selectedDoc) {
    return (
      <div className="max-w-5xl mx-auto fade-in">
        <PageHeader
          title="Lesson Studio"
          description="Transform your documents into video lessons, courses, presentations, textbooks, whiteboards, and more."
        />
        {materials.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No analyzed materials yet"
            description="Upload a document and let your AI teacher analyze it first. Then come back to generate learning resources."
            action={<Button onClick={() => setView("learn")} className="bg-primary text-primary-foreground">Go to Learn</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {materials.map((m, i) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => selectDoc(m)}
                className="text-left group"
              >
                <Card className="p-4 hover:shadow-md transition-shadow flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">{m.topicCount} topics · {m.wordCount.toLocaleString()} words</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Card>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Tool selection + generation stage
  return (
    <div className="max-w-5xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedDoc(null); setActiveTool(null); setResult(null); }} className="text-xs">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight truncate">{selectedDoc.title}</h1>
          <p className="text-[11px] text-muted-foreground">{selectedDoc.topicCount} topics · {selectedDoc.wordCount.toLocaleString()} words</p>
        </div>
      </div>

      {/* Tool grid */}
      {!activeTool && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOOLS.map((tool, i) => (
            <motion.button
              key={tool.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              onClick={() => selectTool(tool.key)}
              className="text-left group relative"
            >
              <Card className="p-4 hover:shadow-elevated transition-all h-full cursor-pointer">
                {tool.badge && (
                  <span className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{tool.badge}</span>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-2.5 shadow-sm`}>
                  <tool.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-0.5 group-hover:text-primary transition-colors">{tool.label}</h3>
                <p className="text-[11px] text-muted-foreground leading-tight">{tool.description}</p>
              </Card>
            </motion.button>
          ))}
        </div>
      )}

      {/* Active tool panel */}
      {activeTool && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { setActiveTool(null); setResult(null); }} className="text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> All tools
          </Button>

          {/* Generation controls */}
          {activeTool === "video" && !result && <VideoControls generating={generating} onGenerate={(opts) => generate("video", opts)} />}
          {activeTool === "presentation" && !result && <PresentationControls generating={generating} onGenerate={(opts) => generate("presentation", opts)} />}
          {activeTool === "notes" && !result && <NotesControls generating={generating} onGenerate={(opts) => generate("notes", opts)} />}
          {activeTool === "summary" && !result && <SummaryControls generating={generating} onGenerate={(opts) => generate("summary", opts)} />}
          {(activeTool === "cheatsheet" || activeTool === "mindmap" || activeTool === "course" || activeTool === "whiteboard" || activeTool === "textbook" || activeTool === "concept-map" || activeTool === "career") && !result && (
            <SimpleGenerate tool={activeTool} generating={generating} onGenerate={() => generate(activeTool)} />
          )}

          {/* Loading */}
          {generating && (
            <Card className="p-10 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">AI is generating your {activeTool}…</p>
              <p className="text-[10px] text-muted-foreground mt-1">This may take 15-45 seconds</p>
            </Card>
          )}

          {/* Results */}
          {result && !generating && (
            <ResultView
              tool={activeTool}
              result={result}
              onExportPDF={exportPDF}
              onExportPPTX={exportPPTX}
              onRegenerate={() => setResult(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// VIDEO CONTROLS
// ============================================================

function VideoControls({ generating, onGenerate }: { generating: boolean; onGenerate: (opts: any) => void }) {
  const [teachingStyle, setTeachingStyle] = useState("friendly");
  const [voice, setVoice] = useState("nova");

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Video Lesson Settings</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Teaching style</Label>
          <Select value={teachingStyle} onValueChange={setTeachingStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">😊 Friendly</SelectItem>
              <SelectItem value="academic">🎓 Academic</SelectItem>
              <SelectItem value="energetic">⚡ Energetic</SelectItem>
              <SelectItem value="calm">🍃 Calm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">AI Voice</Label>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nova">🌟 Nova</SelectItem>
              <SelectItem value="atlas">🧭 Atlas</SelectItem>
              <SelectItem value="sage">🍃 Sage</SelectItem>
              <SelectItem value="spark">⚡ Spark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => onGenerate({ teachingStyle, voice })} disabled={generating} className="w-full bg-primary text-primary-foreground h-10">
        {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Video className="w-4 h-4 mr-1" />}
        Generate Video Lesson
      </Button>
    </Card>
  );
}

function PresentationControls({ generating, onGenerate }: { generating: boolean; onGenerate: (opts: any) => void }) {
  const [slideCount, setSlideCount] = useState("10");
  const [style, setStyle] = useState("modern");
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Presentation Settings</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Slide count</Label>
          <Select value={slideCount} onValueChange={setSlideCount}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 slides</SelectItem>
              <SelectItem value="10">10 slides</SelectItem>
              <SelectItem value="15">15 slides</SelectItem>
              <SelectItem value="20">20 slides</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Style</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="university">University</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => onGenerate({ slideCount: parseInt(slideCount), style })} disabled={generating} className="w-full bg-primary text-primary-foreground h-10">
        {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
        Generate Presentation
      </Button>
    </Card>
  );
}

function NotesControls({ generating, onGenerate }: { generating: boolean; onGenerate: (opts: any) => void }) {
  const [style, setStyle] = useState("quick");
  const styles = [
    { key: "quick", label: "⚡ Quick Notes" }, { key: "detailed", label: "📖 Detailed" }, { key: "lecture", label: "🎓 Lecture" },
    { key: "exam", label: "📝 Exam" }, { key: "revision", label: "🔄 Revision" }, { key: "one-page", label: "📄 One-Page" },
    { key: "key-concepts", label: "💡 Key Concepts" }, { key: "definitions", label: "📚 Definitions" },
    { key: "formula-sheet", label: "🔢 Formula Sheet" }, { key: "interview", label: "💼 Interview" },
  ];
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Note Style</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {styles.map((s) => (
          <button key={s.key} onClick={() => setStyle(s.key)} className={`p-2.5 rounded-lg border text-xs font-medium transition-all text-left ${style === s.key ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>{s.label}</button>
        ))}
      </div>
      <Button onClick={() => onGenerate({ style })} disabled={generating} className="w-full bg-primary text-primary-foreground h-10">
        {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Generate Notes
      </Button>
    </Card>
  );
}

function SummaryControls({ generating, onGenerate }: { generating: boolean; onGenerate: (opts: any) => void }) {
  const [style, setStyle] = useState("student");
  const styles = [
    { key: "executive", label: "📊 Executive" }, { key: "student", label: "🎓 Student" }, { key: "detailed", label: "📖 Detailed" },
    { key: "exam", label: "📝 Exam" }, { key: "last-minute", label: "⏰ Last Minute" }, { key: "bullet", label: "📋 Bullet" },
    { key: "interview-prep", label: "💼 Interview Prep" },
  ];
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Summary Style</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {styles.map((s) => (
          <button key={s.key} onClick={() => setStyle(s.key)} className={`p-2.5 rounded-lg border text-xs font-medium transition-all text-left ${style === s.key ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>{s.label}</button>
        ))}
      </div>
      <Button onClick={() => onGenerate({ style })} disabled={generating} className="w-full bg-primary text-primary-foreground h-10">
        {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Generate Summary
      </Button>
    </Card>
  );
}

function SimpleGenerate({ tool, generating, onGenerate }: { tool: string; generating: boolean; onGenerate: () => void }) {
  const labels: Record<string, { title: string; desc: string }> = {
    cheatsheet: { title: "Cheat Sheet", desc: "formulas, definitions, shortcuts, exam tips" },
    mindmap: { title: "Mind Map", desc: "an interactive expandable concept tree" },
    course: { title: "Course", desc: "a complete structured course with modules and lessons" },
    whiteboard: { title: "Whiteboard", desc: "an animated step-by-step diagram explanation" },
    textbook: { title: "Textbook", desc: "a complete textbook with chapters, exercises & glossary" },
    "concept-map": { title: "Concept Map", desc: "an interactive map with mastery tracking" },
    career: { title: "Career Paths", desc: "career connections, salary ranges & skill chains" },
  };
  const info = labels[tool] ?? { title: tool, desc: "" };
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-2">Generate {info.title}</h3>
      <p className="text-xs text-muted-foreground mb-4">AI will analyze your document and generate {info.desc}.</p>
      <Button onClick={onGenerate} disabled={generating} className="w-full bg-primary text-primary-foreground h-10">
        {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Generate {info.title}
      </Button>
    </Card>
  );
}

// ============================================================
// RESULT VIEW
// ============================================================

function ResultView({ tool, result, onExportPDF, onExportPPTX, onRegenerate }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onRegenerate} className="text-xs h-8">
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Regenerate
        </Button>
        {tool === "presentation" && result.presentation && (
          <Button size="sm" className="text-xs h-8 bg-primary text-primary-foreground" onClick={() => onExportPPTX(result.presentation, "modern")}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export PPTX
          </Button>
        )}
        {(tool === "notes" || tool === "summary") && (result.notes || result.summary) && (
          <Button size="sm" className="text-xs h-8 bg-primary text-primary-foreground" onClick={() => onExportPDF((result.notes || result.summary).slice(0, 50), result.notes || result.summary)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export PDF
          </Button>
        )}
        {tool === "textbook" && result.textbook && (
          <Button size="sm" className="text-xs h-8 bg-primary text-primary-foreground" onClick={() => onExportPDF(result.textbook.title, JSON.stringify(result.textbook, null, 2))}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export PDF
          </Button>
        )}
      </div>

      {tool === "video" && result.video && <VideoPreview video={result.video} />}
      {tool === "presentation" && result.presentation && <PresentationPreview presentation={result.presentation} />}
      {tool === "notes" && result.notes && <MarkdownPreview content={result.notes} />}
      {tool === "summary" && result.summary && <MarkdownPreview content={result.summary} />}
      {tool === "cheatsheet" && result.cheatSheet && <CheatSheetPreview cheatSheet={result.cheatSheet} />}
      {tool === "mindmap" && result.mindMap && <MindMapPreview mindMap={result.mindMap} />}
      {tool === "course" && result.course && <CoursePreview course={result.course} />}
      {tool === "whiteboard" && result.whiteboard && <WhiteboardPreview whiteboard={result.whiteboard} />}
      {tool === "textbook" && result.textbook && <TextbookPreview textbook={result.textbook} />}
      {tool === "concept-map" && result.conceptMap && <ConceptMapPreview conceptMap={result.conceptMap} />}
      {tool === "career" && result.career && <CareerPreview career={result.career} />}
    </div>
  );
}

// ============================================================
// PREVIEW COMPONENTS
// ============================================================

function MarkdownPreview({ content }: { content: string }) {
  return (
    <Card className="p-5">
      <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </Card>
  );
}

function VideoPreview({ video }: { video: any }) {
  const [currentSegment, setCurrentSegment] = useState(0);
  const [playing, setPlaying] = useState(false);
  const segment = video.segments[currentSegment];

  return (
    <div className="space-y-3">
      {/* Video player */}
      <Card className="p-0 overflow-hidden">
        <div className="relative aspect-video bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center p-8">
          <div className="absolute inset-0 grid-bg-white opacity-5" />
          <div className="relative z-10 text-center text-white max-w-2xl w-full">
            <Badge className="mb-3 bg-white/10 text-white border-white/20 capitalize">{segment.type}</Badge>
            <h2 className="text-xl font-bold mb-3">{segment.title}</h2>
            {/* Visual description as "slide" */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-3 text-left">
              <p className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Visual</p>
              <p className="text-sm text-white/80">{segment.visualDescription}</p>
            </div>
            {/* Narration as "subtitles" */}
            <div className="bg-black/40 backdrop-blur rounded-lg p-3">
              <p className="text-xs text-white/70 italic">{segment.narration}</p>
            </div>
          </div>
          {/* Chapter indicator */}
          <div className="absolute top-3 right-3 text-[10px] text-white/40">
            {currentSegment + 1} / {video.segments.length}
          </div>
        </div>

        {/* Video controls */}
        <div className="flex items-center gap-2 p-3 border-b">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentSegment === 0} onClick={() => setCurrentSegment(currentSegment - 1)}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentSegment === video.segments.length - 1} onClick={() => setCurrentSegment(currentSegment + 1)}>
            <SkipForward className="w-4 h-4" />
          </Button>
          <div className="flex-1 mx-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((currentSegment + 1) / video.segments.length) * 100}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">{segment.duration}s</span>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Volume2 className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize2 className="w-4 h-4" /></Button>
        </div>

        {/* Quiz checkpoint */}
        {segment.quizQuestion && (
          <div className="p-4 bg-amber-500/5 border-b">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Quiz Checkpoint</p>
            <p className="text-sm font-medium mb-2">{segment.quizQuestion.prompt}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {segment.quizQuestion.options.map((opt: string, i: number) => (
                <div key={i} className="p-2 rounded-lg border text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Answer: {String.fromCharCode(65 + segment.quizQuestion.correctIndex)} — {segment.quizQuestion.explanation}</p>
          </div>
        )}
      </Card>

      {/* Chapters */}
      <Card className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Chapters</p>
        <div className="space-y-1">
          {video.chapters.map((ch: any, i: number) => (
            <button key={i} onClick={() => setCurrentSegment(ch.startSegment - 1)} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 text-left">
              <span className="text-[10px] text-muted-foreground w-6">{ch.startSegment}</span>
              <span className="text-xs font-medium">{ch.title}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{ch.duration}s</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PresentationPreview({ presentation }: { presentation: any }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = presentation.slides[currentSlide];
  return (
    <Card className="p-0 overflow-hidden">
      <div className="relative aspect-video bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center p-8">
        <div className="absolute inset-0 grid-bg-white opacity-5" />
        <div className="relative z-10 text-center text-white max-w-2xl">
          {slide.icon && <div className="text-4xl mb-4">{slide.icon}</div>}
          <h2 className="text-2xl font-bold mb-4">{slide.title}</h2>
          <ul className="space-y-2 text-left max-w-md mx-auto">
            {slide.content.map((c: string, i: number) => <li key={i} className="text-sm text-white/80 flex items-start gap-2"><span className="text-primary">•</span> {c}</li>)}
          </ul>
        </div>
        <div className="absolute bottom-3 right-3 text-xs text-white/40">{currentSlide + 1} / {presentation.slides.length}</div>
      </div>
      {slide.speakerNotes && <div className="p-3 border-b bg-muted/30"><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Speaker Notes</p><p className="text-xs text-muted-foreground italic">{slide.speakerNotes}</p></div>}
      <div className="flex items-center justify-between p-3">
        <Button variant="outline" size="sm" disabled={currentSlide === 0} onClick={() => setCurrentSlide(currentSlide - 1)} className="text-xs h-8"><ArrowLeft className="w-3 h-3 mr-1" /> Prev</Button>
        <div className="flex gap-1">{presentation.slides.map((_: any, i: number) => <button key={i} onClick={() => setCurrentSlide(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentSlide ? "bg-primary" : "bg-muted-foreground/30"}`} />)}</div>
        <Button variant="outline" size="sm" disabled={currentSlide === presentation.slides.length - 1} onClick={() => setCurrentSlide(currentSlide + 1)} className="text-xs h-8">Next <ChevronRight className="w-3 h-3 ml-1" /></Button>
      </div>
    </Card>
  );
}

function CheatSheetPreview({ cheatSheet }: { cheatSheet: any }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold mb-3">{cheatSheet.title}</h3>
      {cheatSheet.formulas?.length > 0 && <div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Formulas</p><div className="space-y-1">{cheatSheet.formulas.map((f: any, i: number) => <div key={i} className="flex gap-2 text-xs"><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary">{f.formula}</code><span className="text-muted-foreground">{f.description}</span></div>)}</div></div>}
      {cheatSheet.definitions?.length > 0 && <div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Definitions</p><div className="space-y-1">{cheatSheet.definitions.map((d: any, i: number) => <div key={i} className="text-xs"><span className="font-semibold">{d.term}:</span> <span className="text-muted-foreground">{d.definition}</span></div>)}</div></div>}
      {cheatSheet.commonMistakes?.length > 0 && <div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1.5">Common Mistakes</p><ul className="space-y-1">{cheatSheet.commonMistakes.map((m: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {m}</li>)}</ul></div>}
      {cheatSheet.examTips?.length > 0 && <div><p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1.5">Exam Tips</p><ul className="space-y-1">{cheatSheet.examTips.map((t: string, i: number) => <li key={i} className="text-xs text-muted-foreground">• {t}</li>)}</ul></div>}
    </Card>
  );
}

function MindMapPreview({ mindMap }: { mindMap: any }) {
  return <Card className="p-4"><h3 className="text-sm font-bold mb-3">{mindMap.title}</h3><MindMapTree node={mindMap.root} depth={0} /></Card>;
}

function MindMapTree({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div style={{ marginLeft: depth > 0 ? `${depth * 20}px` : "0" }}>
      <button onClick={() => hasChildren && setExpanded(!expanded)} className={`flex items-center gap-1.5 py-1 text-left ${hasChildren ? "cursor-pointer" : "cursor-default"}`}>
        {hasChildren && <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />}
        {!hasChildren && <div className="w-3" />}
        <span className={`text-xs ${depth === 0 ? "font-bold text-sm" : depth === 1 ? "font-semibold" : "text-muted-foreground"}`}>{node.label}</span>
      </button>
      {expanded && hasChildren && <div className="border-l border-border ml-1.5 pl-2">{node.children.map((child: any) => <MindMapTree key={child.id} node={child} depth={depth + 1} />)}</div>}
    </div>
  );
}

function CoursePreview({ course }: { course: any }) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-bold">{course.title}</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">{course.description}</p>
      <div className="space-y-3">{course.modules.map((m: any, mi: number) => <div key={mi} className="border-l-2 border-primary/30 pl-3"><p className="text-sm font-semibold">{mi + 1}. {m.title}</p><p className="text-[10px] text-muted-foreground mb-1.5">{m.summary}</p><div className="space-y-1">{m.lessons.map((l: any, li: number) => <div key={li} className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">{mi + 1}.{li + 1}</span><span className="font-medium">{l.title}</span><Badge variant="outline" className="text-[9px] px-1 py-0">{l.estimatedMinutes}m</Badge></div>)}</div></div>)}</div>
    </Card>
  );
}

function WhiteboardPreview({ whiteboard }: { whiteboard: any }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = whiteboard.steps[currentStep];
  return (
    <div className="space-y-3">
      <Card className="p-0 overflow-hidden">
        <div className="relative aspect-video bg-zinc-900 flex items-center justify-center">
          <svg viewBox="0 0 800 400" className="w-full h-full">
            {/* Render accumulated nodes/edges up to current step */}
            {whiteboard.steps.slice(0, currentStep + 1).flatMap((s: any, si: number) => [
              ...s.diagram.edges.map((e: any, ei: number) => <line key={`e${si}-${ei}`} x1={s.diagram.nodes.find((n: any) => n.id === e.from)?.x ?? 0} y1={s.diagram.nodes.find((n: any) => n.id === e.from)?.y ?? 0} x2={s.diagram.nodes.find((n: any) => n.id === e.to)?.x ?? 0} y2={s.diagram.nodes.find((n: any) => n.id === e.to)?.y ?? 0} stroke="rgba(255,255,255,0.3)" strokeWidth="2" markerEnd="url(#wbArrow)" />),
              ...s.diagram.nodes.map((n: any, ni: number) => <g key={`n${si}-${ni}`}><circle cx={n.x} cy={n.y} r="30" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.6)" strokeWidth="2" /><text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-white font-semibold">{n.label.length > 12 ? n.label.slice(0, 10) + "…" : n.label}</text></g>),
            ])}
            <defs><marker id="wbArrow" markerWidth="8" markerHeight="8" refX="20" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.3)" /></marker></defs>
          </svg>
        </div>
        <div className="p-3">
          <Badge className="mb-2 capitalize">{step.diagram.type}</Badge>
          <p className="text-sm font-semibold">{step.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
          <p className="text-[11px] text-muted-foreground italic mt-2">💬 {step.narration}</p>
        </div>
        <div className="flex items-center justify-between p-3 border-t">
          <Button variant="outline" size="sm" disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)} className="text-xs h-8"><ArrowLeft className="w-3 h-3 mr-1" /> Prev</Button>
          <span className="text-[10px] text-muted-foreground">Step {currentStep + 1} / {whiteboard.steps.length}</span>
          <Button variant="outline" size="sm" disabled={currentStep === whiteboard.steps.length - 1} onClick={() => setCurrentStep(currentStep + 1)} className="text-xs h-8">Next <ChevronRight className="w-3 h-3 ml-1" /></Button>
        </div>
      </Card>
    </div>
  );
}

function TextbookPreview({ textbook }: { textbook: any }) {
  const [currentChapter, setCurrentChapter] = useState(0);
  const chapter = textbook.chapters[currentChapter];
  if (!chapter) return <Card className="p-5"><p className="text-sm text-muted-foreground">No chapters generated.</p></Card>;
  return (
    <div className="space-y-3">
      <Card className="p-5">
        <h3 className="text-lg font-bold">{textbook.title}</h3>
        <p className="text-xs text-muted-foreground">{textbook.subtitle} · by {textbook.author}</p>
      </Card>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {textbook.chapters.map((ch: any, i: number) => <button key={i} onClick={() => setCurrentChapter(i)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 transition-all ${i === currentChapter ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>Ch {ch.number}</button>)}
      </div>
      <Card className="p-5">
        <h4 className="font-bold text-base">Chapter {chapter.number}: {chapter.title}</h4>
        <p className="text-xs text-muted-foreground mt-1 mb-3">{chapter.summary}</p>
        <div className="prose prose-sm dark:prose-invert max-w-none [&_h2]:text-sm [&_h2]:font-semibold [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
          <ReactMarkdown>{chapter.content}</ReactMarkdown>
        </div>
        {chapter.keyTerms?.length > 0 && <div className="mt-3 pt-3 border-t"><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Key Terms</p><div className="space-y-1">{chapter.keyTerms.map((t: any, i: number) => <div key={i} className="text-xs"><span className="font-semibold">{t.term}:</span> <span className="text-muted-foreground">{t.definition}</span></div>)}</div></div>}
        {chapter.exercises?.length > 0 && <div className="mt-3 pt-3 border-t"><p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1.5">Exercises</p><ol className="list-decimal pl-5 space-y-1">{chapter.exercises.map((e: string, i: number) => <li key={i} className="text-xs text-muted-foreground">{e}</li>)}</ol></div>}
      </Card>
    </div>
  );
}

function ConceptMapPreview({ conceptMap }: { conceptMap: any }) {
  return (
    <Card className="p-2 overflow-hidden">
      <div className="relative aspect-[4/3]">
        <svg viewBox="0 0 800 600" className="w-full h-full">
          {conceptMap.edges.map((e: any, i: number) => {
            const from = conceptMap.nodes.find((n: any) => n.id === e.from);
            const to = conceptMap.nodes.find((n: any) => n.id === e.to);
            if (!from || !to) return null;
            return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--border)" strokeWidth="1.5" opacity="0.6" markerEnd="url(#cmArrow)" />;
          })}
          {conceptMap.nodes.map((n: any) => {
            const radius = 25;
            const color = n.mastery > 0.7 ? "var(--chart-2)" : n.mastery > 0.3 ? "var(--chart-3)" : "var(--primary)";
            return (
              <g key={n.id} className="cursor-pointer">
                <circle cx={n.x} cy={n.y} r={radius} fill={color} fillOpacity={0.2 + n.mastery * 0.5} stroke={color} strokeWidth="2" />
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" className="text-[9px] font-bold fill-foreground">{n.label.length > 10 ? n.label.slice(0, 8) + "…" : n.label}</text>
                <text x={n.x} y={n.y + radius + 10} textAnchor="middle" className={`text-[8px] font-bold ${n.mastery > 0.7 ? "fill-emerald-500" : n.mastery > 0.3 ? "fill-amber-500" : "fill-muted-foreground"}`}>{Math.round(n.mastery * 100)}%</text>
              </g>
            );
          })}
          <defs><marker id="cmArrow" markerWidth="8" markerHeight="8" refX="20" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="var(--muted-foreground)" /></marker></defs>
        </svg>
      </div>
      <div className="p-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Mastered</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> In Progress</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Available</span>
      </div>
    </Card>
  );
}

function CareerPreview({ career }: { career: any }) {
  return (
    <div className="space-y-3">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="w-4 h-4 text-primary" />
          <h3 className="text-base font-bold">{career.primaryField}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Career connections for: {career.documentTitle}</p>
        {/* Skill chain */}
        {career.skillChain?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-4">
            {career.skillChain.map((s: string, i: number) => (
              <div key={i} className="flex items-center gap-1">
                <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px]">{s}</Badge>
                {i < career.skillChain.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Career paths */}
      {career.careerPaths?.map((path: any, i: number) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="text-sm font-semibold">{path.title}</h4>
              <p className="text-[11px] text-muted-foreground">{path.description}</p>
            </div>
            <Badge className={path.demand === "high" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}>
              {path.demand === "high" ? "🔥 High Demand" : "📈 Medium Demand"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
            <span>💰 {path.salaryRange}</span>
            <span>🛠️ {path.skills?.join(", ")}</span>
          </div>
          {path.projects?.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Projects</p>
              <ul className="space-y-0.5">{path.projects.map((p: string, j: number) => <li key={j} className="text-xs text-muted-foreground">• {p}</li>)}</ul>
            </div>
          )}
          {path.nextSteps?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Next Steps</p>
              <ul className="space-y-0.5">{path.nextSteps.map((s: string, j: number) => <li key={j} className="text-xs text-muted-foreground">→ {s}</li>)}</ul>
            </div>
          )}
        </Card>
      ))}

      {/* Recommended next learning */}
      {career.recommendedNextLearning?.length > 0 && (
        <Card className="p-4 border-primary/15 bg-primary/[0.02]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2">Recommended Next Learning</p>
          <div className="flex flex-wrap gap-1.5">
            {career.recommendedNextLearning.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>)}
          </div>
        </Card>
      )}
    </div>
  );
}
