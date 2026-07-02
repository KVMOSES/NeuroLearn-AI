"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot, Send, Plus, MessageSquare, Trash2, Loader2, Brain, Zap, User,
  Sparkles, FileText, Library, ChevronDown, GraduationCap, Lightbulb, Check, Copy,
  Target, BookOpen, Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api, streamSSE } from "@/lib/api-client";
import type { ChatMessage, ConversationSummary, Citation, DocSummary, LearnerProfileDTO } from "@/lib/types";
import { LoadingState } from "@/components/empty-states";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { relativeTime } from "@/lib/ui";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";

const QUICK_ACTIONS = [
  { icon: GraduationCap, label: "Teach me", prompt: "I want to learn something new. What should I start with based on my materials?", color: "from-primary to-primary" },
  { icon: Target, label: "Quiz me", prompt: "Quiz me on a topic I've been studying. Start with an easy question.", color: "from-emerald-600 to-teal-600" },
  { icon: Lightbulb, label: "Explain a concept", prompt: "Explain a concept I'm struggling with. Ask me what's confusing first.", color: "from-amber-500 to-orange-500" },
  { icon: Wand2, label: "Practice", prompt: "Give me a practice problem and guide me through it step by step using the Socratic method.", color: "from-rose-500 to-pink-500" },
];

const FOLLOW_UPS = [
  "Explain more",
  "Give an example",
  "Quiz me on this",
];

const TEACHING_MODES = [
  { key: "auto", label: "Auto", icon: "✨", description: "AI chooses the best style using your Learning DNA" },
  { key: "professor", label: "Professor", icon: "🎓", description: "Academic, thorough, formal explanations" },
  { key: "friendly", label: "Friendly", icon: "😊", description: "Casual, encouraging, conversational" },
  { key: "exam", label: "Exam Coach", icon: "📝", description: "Focused on exam technique and marks" },
  { key: "interview", label: "Interview Coach", icon: "💼", description: "Interview-level depth and edge cases" },
  { key: "motivational", label: "Motivational", icon: "🔥", description: "Energetic, confidence-building" },
  { key: "visual", label: "Visual", icon: "🎨", description: "Diagrams, analogies, mental models" },
  { key: "socratic", label: "Socratic", icon: "🤔", description: "Guides via questions, never reveals answers" },
  { key: "beginner", label: "Beginner", icon: "🌱", description: "Simple language, step-by-step" },
  { key: "advanced", label: "Advanced", icon: "⚡", description: "Technical depth, proofs, optimization" },
];

const TEACHING_MODE_ICONS: Record<string, string> = Object.fromEntries(
  TEACHING_MODES.map((m) => [m.key, m.icon])
);

const COMPANIONS_LIST = [
  { key: "nova", name: "Nova", title: "The Friendly Guide", icon: "🌟", gradient: "from-amber-500 to-orange-500", description: "Friendly, encouraging, and always positive." },
  { key: "atlas", name: "Atlas", title: "The Logical Mentor", icon: "🧭", gradient: "from-blue-500 to-cyan-500", description: "Logical, rigorous, and precise." },
  { key: "sage", name: "Sage", title: "The Patient Teacher", icon: "🍃", gradient: "from-emerald-500 to-teal-500", description: "Calm, patient, and wise." },
  { key: "spark", name: "Spark", title: "The Energy Coach", icon: "⚡", gradient: "from-rose-500 to-pink-500", description: "Energetic, motivational, and intense." },
];

