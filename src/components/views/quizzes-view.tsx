"use client";

import { useEffect, useState } from "react";
import {
  Target, Loader2, CheckCircle2, XCircle, Trophy, Sparkles, RefreshCw,
  Brain, ListChecks, FileText, ArrowRight, Plus, Clock, Zap, Flame,
  PartyPopper, TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import type { QuizQuestion, QuizListItem, DocSummary } from "@/lib/types";
import { EmptyState, LoadingState, PageHeader } from "@/components/empty-states";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Confetti } from "@/components/confetti";

interface QuizSession {
  attemptId: string;
  question: QuizQuestion | null;
  progress: { answered: number; correct: number; total: number };
  mastery: number;
  finished: boolean;
}

const TOPIC_PRESETS = [
  { id: "programming", label: "Programming Fundamentals", description: "Variables, control flow, functions, async", icon: "💻", gradient: "from-primary to-primary" },
  { id: "neural", label: "Neural Networks", description: "Perceptrons, backprop, attention", icon: "🧠", gradient: "from-emerald-600 to-teal-600" },
  { id: "probability", label: "Probability & Stats", description: "Distributions, Bayes, expectation", icon: "🎲", gradient: "from-amber-500 to-orange-500" },
];

export function QuizzesView() {
  const [stage, setStage] = useState<"select" | "playing" | "result">("select");
  const [session, setSession] = useState<QuizSession | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [genDialog, setGenDialog] = useState(false);
  const [genDoc, setGenDoc] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [genDiff, setGenDiff] = useState<"easy" | "medium" | "hard">("medium");
  const [generating, setGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ quizzes: QuizListItem[] }>("/api/learning/quizzes/list"),
      api.get<{ documents: DocSummary[] }>("/api/documents"),
    ]).then(([q, d]) => {
      setQuizzes(q.quizzes);
      setDocs(d.documents.filter((x) => x.status === "ready"));
      setLoading(false);
    });
  }, []);

  async function startExisting(quizId: string) {
    try {
      const started = await api.post<QuizSession>("/api/learning/quizzes/start", { quizId, questionCount: 5 });
      setSession(started);
      setStage("playing");
      setSelected(null);
      setRevealed(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to start quiz");
    }
  }

  async function startTopicQuiz(topicLabel: string) {
    setGenerating(true);
    try {
      const gen = await api.post<{ quizId: string | null; questions: QuizQuestion[] }>("/api/ai/quiz", {
        topic: topicLabel, count: 5, difficulty: "medium",
      });
      if (gen.quizId) {
        await startExisting(gen.quizId);
      } else {
        toast.error("Failed to generate quiz");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to start quiz");
    } finally {
      setGenerating(false);
    }
  }

  async function generateFromDoc() {
    if (!genDoc) { toast.error("Select a document"); return; }
    setGenerating(true);
    try {
      const r = await api.post<{ quizId: string }>("/api/documents/from-doc/quiz", {
        documentId: genDoc, count: genCount, difficulty: genDiff,
      });
      toast.success("Quiz generated from document!");
      setGenDialog(false);
      const q = await api.get<{ quizzes: QuizListItem[] }>("/api/learning/quizzes/list");
      setQuizzes(q.quizzes);
      await startExisting(r.quizId);
    } catch (err) {
      toast.error((err as Error).message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function submitAnswer() {
    if (!session || selected === null || !session.question) return;
    setSubmitting(true);
    try {
      const result = await api.post<{
        correct: boolean; explanation: string | null; mastery: number;
        finished: boolean; progress: { answered: number; correct: number; total: number };
        nextQuestion: QuizQuestion | null;
      }>("/api/learning/quizzes/answer", {
        attemptId: session.attemptId, questionId: session.question.id, selectedIndex: selected, timeMs: 0,
      });
      setRevealed(true);
      setLastCorrect(result.correct);
      setSession({ ...session, mastery: result.mastery, progress: result.progress, finished: result.finished, question: result.nextQuestion });
      if (result.correct) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2500);
        toast.success("Correct! +80 XP 🎉");
      } else {
        toast.error("Not quite — check the explanation.");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (!session) return;
    if (session.finished) { setStage("result"); return; }
    setSelected(null);
    setRevealed(false);
    setLastCorrect(null);
  }

  function reset() {
    setStage("select");
    setSession(null);
    setSelected(null);
    setRevealed(false);
  }

  if (loading) return <LoadingState message="Loading quizzes…" />;

  // Result stage — celebration
  if (stage === "result" && session) {
    const pct = session.progress.total > 0 ? Math.round((session.progress.correct / session.progress.total) * 100) : 0;
    const passed = pct >= 70;
    return (
      <>
        <Confetti show={passed} />
        <div className="max-w-xl mx-auto fade-in">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
            <Card className={`p-8 text-center relative overflow-hidden border-0 ${passed ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-amber-500 to-orange-600"} text-white shadow-xl`}>
              <div className="absolute inset-0 grid-bg-white opacity-10" />
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/15 blur-3xl" />
              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 bg-white/20 backdrop-blur"
                >
                  {passed ? <PartyPopper className="w-10 h-10 text-white" /> : <Trophy className="w-10 h-10 text-white" />}
                </motion.div>
                <h2 className="text-3xl font-bold mb-1">{passed ? "Amazing! 🎉" : "Good effort!"}</h2>
                <p className="text-white/80 text-sm">{passed ? "You crushed that quiz!" : "Keep practicing — you'll get there!"}</p>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <div className="p-3 rounded-xl bg-white/15 backdrop-blur">
                    <p className="text-3xl font-bold">{pct}%</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">Score</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/15 backdrop-blur">
                    <p className="text-3xl font-bold">{session.progress.correct}/{session.progress.total}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">Correct</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/15 backdrop-blur">
                    <p className="text-3xl font-bold">{Math.round(session.mastery * 100)}%</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wider">Mastery</p>
                  </div>
                </div>

                {passed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-medium"
                  >
                    <Zap className="w-3.5 h-3.5" /> +{passed ? 80 : 0} XP earned!
                  </motion.div>
                )}

                <div className="flex gap-2 mt-6">
                  <Button onClick={reset} variant="outline" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20" size="sm">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> New quiz
                  </Button>
                  <Button onClick={() => startExisting(session.attemptId)} className="flex-1 bg-white text-primary hover:bg-white/90" size="sm">
                    Retry <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </>
    );
  }

  // Playing stage — gamified
  if (stage === "playing" && session) {
    const q = session.question;
    const progressPct = (session.progress.answered / session.progress.total) * 100;
    return (
      <>
        <Confetti show={showConfetti} />
        <div className="max-w-2xl mx-auto fade-in">
          {/* Progress header — Duolingo style */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  <Brain className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{Math.round(session.mastery * 100)}%</span>
                  <span className="text-[10px] opacity-70">mastery</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{session.progress.correct}</span>
                  <span className="text-[10px] opacity-70">streak</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium">{session.progress.answered + (revealed ? 0 : 1)} / {session.progress.total}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4 }}
                className="h-full bg-gradient-to-r from-primary to-primary rounded-full relative"
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm border-2 border-primary" />
              </motion.div>
            </div>
          </div>

          {!q ? (
            <Card className="p-10 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">AI is crafting your next question…</p>
            </Card>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Card className={`p-6 ${revealed ? (lastCorrect ? "border-emerald-500/40" : "border-rose-500/40") : ""}`}>
                  {/* Question type + difficulty */}
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className="text-[9px] gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Adaptive
                    </Badge>
                    {q.difficulty !== undefined && (
                      <Badge variant="outline" className="text-[9px]">
                        {q.difficulty < 0.35 ? "🌱 Easy" : q.difficulty < 0.65 ? "⚡ Medium" : "🔥 Hard"}
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold leading-relaxed mb-6">{q.prompt}</h3>

                  <div className="space-y-2.5">
                    {q.options.map((opt, i) => {
                      const isCorrect = revealed && i === q.correctIndex;
                      const isWrong = revealed && i === selected && i !== q.correctIndex;
                      return (
                        <motion.button
                          key={i}
                          whileHover={!revealed ? { scale: 1.01 } : {}}
                          whileTap={!revealed ? { scale: 0.99 } : {}}
                          disabled={revealed}
                          onClick={() => setSelected(i)}
                          className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 text-sm ${
                            isCorrect ? "border-emerald-500 bg-emerald-500/10"
                            : isWrong ? "border-rose-500 bg-rose-500/10 shake"
                            : selected === i ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-primary/5"
                          } ${revealed ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCorrect ? "bg-emerald-500 text-white"
                            : isWrong ? "bg-rose-500 text-white"
                            : selected === i ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground"
                          }`}>
                            {isCorrect ? <CheckCircle2 className="w-4 h-4" />
                            : isWrong ? <XCircle className="w-4 h-4" />
                            : String.fromCharCode(65 + i)}
                          </div>
                          <span className="flex-1">{opt}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {revealed && q.explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 p-3.5 rounded-xl border-l-4 ${lastCorrect ? "bg-emerald-500/5 border-emerald-500" : "bg-amber-500/5 border-amber-500"}`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${lastCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {lastCorrect ? "✅ Correct!" : "💡 Explanation"}
                      </p>
                      <p className="text-xs leading-relaxed">{q.explanation}</p>
                    </motion.div>
                  )}

                  <div className="mt-5">
                    {!revealed ? (
                      <Button
                        onClick={submitAnswer}
                        disabled={selected === null || submitting}
                        className="w-full bg-gradient-to-r from-primary to-primary text-white h-11 scale-tap"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                        Submit answer
                      </Button>
                    ) : (
                      <Button
                        onClick={nextQuestion}
                        className="w-full bg-gradient-to-r from-primary to-primary text-white h-11 scale-tap"
                      >
                        {session.finished ? "See results 🎉" : "Next question"} <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </>
    );
  }

  // Select stage — playful topic cards
  return (
    <div className="max-w-5xl mx-auto fade-in">
      <PageHeader
        title="Quizzes"
        description="Test your knowledge with adaptive AI-generated quizzes."
        action={
          docs.length > 0 && (
            <Button size="sm" className="bg-gradient-to-r from-primary to-primary text-white" onClick={() => setGenDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> From document
            </Button>
          )
        }
      />

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Generate a quiz
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TOPIC_PRESETS.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              onClick={() => startTopicQuiz(t.label)}
              disabled={generating}
              className="text-left group"
            >
              <Card className="p-5 hover:shadow-elevated transition-all h-full cursor-pointer border-0 bg-card relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity`} />
                <div className="relative z-10">
                  <div className="text-3xl mb-3">{t.icon}</div>
                  <h4 className="font-bold text-sm mb-1 group-hover:group-hover:text-primary transition-colors">{t.label}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Start quiz
                  </div>
                </div>
              </Card>
            </motion.button>
          ))}
        </div>
      </div>

      {quizzes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-primary" /> Your quizzes ({quizzes.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {quizzes.map((q) => (
              <Card key={q.id} className="p-3.5 flex items-center gap-3 hover:shadow-elevated transition-shadow cursor-pointer group" onClick={() => startExisting(q.id)}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {q.document ? <FileText className="w-4 h-4 text-primary" /> : <ListChecks className="w-4 h-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{q.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {q.questionCount} questions · {q.difficulty}{q.document ? ` · from ${q.document.title.slice(0, 20)}` : ""}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Generate-from-doc dialog */}
      <Dialog open={genDialog} onOpenChange={setGenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate quiz from document</DialogTitle>
            <DialogDescription>AI will read your document and create quiz questions grounded in its content.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Document</Label>
              <Select value={genDoc} onValueChange={setGenDoc}>
                <SelectTrigger><SelectValue placeholder="Choose a document" /></SelectTrigger>
                <SelectContent>
                  {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Questions</Label>
                <Select value={String(genCount)} onValueChange={(v) => setGenCount(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 8, 10].map((n) => <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select value={genDiff} onValueChange={(v) => setGenDiff(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">🌱 Easy</SelectItem>
                    <SelectItem value="medium">⚡ Medium</SelectItem>
                    <SelectItem value="hard">🔥 Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialog(false)}>Cancel</Button>
            <Button onClick={generateFromDoc} disabled={generating} className="bg-gradient-to-r from-primary to-primary text-white">
              {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
