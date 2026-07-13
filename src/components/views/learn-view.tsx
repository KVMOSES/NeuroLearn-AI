"use client";

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap, FileText, Brain, Target, ChevronRight, ArrowLeft, Sparkles,
  Clock, CheckCircle2, Circle, PlayCircle, AlertCircle, Loader2, Plus,
  ListTree, Map, Zap, TrendingUp, BookOpen, Lightbulb, Rocket, Bot,
  ListChecks, Layers, Timer, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import type { MaterialSummary, TopicTreeResponse, TopicNode, LearnerProfileDTO, LearningPlanDTO, LessonSessionDTO } from "@/lib/types";
import { LoadingState, EmptyState, PageHeader } from "@/components/empty-states";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { DiagnosticFlow } from "@/components/teaching/diagnostic-flow";
import { LessonPlayer } from "@/components/teaching/lesson-player";
import { CinematicProgress } from "@/components/celebration";
import { relativeTime, DIFFICULTY_LABEL } from "@/lib/ui";

// ============================================================
// DOCUMENT CARD MENU — three-dot overflow with Rename / Delete
// ============================================================
function CardMenu({ material, onRename, onDelete }: {
  material: MaterialSummary;
  onRename: (id: string, currentTitle: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick() { setOpen(false); }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-6 h-6 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white/80 hover:bg-black/40 hover:text-white transition-all"
        aria-label="Card menu"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute top-8 right-0 min-w-[130px] rounded-xl overflow-hidden shadow-xl border z-50"
          style={{
            background: 'radial-gradient(130% 100% at 12% 0%, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0) 42%), linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.6) 55%, rgba(255,255,255,0.7) 100%)',
            backdropFilter: 'blur(28px) saturate(200%)',
            borderColor: 'rgba(255,255,255,0.75)',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(material.id, material.title); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors text-left"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            Rename
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(material.id); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

type Stage = "materials" | "topics" | "diagnostic" | "lesson";

export function LearnView() {
  const { viewParams, setView } = useAppStore();
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  async function handleRename(id: string, currentTitle: string) {
    const newTitle = window.prompt("Rename material:", currentTitle);
    if (!newTitle || newTitle.trim() === "" || newTitle === currentTitle) return;
    try {
      await api.put(`/api/documents/${id}`, { title: newTitle.trim() });
      toast.success("Renamed successfully");
      loadMaterials();
    } catch (err) {
      toast.error((err as Error).message || "Rename failed");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this material and all its lessons?")) return;
    try {
      await api.delete(`/api/documents/${id}`);
      toast.success("Deleted successfully");
      loadMaterials();
    } catch (err) {
      toast.error((err as Error).message || "Delete failed");
    }
  }
  const [stage, setStage] = useState<Stage>("materials");
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMaterial, setActiveMaterial] = useState<MaterialSummary | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ materials: MaterialSummary[] }>("/api/teaching/materials");
      setMaterials(d.materials);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  const [cinematicStep, setCinematicStep] = useState(-1);
  const [showCinematic, setShowCinematic] = useState(false);
  const cinematicSteps = [
    "Reading your document...",
    "Understanding concepts...",
    "Finding relationships...",
    "Extracting topics...",
    "Creating lessons...",
    "Preparing quizzes...",
    "Building your course...",
  ];

  async function analyzeMaterial(mat: MaterialSummary) {
    setAnalyzing(mat.id);
    setShowCinematic(true);
    setCinematicStep(0);

    // Animate through the steps while the API call runs
    const stepInterval = setInterval(() => {
      setCinematicStep((prev) => Math.min(prev + 1, cinematicSteps.length - 2));
    }, 1200);

    try {
      await api.post(`/api/teaching/analyze/${mat.id}`);
      clearInterval(stepInterval);
      setCinematicStep(cinematicSteps.length - 1);
      await new Promise((r) => setTimeout(r, 800));
      setShowCinematic(false);
      toast.success("Material analyzed! Topics extracted.");
      await loadMaterials();
      openMaterial(mat.id);
    } catch (err) {
      clearInterval(stepInterval);
      setShowCinematic(false);
      toast.error((err as Error).message || "Analysis failed");
    } finally {
      setAnalyzing(null);
    }
  }

  function openMaterial(materialId: string) {
    const mat = materials.find((m) => m.id === materialId);
    if (mat) {
      setActiveMaterial(mat);
      setStage("topics");
    }
  }

  function startDiagnostic() {
    setStage("diagnostic");
  }

  function startLesson(topicId: string) {
    setActiveTopicId(topicId);
    setStage("lesson");
  }

  function backToMaterials() {
    setStage("materials");
    setActiveMaterial(null);
    loadMaterials();
  }

  // Lesson stage
  if (stage === "lesson" && activeTopicId) {
    return <LessonPlayer topicId={activeTopicId} onBack={() => { setStage("topics"); setActiveTopicId(null); }} />;
  }

  // Diagnostic stage
  if (stage === "diagnostic" && activeMaterial) {
    return <DiagnosticFlow documentId={activeMaterial.id} onBack={() => setStage("topics")} onComplete={() => { setStage("topics"); loadMaterials(); }} />;
  }

  // Topics stage (material detail)
  if (stage === "topics" && activeMaterial) {
    return <TopicBrowser material={activeMaterial} onBack={backToMaterials} onAnalyze={() => analyzeMaterial(activeMaterial)} analyzing={!!analyzing} onTopicClick={startLesson} onDiagnostic={startDiagnostic} />;
  }

  // Materials list stage
  if (loading) return <LoadingState message="Loading your learning materials…" />;

  return (
    <div className="max-w-5xl mx-auto fade-in">
      {/* Cinematic document analysis */}
      <CinematicProgress steps={cinematicSteps} currentStep={cinematicStep} show={showCinematic} />
      <PageHeader
        title="Learn"
        description="Your AI teacher analyzes your material, builds a knowledge graph, and guides you through personalized lessons."
        action={
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setView("documents")}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Upload material
          </Button>
        }
      />

      {/* Study Tools — integrated, not separate nav items */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <StudyToolCard icon={ListChecks} label="Quizzes" desc="Test yourself" onClick={() => setView("quizzes")} />
        <StudyToolCard icon={Layers} label="Flashcards" desc="Spaced repetition" onClick={() => setView("flashcards")} />
        <StudyToolCard icon={Timer} label="Focus Timer" desc="Pomodoro" onClick={() => setView("focus")} />
      </div>

      {materials.length === 0 ? (
        <Card className="p-10 text-center border-dashed relative overflow-hidden">
          <div className="absolute inset-0 mesh-bg opacity-30" />
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary flex items-center justify-center mx-auto mb-5 shadow-xl shadow-primary/20"
            >
              <Rocket className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="font-bold text-xl">Start your learning journey</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Upload a document and your AI teacher will analyze it, assess your understanding, and guide you through interactive lessons.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              <Button onClick={() => setView("documents")} className="bg-gradient-to-r from-primary to-primary text-white">
                <FileText className="w-4 h-4 mr-1.5" /> Upload material
              </Button>
              <Button variant="outline" onClick={() => setView("tutor")}>
                <Bot className="w-4 h-4 mr-1.5" /> Talk to AI tutor
              </Button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-6 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF · DOCX · PPTX · TXT · MD</span>
              <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> AI-powered analysis</span>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {materials.map((mat, i) => {
            const gradients = [
              "from-primary to-primary",
              "from-emerald-600 to-teal-600",
              "from-amber-500 to-orange-500",
              "from-rose-500 to-pink-500",
              "from-cyan-500 to-blue-500",
            ];
            const gradient = gradients[i % gradients.length];
            const status = !mat.analyzed ? "needs-analysis" : !mat.hasDiagnostic ? "needs-assessment" : mat.planStatus === "active" ? "learning" : "ready";
            const statusConfig = {
              "needs-analysis": { label: "Analyze", color: "bg-amber-500", icon: Sparkles },
              "needs-assessment": { label: "Assess", color: "bg-cyan-500", icon: Target },
              "learning": { label: "Learning", color: "bg-primary", icon: BookOpen },
              "ready": { label: "Ready", color: "bg-emerald-500", icon: CheckCircle2 },
            }[status];

            return (
              <motion.div
                key={mat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2 }}
                onClick={() => mat.analyzed ? openMaterial(mat.id) : analyzeMaterial(mat)}
              >
                <Card className="p-0 overflow-hidden cursor-pointer group hover:shadow-elevated transition-all h-full flex flex-col">
                  {/* Gradient cover */}
                  <div className={`h-24 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                    <div className="absolute inset-0 grid-bg-white opacity-15" />
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/15 blur-xl" />
                    {/* Status badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${statusConfig.color} text-white text-[9px] font-bold`}>
                        <statusConfig.icon className="w-2.5 h-2.5" />
                        {statusConfig.label}
                      </div>
                    </div>
                    {/* File type badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <Badge className="bg-white/20 text-white hover:bg-white/20 backdrop-blur border-white/20 text-[9px] uppercase">
                        {mat.sourceType}
                      </Badge>
                    </div>
                    {/* Three-dot menu */}
                    <div className="absolute top-2.5" style={{ right: 'calc(2.5rem + 8px)' }}>
                      <CardMenu material={mat} onRename={handleRename} onDelete={handleDelete} />
                    </div>
                    {/* Progress ring (if learning) */}
                    {mat.analyzed && mat.planStatus && (
                      <div className="absolute bottom-2.5 right-2.5">
                        <div className="relative w-10 h-10">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 42}`}
                              strokeDashoffset={`${2 * Math.PI * 42 * (1 - mat.planProgress / 100)}`}
                              className="transition-all duration-700"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">{mat.planProgress}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:group-hover:text-primary transition-colors mb-1">
                      {mat.title}
                    </h3>
                    {mat.summary && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 flex-1">{mat.summary}</p>}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {mat.analyzed ? (
                        <>
                          <span className="flex items-center gap-0.5"><ListTree className="w-2.5 h-2.5" /> {mat.topicCount} topics</span>
                          {mat.hasDiagnostic && <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" /> Assessed</span>}
                        </>
                      ) : analyzing === mat.id ? (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing…</span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Sparkles className="w-2.5 h-2.5" /> Click to analyze</span>
                      )}
                      <span className="ml-auto">{relativeTime(mat.updatedAt)}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {/* Upload card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: materials.length * 0.05 }}
            whileHover={{ y: -2 }}
            onClick={() => setView("documents")}
          >
            <Card className="p-0 overflow-hidden cursor-pointer group hover:shadow-elevated transition-all h-full flex items-center justify-center min-h-[180px] border-dashed">
              <div className="text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Upload new material</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, PPTX, TXT, MD</p>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TOPIC BROWSER — hierarchical knowledge graph + learning plan
// ============================================================

function TopicBrowser({ material, onBack, onAnalyze, analyzing, onTopicClick, onDiagnostic }: {
  material: MaterialSummary;
  onBack: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onTopicClick: (topicId: string) => void;
  onDiagnostic: () => void;
}) {
  const [tree, setTree] = useState<TopicTreeResponse | null>(null);
  const [plan, setPlan] = useState<LearningPlanDTO | null>(null);
  const [profile, setProfile] = useState<LearnerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const { setView } = useAppStore();

  useEffect(() => {
    Promise.all([
      api.get<TopicTreeResponse>(`/api/teaching/topics/${material.id}`),
      api.get<{ plan: LearningPlanDTO | null }>(`/api/teaching/plan/${material.id}`),
      api.get<{ profile: LearnerProfileDTO | null }>("/api/teaching/profile"),
    ]).then(([t, p, pr]) => {
      setTree(t);
      setPlan(p.plan);
      setProfile(pr.profile);
      // Auto-expand first level
      setExpandedNodes(new Set(t.topics.map((n) => n.id)));
    }).finally(() => setLoading(false));
  }, [material.id]);

  function toggleNode(id: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) return <LoadingState message="Loading knowledge structure…" />;

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 text-xs">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to materials
      </Button>

      {/* Material header */}
      <Card className="p-5 mb-4 bg-gradient-to-br from-primary to-primary text-white border-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge className="bg-white/20 text-white hover:bg-white/20 border-white/20 mb-2 text-[10px] uppercase">{material.sourceType}</Badge>
            <h1 className="text-xl font-bold">{material.title}</h1>
            {material.summary && <p className="text-white/70 text-sm mt-1 line-clamp-2">{material.summary}</p>}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-white/60">
              <span>{material.wordCount.toLocaleString()} words</span>
              <span>·</span>
              <span>{material.topicCount} topics</span>
              <span>·</span>
              <span>Updated {relativeTime(material.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Learner profile + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Profile summary */}
        <Card className="p-4">
          <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-3"><Brain className="w-3.5 h-3.5 text-primary" /> Learner Profile</h3>
          {profile ? (
            <div className="space-y-2">
              <ProfileBar label="Prior Knowledge" value={profile.priorKnowledge} />
              <ProfileBar label="Conceptual" value={profile.conceptualUnderstanding} />
              <ProfileBar label="Reasoning" value={profile.reasoningAbility} />
              <ProfileBar label="Confidence" value={profile.confidence} />
              <Badge variant="secondary" className="text-[9px] capitalize mt-2">{profile.preferredStyle} style</Badge>
              {profile.weaknesses.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">Weak: {profile.weaknesses.slice(0, 3).join(", ")}</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Take a diagnostic to build your profile.</p>
          )}
        </Card>

        {/* Diagnostic CTA */}
        <Card className="p-4">
          <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Target className="w-3.5 h-3.5 text-emerald-500" /> Diagnostic</h3>
          {material.hasDiagnostic ? (
            <div>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-0.5 text-[10px]">
                <CheckCircle2 className="w-2.5 h-2.5" /> Completed
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-2">Your learner profile is active.</p>
              <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={onDiagnostic}>Retake</Button>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">Assess your current understanding before learning.</p>
              <Button size="sm" className="w-full bg-gradient-to-r from-primary to-primary text-white h-8" onClick={onDiagnostic}>
                <Target className="w-3.5 h-3.5 mr-1" /> Start diagnostic
              </Button>
            </div>
          )}
        </Card>

        {/* Learning plan */}
        <Card className="p-4">
          <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-2"><Map className="w-3.5 h-3.5 text-amber-500" /> Learning Plan</h3>
          {plan ? (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{plan.completedTopics}/{plan.totalTopics} topics</span>
              </div>
              <Progress value={plan.totalTopics > 0 ? (plan.completedTopics / plan.totalTopics) * 100 : 0} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-2">~{plan.estimatedMinutes} min total</p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Take the diagnostic to generate your plan.</p>
          )}
        </Card>
      </div>

      {/* Topic tree */}
      {tree && tree.topics.length > 0 ? (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ListTree className="w-4 h-4 text-primary" /> Knowledge Structure</h3>
          <p className="text-xs text-muted-foreground mb-4">Browse topics and start interactive lessons. Click a topic to begin learning.</p>
          <div className="space-y-0.5">
            {tree.topics.map((node) => (
              <TopicTreeItem key={node.id} node={node} expanded={expandedNodes} toggle={toggleNode} onTopicClick={onTopicClick} />
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
          <p className="text-sm font-medium">This material hasn't been analyzed yet.</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">AI will extract topics, concepts, formulas, prerequisites, and difficulty levels.</p>
          <Button onClick={onAnalyze} disabled={analyzing} className="bg-gradient-to-r from-primary to-primary text-white">
            {analyzing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-1" /> Analyze with AI</>}
          </Button>
        </Card>
      )}

      {/* Learning plan items */}
      {plan && plan.items.length > 0 && (
        <Card className="p-5 mt-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Map className="w-4 h-4 text-amber-500" /> Your Learning Roadmap</h3>
          <div className="space-y-1.5">
            {plan.items.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border">
                {item.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : item.status === "in_progress" ? (
                  <PlayCircle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium ${item.status === "completed" ? "text-muted-foreground line-through" : ""}`}>{item.topic.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.topic.estimatedMinutes} min · {Math.round(item.topic.difficulty * 100)}% difficulty</p>
                </div>
                {item.isWeak && <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px]">Weak</Badge>}
                {item.isPrereq && <Badge variant="outline" className="text-[9px]">Prereq</Badge>}
                {item.status !== "completed" && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onTopicClick(item.topic.id)}>
                    <PlayCircle className="w-3 h-3 mr-0.5" /> Learn
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProfileBar({ label, value }: { label: string; value: number }) {
  const color = value > 70 ? "bg-emerald-500" : value > 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TopicTreeItem({ node, expanded, toggle, onTopicClick }: {
  node: TopicNode;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onTopicClick: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const levelColors = ["text-primary", "text-emerald-600 dark:text-emerald-400", "text-amber-600 dark:text-amber-400", "text-rose-600 dark:text-rose-400"];
  const levelIcons = [BookOpen, ListTree, Target, Lightbulb];
  const Icon = levelIcons[node.level] ?? Target;

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer ${node.level === 0 ? "font-semibold" : ""}`}
        style={{ paddingLeft: `${node.level * 20 + 8}px` }}
        onClick={() => hasChildren ? toggle(node.id) : onTopicClick(node.id)}
      >
        {hasChildren ? (
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        ) : (
          <div className="w-3.5 shrink-0" />
        )}
        <Icon className={`w-3.5 h-3.5 shrink-0 ${levelColors[node.level] ?? "text-muted-foreground"}`} />
        <div className="min-w-0 flex-1">
          <span className={`text-xs ${node.level === 0 ? "font-semibold" : ""}`}>{node.title}</span>
          {node.level > 0 && (
            <span className="text-[10px] text-muted-foreground ml-2">
              · {node.estimatedMinutes}m · {Math.round(node.difficulty * 100)}%
            </span>
          )}
        </div>
        {node.memory && (
          <Badge variant="outline" className={`text-[9px] ${node.memory.retention > 0.7 ? "text-emerald-600" : node.memory.retention < 0.4 ? "text-rose-600" : "text-amber-600"}`}>
            {Math.round(node.memory.retention * 100)}%
          </Badge>
        )}
        {node.planStatus === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        {node.isWeak && <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px]">Weak</Badge>}
        {node.level > 0 && !hasChildren && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); onTopicClick(node.id); }}>
            <PlayCircle className="w-3 h-3 mr-0.5" /> Learn
          </Button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TopicTreeItem key={child.id} node={child} expanded={expanded} toggle={toggle} onTopicClick={onTopicClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// Study tool quick-access card
function StudyToolCard({ icon: Icon, label, desc, onClick }: { icon: any; label: string; desc: string; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="text-left"
    >
      <Card className="p-3.5 hover:shadow-md transition-all flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </Card>
    </motion.button>
  );
}
