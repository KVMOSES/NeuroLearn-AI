"use client";

import { useEffect, useState } from "react";
import {
  Target, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2,
  Brain, Sparkles, TrendingUp, AlertTriangle, Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { DiagnosticQuestionDTO, LearnerProfileDTO } from "@/lib/types";
import { LoadingState } from "@/components/empty-states";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Answer {
  selectedIndex?: number;
  textAnswer?: string;
  numericAnswer?: number;
  timeMs: number;
}

export function DiagnosticFlow({ documentId, onBack, onComplete }: {
  documentId: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<"loading" | "questions" | "analyzing" | "results">("loading");
  const [questions, setQuestions] = useState<DiagnosticQuestionDTO[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [profile, setProfile] = useState<LearnerProfileDTO | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    api.post<{ sessionId: string; questions: DiagnosticQuestionDTO[] }>(`/api/teaching/diagnostic/start/${documentId}`, { count: 8 })
      .then((d) => {
        setSessionId(d.sessionId);
        setQuestions(d.questions);
        setStage("questions");
      })
      .catch((err) => {
        toast.error((err as Error).message || "Failed to start diagnostic");
        onBack();
      });
  }, [documentId]);

  function setAnswer(idx: number, answer: Answer) {
    setAnswers((prev) => ({ ...prev, [idx]: answer }));
  }

  async function submit() {
    setStage("analyzing");
    try {
      const result = await api.post<{
        profile: LearnerProfileDTO;
        score: number;
        correctCount: number;
        totalQuestions: number;
      }>("/api/teaching/diagnostic/submit", {
        sessionId,
        answers: questions.map((q, i) => ({
          question: q,
          selectedIndex: answers[i]?.selectedIndex ?? null,
          textAnswer: answers[i]?.textAnswer ?? null,
          numericAnswer: answers[i]?.numericAnswer ?? null,
          timeMs: answers[i]?.timeMs ?? 0,
        })),
      });
      setProfile(result.profile);
      setScore(result.score);
      setCorrectCount(result.correctCount);
      setStage("results");
      toast.success("Diagnostic complete! Your learner profile is ready.");
    } catch (err) {
      toast.error((err as Error).message || "Analysis failed");
      setStage("questions");
    }
  }

  if (stage === "loading") return <LoadingState message="Generating your diagnostic assessment…" />;
  if (stage === "analyzing") return <LoadingState message="Analyzing your responses and building your learner profile…" />;

  if (stage === "results" && profile) {
    return (
      <div className="max-w-2xl mx-auto fade-in">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 bg-gradient-to-br from-primary to-primary">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Diagnostic Complete</h2>
            <p className="text-sm text-muted-foreground mt-1">Your personalized learner profile has been created.</p>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div><p className="text-2xl font-bold text-primary">{score}%</p><p className="text-[10px] text-muted-foreground">Score</p></div>
              <div><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{correctCount}/{questions.length}</p><p className="text-[10px] text-muted-foreground">Correct</p></div>
              <div><p className="text-2xl font-bold text-amber-600 dark:text-amber-400 capitalize">{profile.preferredStyle}</p><p className="text-[10px] text-muted-foreground">Style</p></div>
            </div>

            <div className="mt-6 text-left space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Profile</h3>
              <ProfileBar label="Prior Knowledge" value={profile.priorKnowledge} />
              <ProfileBar label="Conceptual Understanding" value={profile.conceptualUnderstanding} />
              <ProfileBar label="Reasoning Ability" value={profile.reasoningAbility} />
              <ProfileBar label="Confidence" value={profile.confidence} />
              <ProfileBar label="Learning Speed" value={profile.learningSpeed} />

              {profile.strengths.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Strengths</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.strengths.map((s) => <Badge key={s} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">{s}</Badge>)}
                  </div>
                </div>
              )}
              {profile.weaknesses.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Areas to Improve</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.weaknesses.map((s) => <Badge key={s} className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]">{s}</Badge>)}
                  </div>
                </div>
              )}
              {profile.misconceptions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> Misconceptions Detected</p>
                  <div className="space-y-1">
                    {profile.misconceptions.map((m, i) => (
                      <div key={i} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px]">
                        <span className="font-medium">{m.topic}:</span> {m.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onBack}>Back to topics</Button>
              <Button className="flex-1 bg-gradient-to-r from-primary to-primary text-white" onClick={onComplete}>
                <Sparkles className="w-4 h-4 mr-1" /> View learning plan
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Questions stage
  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  const isLast = current === questions.length - 1;
  const currentAnswer = answers[current];

  return (
    <div className="max-w-2xl mx-auto fade-in">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 text-xs">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Exit diagnostic
      </Button>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <Badge variant="secondary" className="text-[10px] gap-1"><Target className="w-2.5 h-2.5" /> Question {current + 1} of {questions.length}</Badge>
          <Badge variant="outline" className="text-[10px] capitalize">{q.cognitiveLevel}</Badge>
        </div>
        <Progress value={progress} className="h-1" />
        <p className="text-[10px] text-muted-foreground mt-1.5">Difficulty: {Math.round(q.difficulty * 100)}% · Topic: {q.topicTitle}</p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
          <Card className="p-5">
            <h3 className="text-base font-semibold leading-relaxed mb-4">{q.prompt}</h3>

            {(q.type === "mcq" || q.type === "truefalse") && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswer(current, { selectedIndex: i, timeMs: 0 })}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-2.5 text-sm ${
                      currentAnswer?.selectedIndex === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                      currentAnswer?.selectedIndex === i ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    }`}>{String.fromCharCode(65 + i)}</div>
                    <span className="flex-1">{opt}</span>
                  </button>
                ))}
              </div>
            )}

            {(q.type === "short" || q.type === "reasoning") && (
              <div className="space-y-2">
                <Label className="text-xs">{q.type === "reasoning" ? "Explain your reasoning" : "Your answer"}</Label>
                <Textarea
                  rows={q.type === "reasoning" ? 4 : 2}
                  value={currentAnswer?.textAnswer ?? ""}
                  onChange={(e) => setAnswer(current, { textAnswer: e.target.value, timeMs: 0 })}
                  placeholder="Type your answer…"
                />
              </div>
            )}

            {q.type === "numerical" && (
              <div className="space-y-2">
                <Label className="text-xs">Numerical answer</Label>
                <Input
                  type="number"
                  value={currentAnswer?.numericAnswer ?? ""}
                  onChange={(e) => setAnswer(current, { numericAnswer: parseFloat(e.target.value), timeMs: 0 })}
                  placeholder="Enter a number"
                />
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex justify-between">
        <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Previous
        </Button>
        {isLast ? (
          <Button size="sm" className="bg-gradient-to-r from-primary to-primary text-white" onClick={submit} disabled={!currentAnswer}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Submit diagnostic
          </Button>
        ) : (
          <Button size="sm" className="bg-gradient-to-r from-primary to-primary text-white" onClick={() => setCurrent(current + 1)} disabled={!currentAnswer}>
            Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfileBar({ label, value }: { label: string; value: number }) {
  const color = value > 70 ? "bg-emerald-500" : value > 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
