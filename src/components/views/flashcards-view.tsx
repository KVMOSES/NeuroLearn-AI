"use client";

import { useEffect, useState } from "react";
import {
  Layers, RotateCw, ChevronRight, Loader2, Lightbulb, Brain, Check,
  ThumbsDown, ThumbsUp, Sparkles, Zap, Plus, FileText, Flame,
  TrendingUp, PartyPopper,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import type { FlashcardDueItem, DocSummary } from "@/lib/types";
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

interface DueResponse {
  due: FlashcardDueItem[];
  fresh: FlashcardDueItem[];
  totalDue: number;
  totalFresh: number;
}

export function FlashcardsView() {
  const [items, setItems] = useState<FlashcardDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [genDialog, setGenDialog] = useState(false);
  const [genDoc, setGenDoc] = useState("");
  const [genCount, setGenCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [streak, setStreak] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get<DueResponse>("/api/learning/flashcards/due?limit=10");
      const all = [...d.due, ...d.fresh];
      setItems(all);
      setIndex(0);
      setReviewed(0);
      setStreak(0);
      setFinished(all.length === 0);
    } catch {
      toast.error("Failed to load flashcards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<{ documents: DocSummary[] }>("/api/documents").then((d) => setDocs(d.documents.filter((x) => x.status === "ready")));
  }, []);

  async function review(quality: number) {
    const item = items[index];
    if (!item) return;
    setSubmitting(true);
    try {
      await api.post("/api/learning/flashcards/review", { flashcardId: item.flashcard.id, quality });
      setReviewed((r) => r + 1);
      if (quality >= 4) {
        setStreak((s) => s + 1);
        if (streak + 1 >= 3) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2000);
        }
      } else {
        setStreak(0);
      }
      setFlipped(false);
      if (quality >= 4) toast.success("Nice! +8 XP 🔥");
      else toast.info("We'll review this again soon");
      if (index + 1 >= items.length) setFinished(true);
      else setIndex((i) => i + 1);
    } catch {
      toast.error("Failed to save review");
    } finally {
      setSubmitting(false);
    }
  }

  async function generateFromDoc() {
    if (!genDoc) { toast.error("Select a document"); return; }
    setGenerating(true);
    try {
      const r = await api.post<{ flashcardCount: number }>("/api/documents/from-doc/flashcards", { documentId: genDoc, count: genCount });
      toast.success(`${r.flashcardCount} flashcards generated!`);
      setGenDialog(false);
      load();
    } catch (err) {
      toast.error((err as Error).message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingState message="Loading due cards…" />;

  if (finished || items.length === 0) {
    return (
      <>
        <Confetti show={finished && reviewed > 0} />
        <div className="max-w-xl mx-auto fade-in">
          <PageHeader title="Flashcards" description="Spaced repetition (SM-2) schedules reviews at the optimal moment." />
          <EmptyState
            icon={finished ? PartyPopper : Check}
            title={finished ? "All done! 🎉" : "No flashcards yet"}
            description={finished
              ? `You reviewed ${reviewed} cards. Your memory model has been updated.`
              : "Generate flashcards from your documents, or check back later for due reviews."}
            action={
              <div className="flex gap-2">
                {docs.length > 0 && (
                  <Button onClick={() => setGenDialog(true)} className="bg-gradient-to-r from-primary to-primary text-white">
                    <Plus className="w-4 h-4 mr-1" /> From document
                  </Button>
                )}
                <Button variant="outline" onClick={load}><RotateCw className="w-4 h-4 mr-1" /> Check again</Button>
              </div>
            }
          />
        </div>

        <Dialog open={genDialog} onOpenChange={setGenDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate flashcards from document</DialogTitle>
              <DialogDescription>AI reads your document and creates spaced-repetition flashcards.</DialogDescription>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Number of flashcards</Label>
                <Select value={String(genCount)} onValueChange={(v) => setGenCount(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 8, 12, 15, 20].map((n) => <SelectItem key={n} value={String(n)}>{n} cards</SelectItem>)}
                  </SelectContent>
                </Select>
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
      </>
    );
  }

  const current = items[index];
  const progress = (index / items.length) * 100;

  return (
    <>
      <Confetti show={showConfetti} />
      <div className="max-w-2xl mx-auto fade-in">
        {/* Progress header — Duolingo style */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{streak}</span>
                <span className="text-[10px] opacity-70">streak</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{reviewed}</span>
                <span className="text-[10px] opacity-70">reviewed</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-medium">{index + 1} / {items.length}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
              className="h-full bg-gradient-to-r from-primary to-primary rounded-full relative"
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm border-2 border-primary" />
            </motion.div>
          </div>
        </div>

        {/* Flashcard — 3D flip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.flashcard.id + index}
            initial={{ opacity: 0, rotateY: -90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 90 }}
            transition={{ duration: 0.3 }}
          >
            <div className="[perspective:1500px]">
              <div
                className={`relative min-h-[320px] cursor-pointer transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
                onClick={() => !submitting && setFlipped(!flipped)}
              >
                {/* Front */}
                <Card className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center [backface-visibility:hidden] border-2 border-primary/20">
                  <div className="absolute top-3 left-3">
                    <Badge variant="outline" className="text-[9px] gap-1 bg-primary/5">
                      <Brain className="w-2.5 h-2.5 text-primary" /> Question
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge variant="outline" className="text-[9px]">
                      {index + 1} / {items.length}
                    </Badge>
                  </div>
                  <p className="text-xl font-semibold leading-relaxed px-4">{current.flashcard.front}</p>
                  <p className="text-[11px] text-muted-foreground mt-6 flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3" /> Click to reveal answer
                  </p>
                </Card>
                {/* Back */}
                <Card className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-primary/5 to-primary/5 border-2 border-primary/30">
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-primary/15 text-primary gap-1 text-[9px]">
                      <Check className="w-2.5 h-2.5" /> Answer
                    </Badge>
                  </div>
                  <p className="text-base leading-relaxed">{current.flashcard.back}</p>
                  {current.flashcard.hint && (
                    <p className="text-[11px] text-muted-foreground mt-4 italic flex items-center gap-1.5">
                      <Lightbulb className="w-3 h-3" /> {current.flashcard.hint}
                    </p>
                  )}
                </Card>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Action buttons */}
        <div className="mt-5">
          {!flipped ? (
            <Button
              onClick={() => setFlipped(true)}
              className="w-full h-12 bg-gradient-to-r from-primary to-primary text-white scale-tap text-base font-semibold"
              disabled={submitting}
            >
              <RotateCw className="w-4 h-4 mr-1.5" /> Reveal answer
            </Button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <p className="text-center text-xs text-muted-foreground mb-3">How well did you recall it?</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { q: 0, label: "Blackout", icon: ThumbsDown, color: "hover:border-rose-500/40 hover:bg-rose-500/5 text-rose-500", emoji: "😵" },
                  { q: 2, label: "Forgot", icon: ThumbsDown, color: "hover:border-amber-500/40 hover:bg-amber-500/5 text-amber-500", emoji: "🤔" },
                  { q: 4, label: "Good", icon: ThumbsUp, color: "hover:border-emerald-500/40 hover:bg-emerald-500/5 text-emerald-500", emoji: "🙂" },
                  { q: 5, label: "Perfect", icon: Sparkles, color: "hover:border-primary/40 hover:bg-primary/5 text-primary", emoji: "🤩" },
                ].map((b) => (
                  <motion.button
                    key={b.q}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => review(b.q)}
                    disabled={submitting}
                    className={`flex-col h-auto py-3 rounded-xl border-2 transition-all ${b.color}`}
                  >
                    <span className="text-xl mb-0.5">{b.emoji}</span>
                    <span className="text-[10px] font-medium">{b.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Memory tip */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          Next review scheduled by SM-2 spaced repetition algorithm
        </div>
      </div>
    </>
  );
}
