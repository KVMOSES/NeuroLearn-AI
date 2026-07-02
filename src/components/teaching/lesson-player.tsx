"use client";

import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2, Brain, Lightbulb,
  Sparkles, MessageSquare, Send, BookOpen, Eye, HelpCircle, Trophy,
  AlertCircle, Zap, TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { LessonSessionDTO, LessonStepDTO, AnswerAnalysisDTO } from "@/lib/types";
import { LoadingState } from "@/components/empty-states";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const STEP_ICONS: Record<string, any> = {
  explanation: BookOpen,
  example: Lightbulb,
  visualization: Eye,
  question: HelpCircle,
  feedback: MessageSquare,
  summary: Trophy,
};

const STEP_COLORS: Record<string, string> = {
  explanation: "from-primary to-primary",
  example: "from-amber-500 to-orange-500",
  visualization: "from-cyan-500 to-blue-500",
  question: "from-emerald-600 to-teal-600",
  feedback: "from-rose-500 to-pink-500",
  summary: "from-primary to-primary",
};

export function LessonPlayer({ topicId, onBack }: { topicId: string; onBack: () => void }) {
  const [session, setSession] = useState<LessonSessionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStepData, setCurrentStepData] = useState<LessonStepDTO | null>(null);
  const [analysis, setAnalysis] = useState<AnswerAnalysisDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Answer state for question steps
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [numericAnswer, setNumericAnswer] = useState("");

  // Socratic mode
  const [socraticMode, setSocraticMode] = useState(false);
  const [socraticMessages, setSocraticMessages] = useState<{ role: string; content: string }[]>([]);
  const [socraticInput, setSocraticInput] = useState("");
  const [socraticLoading, setSocraticLoading] = useState(false);
  const socraticScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.post<LessonSessionDTO>(`/api/teaching/lesson/start/${topicId}`)
      .then((d) => {
        setSession(d);
        setCurrentStepData(d.steps[d.currentStep]);
      })
      .catch((err) => {
        toast.error((err as Error).message || "Failed to start lesson");
        onBack();
      })
      .finally(() => setLoading(false));
  }, [topicId]);

  useEffect(() => {
    if (session) setCurrentStepData(session.steps[session.currentStep]);
  }, [session]);

  useEffect(() => {
    socraticScrollRef.current?.scrollTo({ top: socraticScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [socraticMessages]);

  function resetAnswerState() {
    setSelectedIndex(null);
    setTextAnswer("");
    setNumericAnswer("");
    setAnalysis(null);
    setRevealed(false);
  }

  async function submitAnswer(advance: boolean = true) {
    if (!session || !currentStepData) return;
    setSubmitting(true);
    try {
      const result = await api.post<{
        analysis: AnswerAnalysisDTO | null;
        currentStep: number;
        finished: boolean;
        nextStep: LessonStepDTO | null;
      }>(`/api/teaching/lesson/${session.sessionId}/advance`, {
        selectedIndex: currentStepData.questionType === "mcq" || currentStepData.questionType === "truefalse" ? selectedIndex : null,
        textAnswer: currentStepData.questionType === "short" || currentStepData.questionType === "reasoning" ? textAnswer : null,
        numericAnswer: null,
        advance,
      });

      if (result.analysis) {
        setAnalysis(result.analysis);
        setRevealed(true);
        if (result.analysis.correct) toast.success("Correct! Well reasoned.");
        else toast.info("Let's review the feedback below.");
      }

      if (advance && result.nextStep) {
        setSession({ ...session, currentStep: result.currentStep });
        resetAnswerState();
      } else if (advance && result.finished) {
        setSession({ ...session, currentStep: result.currentStep });
        toast.success("Lesson complete! +50 XP");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function askSocratic() {
    if (!socraticInput.trim() || socraticLoading) return;
    const userMsg = socraticInput;
    setSocraticInput("");
    setSocraticMessages((m) => [...m, { role: "user", content: userMsg }]);
    setSocraticLoading(true);
    try {
      const result = await api.post<{ response: string }>(`/api/teaching/socratic/${topicId}`, {
        studentInput: userMsg,
        lessonSteps: session?.steps ?? [],
        stepIndex: session?.currentStep ?? 0,
        previousInteractions: socraticMessages,
      });
      setSocraticMessages((m) => [...m, { role: "assistant", content: result.response }]);
    } catch (err) {
      toast.error("Socratic teaching failed");
      setSocraticMessages((m) => m.slice(0, -1));
    } finally {
      setSocraticLoading(false);
    }
  }

  if (loading) return <LoadingState message="Your AI teacher is preparing the lesson…" />;
  if (!session || !currentStepData) return null;

  const progress = ((session.currentStep + 1) / session.totalSteps) * 100;
  const isQuestion = currentStepData.type === "question";
  const isFinished = session.currentStep >= session.totalSteps;

  if (isFinished) {
    return (
      <div className="max-w-xl mx-auto fade-in">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-gradient-to-br from-emerald-600 to-teal-600">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Lesson Complete!</h2>
          <p className="text-sm text-muted-foreground mt-1">You've finished "{session.topic.title}".</p>
          <p className="text-xs text-muted-foreground mt-2">+50 XP earned. Your memory model has been updated.</p>
          <Button className="mt-6 bg-gradient-to-r from-primary to-primary text-white" onClick={onBack}>
            Back to topics
          </Button>
        </Card>
      </div>
    );
  }

  const StepIcon = STEP_ICONS[currentStepData.type] ?? BookOpen;
  const stepGradient = STEP_COLORS[currentStepData.type] ?? "from-primary to-primary";

  return (
    <div className="max-w-3xl mx-auto fade-in">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 text-xs">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Exit lesson
      </Button>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] gap-1">
              <BookOpen className="w-2.5 h-2.5" /> Step {session.currentStep + 1}/{session.totalSteps}
            </Badge>
            <span className="text-xs font-medium">{session.topic.title}</span>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setSocraticMode(!socraticMode)}>
            <MessageSquare className="w-3 h-3 mr-1" /> {socraticMode ? "Hide" : "Ask"} tutor
          </Button>
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      <div className={socraticMode ? "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3" : ""}>
        {/* Main lesson panel */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={session.currentStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="p-6">
                {/* Step header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stepGradient} flex items-center justify-center shrink-0`}>
                    <StepIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider capitalize">{currentStepData.type}</Badge>
                    <h2 className="text-base font-semibold mt-0.5">{currentStepData.title}</h2>
                  </div>
                </div>

                {/* Step content */}
                <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_p]:leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent">
                  <ReactMarkdown>{currentStepData.content}</ReactMarkdown>
                </div>

                {/* Visualization type badge */}
                {currentStepData.visualizationType && (
                  <Badge variant="outline" className="text-[10px] capitalize gap-1 mt-2">
                    <Eye className="w-2.5 h-2.5" /> {currentStepData.visualizationType.replace("_", " ")}
                  </Badge>
                )}

                {/* Question input */}
                {isQuestion && !revealed && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Answer</p>
                    {(currentStepData.questionType === "mcq" || currentStepData.questionType === "truefalse") && currentStepData.options && (
                      <div className="space-y-2">
                        {currentStepData.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedIndex(i)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-2.5 text-sm ${
                              selectedIndex === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                              selectedIndex === i ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                            }`}>{String.fromCharCode(65 + i)}</div>
                            <span className="flex-1">{opt}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {currentStepData.questionType === "short" && (
                      <Input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Type your answer…" />
                    )}
                    {currentStepData.questionType === "reasoning" && (
                      <Textarea rows={4} value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Explain your reasoning…" />
                    )}
                    {currentStepData.hint && (
                      <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Hint: {currentStepData.hint}
                      </p>
                    )}
                    <Button
                      onClick={() => submitAnswer(false)}
                      disabled={submitting || (selectedIndex === null && !textAnswer)}
                      className="bg-gradient-to-r from-primary to-primary text-white"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      Submit answer
                    </Button>
                  </div>
                )}

                {/* Thinking analysis */}
                {analysis && revealed && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 pt-4 border-t">
                    <div className={`p-4 rounded-xl border-2 ${analysis.correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {analysis.correct ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                        <span className="font-semibold text-sm">{analysis.correct ? "Correct!" : "Not quite right"}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{Math.round(analysis.score * 100)}% score</Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <AnalysisChip label="Reasoning" value={analysis.reasoning} />
                        <AnalysisChip label="Confidence" value={analysis.confidence} />
                        <AnalysisChip label="Explanation" value={analysis.explanationQuality} />
                        <AnalysisChip label="Score" value={`${Math.round(analysis.score * 100)}%`} />
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{analysis.feedback}</p>

                      {analysis.misconceptions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">Misconceptions</p>
                          {analysis.misconceptions.map((m, i) => (
                            <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-rose-500" /> {m}
                            </p>
                          ))}
                        </div>
                      )}

                      {analysis.suggestions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">Suggestions</p>
                          {analysis.suggestions.map((s, i) => (
                            <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                              <TrendingUp className="w-3 h-3 mt-0.5 shrink-0 text-primary" /> {s}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => submitAnswer(true)}
                      disabled={submitting}
                      className="w-full mt-3 bg-gradient-to-r from-primary to-primary text-white"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
                    </Button>
                  </motion.div>
                )}

                {/* Non-question step: just continue */}
                {!isQuestion && (
                  <Button
                    onClick={() => submitAnswer(true)}
                    disabled={submitting}
                    className="w-full mt-4 bg-gradient-to-r from-primary to-primary text-white"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
                  </Button>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Socratic tutor panel */}
        {socraticMode && (
          <Card className="flex flex-col h-[calc(100vh-12rem)] lg:h-auto">
            <div className="p-3 border-b flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold">Socratic Tutor</p>
                <p className="text-[10px] text-muted-foreground">Guides you via questions</p>
              </div>
            </div>
            <div ref={socraticScrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3 min-h-[200px]">
              {socraticMessages.length === 0 ? (
                <div className="text-center py-6">
                  <Brain className="w-8 h-8 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Ask a question or ask for a hint. I'll guide you to the answer.</p>
                </div>
              ) : (
                socraticMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      msg.role === "user" ? "bg-emerald-500/15 text-emerald-600" : "bg-gradient-to-br from-primary to-primary text-white"
                    }`}>
                      {msg.role === "user" ? "Y" : "AI"}
                    </div>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${msg.role === "user" ? "bg-emerald-500/10" : "bg-muted"}`}>
                      <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {socraticLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary flex items-center justify-center text-[10px] font-bold text-white">AI</div>
                  <div className="bg-muted rounded-xl px-3 py-2 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-2 border-t">
              <div className="flex gap-1.5">
                <Input
                  value={socraticInput}
                  onChange={(e) => setSocraticInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askSocratic()}
                  placeholder="Ask for a hint…"
                  className="h-8 text-xs"
                />
                <Button size="icon" className="h-8 w-8 bg-gradient-to-r from-primary to-primary text-white" onClick={askSocratic} disabled={socraticLoading}>
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function AnalysisChip({ label, value }: { label: string; value: string }) {
  const colors: Record<string, string> = {
    strong: "text-emerald-600 dark:text-emerald-400",
    excellent: "text-emerald-600 dark:text-emerald-400",
    good: "text-emerald-600 dark:text-emerald-400",
    high: "text-emerald-600 dark:text-emerald-400",
    adequate: "text-amber-600 dark:text-amber-400",
    medium: "text-amber-600 dark:text-amber-400",
    fair: "text-amber-600 dark:text-amber-400",
    weak: "text-rose-600 dark:text-rose-400",
    poor: "text-rose-600 dark:text-rose-400",
    low: "text-rose-600 dark:text-rose-400",
    absent: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="p-2 rounded-lg bg-muted/50 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-semibold capitalize ${colors[value] ?? ""}`}>{value}</p>
    </div>
  );
}