export function TutorView() {
  const { setView } = useAppStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [rag, setRag] = useState(true);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [scopeDoc, setScopeDoc] = useState<string>("all");
  const [profile, setProfile] = useState<LearnerProfileDTO | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teachingMode, setTeachingMode] = useState<string>("auto");
  const [modeOpen, setModeOpen] = useState(false);
  const [companion, setCompanion] = useState<any>(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");

  useEffect(() => {
    api.get<{ conversations: ConversationSummary[] }>("/api/ai/conversations")
      .then((d) => setConversations(d.conversations))
      .finally(() => setLoadingConvos(false));
    api.get<{ documents: DocSummary[] }>("/api/documents").then((d) => setDocs(d.documents.filter((x) => x.status === "ready")));
    api.get<{ profile: LearnerProfileDTO | null }>("/api/teaching/profile").then((d) => setProfile(d.profile));
    api.get<{ dna: any }>("/api/teaching/dna").then((d) => {
      if (d.dna) setTeachingMode(d.dna.teachingMode || "auto");
    });
    api.get<{ companions: any[]; currentCompanion: string }>("/api/teaching/companion").then((d) => {
      const current = d.companions.find((c) => c.key === d.currentCompanion) ?? d.companions[0];
      setCompanion(current);
    });
  }, []);

  async function changeCompanion(key: string) {
    setCompanionOpen(false);
    try {
      await api.post("/api/teaching/companion", { companion: key });
      const d = await api.get<{ companions: any[]; currentCompanion: string }>("/api/teaching/companion");
      const current = d.companions.find((c) => c.key === d.currentCompanion) ?? d.companions[0];
      setCompanion(current);
      toast.success(`Mentor switched to ${current.name} ${current.icon}`);
    } catch {
      // ignore
    }
  }

  async function changeMode(mode: string) {
    setTeachingMode(mode);
    setModeOpen(false);
    try {
      await api.post("/api/teaching/dna", { mode });
      toast.success(`Teaching mode: ${mode}`);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    streamingTextRef.current = streamingText;
  }, [streamingText]);

  function selectConversation(id: string) {
    setActiveId(id);
    setLoadingMsgs(true);
    setMessages([]);
    setSidebarOpen(false);
    api.get<{ conversation: { messages: ChatMessage[] } }>(`/api/ai/conversations/${id}`)
      .then((d) => setMessages(d.conversation.messages.map((m) => ({
        ...m,
        citations: m.citations ? (typeof m.citations === "string" ? JSON.parse(m.citations as any) : m.citations) : null,
      }))))
      .finally(() => setLoadingMsgs(false));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    setInput("");
    const userMsg: ChatMessage = { role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setStreaming(true);
    setStreamingText("");
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamSSE(
      "/api/ai/chat",
      { message: content, conversationId: activeId ?? undefined, rag, documentId: scopeDoc === "all" ? undefined : scopeDoc },
      {
        onToken: (delta) => setStreamingText((t) => t + delta),
        onDone: (meta) => {
          const finalText = streamingTextRef.current;
          const citations = (meta.citations as Citation[]) ?? [];
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: finalText, citations };
            return copy;
          });
          setStreamingText("");
          if (meta.conversationId && !activeId) {
            setActiveId(meta.conversationId as string);
            refreshConversations();
          } else {
            refreshConversations();
          }
        },
        onError: (msg) => {
          toast.error(msg || "AI request failed");
          setMessages((m) => m.slice(0, -1));
        },
      },
      controller.signal
    );

    setStreaming(false);
  }

  async function refreshConversations() {
    const d = await api.get<{ conversations: ConversationSummary[] }>("/api/ai/conversations");
    setConversations(d.conversations);
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function deleteConversation(id: string) {
    try {
      await api.delete(`/api/ai/conversations/${id}`);
      if (activeId === id) { setActiveId(null); setMessages([]); }
      refreshConversations();
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  const readyDocs = docs.filter((d) => d.status === "ready");
  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex gap-0 h-[calc(100vh-3.5rem)] max-w-7xl mx-auto fade-in overflow-hidden">
      {/* Conversation sidebar — toggleable on mobile */}
      <AnimatePresence>
        {(sidebarOpen || typeof window === "undefined" || window.innerWidth >= 1024) && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="lg:w-64 shrink-0 overflow-hidden"
          >
            <div className="w-64 h-full flex flex-col p-2 border-r">
              <Button onClick={newConversation} className="mb-2 bg-gradient-to-r from-primary to-primary text-white h-9">
                <Plus className="w-4 h-4 mr-1" /> New chat
              </Button>
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
                {loadingConvos ? (
                  <LoadingState message="Loading…" />
                ) : conversations.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-6">No conversations yet</p>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        activeId === c.id ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                      }`}
                      onClick={() => selectConversation(c.id)}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{c.title}</p>
                        <p className="text-[9px] text-muted-foreground">{c.messageCount} msgs · {relativeTime(c.updatedAt)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/10 hover:text-rose-500 rounded transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel — full height, immersive */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="h-12 border-b flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              className="lg:hidden p-1.5 rounded-md hover:bg-muted"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            {/* Companion avatar — clickable to switch */}
            <button
              onClick={() => setCompanionOpen(!companionOpen)}
              className="relative press"
              title={companion ? `${companion.name} — ${companion.title}` : "NeuroTutor"}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${companion?.gradient ?? "from-primary to-primary"} flex items-center justify-center shadow-soft companion-idle`}>
                <span className="text-base">{companion?.icon ?? "🤖"}</span>
              </div>
            </button>
            <div>
              <p className="text-xs font-semibold leading-tight">{companion?.name ?? "NeuroTutor"}</p>
              <p className="text-[10px] text-muted-foreground">{streaming ? "Typing…" : companion?.title ?? "Your AI teacher"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Teaching mode selector */}
            <div className="relative">
              <button
                onClick={() => setModeOpen(!modeOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-muted/30 hover:bg-muted/60 text-xs font-medium transition-colors"
              >
                <span>{TEACHING_MODE_ICONS[teachingMode] ?? "✨"}</span>
                <span className="capitalize">{teachingMode}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              {modeOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border bg-popover shadow-lg z-50 p-1.5 max-h-80 overflow-y-auto scrollbar-thin">
                  {TEACHING_MODES.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => changeMode(m.key)}
                      className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${teachingMode === m.key ? "bg-accent" : "hover:bg-muted/60"}`}
                    >
                      <span className="text-base shrink-0">{m.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{m.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Companion selector dropdown */}
            {companionOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border bg-popover shadow-lg z-50 p-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 py-1.5">Choose your mentor</p>
                {COMPANIONS_LIST.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => changeCompanion(c.key)}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${companion?.key === c.key ? "bg-accent" : "hover:bg-muted/60"}`}
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.gradient} flex items-center justify-center shrink-0`}>
                      <span className="text-base">{c.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{c.name} <span className="text-muted-foreground font-normal">— {c.title}</span></p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{c.description}</p>
                    </div>
                    {companion?.key === c.key && <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-1" />}
                  </button>
                ))}
              </div>
            )}
            {/* Teaching context badge */}
            {profile && (
              <Badge variant="outline" className="text-[9px] gap-1 hidden sm:flex">
                <Brain className="w-2.5 h-2.5 text-primary" />
                Knows your {profile.preferredStyle} style
              </Badge>
            )}
            <div className="flex items-center gap-1.5">
              <Label htmlFor="rag" className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                <Library className="w-3 h-3" /> RAG
              </Label>
              <Switch id="rag" checked={rag} onCheckedChange={setRag} />
            </div>
            {rag && readyDocs.length > 0 && (
              <Select value={scopeDoc} onValueChange={setScopeDoc}>
                <SelectTrigger className="h-7 w-32 text-[10px] border-none bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All documents</SelectItem>
                  {readyDocs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title.slice(0, 24)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Messages or empty state */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {isEmpty ? (
            <EmptyTutorState profile={profile} hasDocs={readyDocs.length > 0} onAction={(p) => send(p)} onViewDocs={() => setView("documents")} companion={companion} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {/* Companion avatar for assistant messages */}
                    {msg.role === "assistant" ? (
                      <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${companion?.gradient ?? "from-primary to-primary"} flex items-center justify-center shrink-0 shadow-soft`}>
                        <span className="text-base">{companion?.icon ?? "🤖"}</span>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user" ? "bg-emerald-500/10" : "bg-muted"
                    }`}>
                      {msg.role === "assistant" && i === messages.length - 1 && streaming ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-background [&_code]:px-1 [&_code]:rounded [&_pre]:bg-background [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent">
                          {streamingText ? (
                            <ReactMarkdown>{streamingText}</ReactMarkdown>
                          ) : (
                            <div className="flex items-center gap-1.5 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                              <span className="text-[10px] text-muted-foreground ml-1">thinking…</span>
                            </div>
                          )}
                          {streamingText && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse rounded-sm ml-0.5 align-middle" />}
                        </div>
                      ) : (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_code]:bg-background [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-background [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {msg.citations && msg.citations.length > 0 && (
                            <CitationList citations={msg.citations} />
                          )}
                          {/* Copy + follow-up actions for completed assistant messages */}
                          {msg.role === "assistant" && !streaming && i === messages.length - 1 && (
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/40">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  toast.success("Copied to clipboard");
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors press"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                              {/* Follow-up suggestions */}
                              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                                {FOLLOW_UPS.map((sug, si) => (
                                  <button
                                    key={si}
                                    onClick={() => send(sug)}
                                    className="text-[10px] px-2 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors press"
                                  >
                                    {sug}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {loadingMsgs && <LoadingState message="Loading conversation…" />}
            </div>
          )}
        </div>

        {/* Input bar — sticky at bottom */}
        <div className="border-t shrink-0 bg-background/80 backdrop-blur">
          <div className="max-w-3xl mx-auto p-3">
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={rag && readyDocs.length > 0 ? "Ask about your documents…" : "Ask your AI teacher anything…"}
                  disabled={streaming}
                  rows={1}
                  className="w-full px-4 py-2.5 text-sm bg-muted/50 rounded-xl border border-transparent focus:border-primary/30 focus:bg-background outline-none transition-all resize-none min-h-[42px] max-h-32"
                  style={{ height: "auto" }}
                />
              </div>
              <Button type="submit" disabled={streaming || !input.trim()} size="icon" className="bg-gradient-to-r from-primary to-primary text-white h-10 w-10 rounded-xl shrink-0">
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
              NeuroTutor adapts to your learning style · {rag ? "RAG enabled" : "Standard mode"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyTutorState({ profile, hasDocs, onAction, onViewDocs, companion }: {
  profile: LearnerProfileDTO | null;
  hasDocs: boolean;
  onAction: (prompt: string) => void;
  onViewDocs: () => void;
  companion: any;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 h-full flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-5"
      >
        <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${companion?.gradient ?? "from-primary to-primary"} flex items-center justify-center mx-auto shadow-soft-lg companion-idle`}>
          <span className="text-4xl">{companion?.icon ?? "🤖"}</span>
        </div>
      </motion.div>

      <h2 className="text-xl font-bold tracking-tight">{companion?.name ?? "NeuroTutor"}</h2>
      <p className="text-xs text-muted-foreground mb-2">{companion?.title ?? "Your AI Teacher"}</p>
      <p className="text-sm text-muted-foreground max-w-md">
        {companion?.greeting ?? "I'm your personal AI teacher."}
      </p>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 mt-7 w-full max-w-md">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            onClick={() => onAction(action.prompt)}
            className="p-3.5 rounded-xl border bg-card hover:shadow-elevated hover:border-primary/30 transition-all text-left group"
          >
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
              <action.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-semibold">{action.label}</p>
          </motion.button>
        ))}
      </div>

      {!hasDocs && (
        <div className="mt-6 p-3.5 rounded-xl bg-primary/5 border border-primary/15 max-w-md">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground text-left">
              <span className="font-medium text-foreground">Upload a document</span> to unlock RAG-powered answers grounded in your material.
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={onViewDocs}>
              Upload
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CitationList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5 pt-2 border-t border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-primary hover:underline"
      >
        <FileText className="w-3 h-3" />
        {citations.length} source{citations.length > 1 ? "s" : ""}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {citations.map((c, i) => (
            <div key={i} className="p-2 rounded-md bg-background border text-[10px]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-primary">[{i + 1}] {c.documentTitle}</span>
                <span className="text-muted-foreground">{Math.round(c.score * 100)}%</span>
              </div>
              <p className="text-muted-foreground line-clamp-2">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
