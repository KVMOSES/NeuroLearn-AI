"use client";

import { useEffect, useState, useMemo } from "react";
import { Share2, Brain, Loader2, Sparkles, Plus, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { KnowledgeGraph, DocSummary } from "@/lib/types";
import { LoadingState, EmptyState, PageHeader } from "@/components/empty-states";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  Programming: "var(--chart-1)",
  "AI/ML": "var(--chart-2)",
  Mathematics: "var(--chart-3)",
  Engineering: "var(--chart-4)",
  Generated: "var(--chart-5)",
  General: "var(--muted-foreground)",
};

export function KnowledgeView() {
  const { setView } = useAppStore();
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [genDialog, setGenDialog] = useState(false);
  const [genDoc, setGenDoc] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get<KnowledgeGraph>("/api/knowledge/graph").then(setGraph).finally(() => setLoading(false));
    api.get<{ documents: DocSummary[] }>("/api/documents").then((d) => setDocs(d.documents.filter((x) => x.status === "ready")));
  }, []);

  const layout = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    const cx = 400, cy = 300, r = 200;
    const nodes = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2 - Math.PI / 2;
      return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edges = graph.edges
      .map((e) => ({ ...e, source: nodeMap.get(e.source), target: nodeMap.get(e.target) }))
      .filter((e) => e.source && e.target);
    return { nodes, edges };
  }, [graph]);

  async function buildFromDoc() {
    if (!genDoc) { toast.error("Select a document"); return; }
    setGenerating(true);
    try {
      await api.post("/api/documents/from-doc/knowledge", { documentId: genDoc });
      toast.success("Knowledge graph built!");
      setGenDialog(false);
      const g = await api.get<KnowledgeGraph>("/api/knowledge/graph");
      setGraph(g);
    } catch (err) {
      toast.error((err as Error).message || "Failed to build graph");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingState message="Building knowledge graph…" />;

  return (
    <div className="space-y-4 max-w-7xl mx-auto fade-in">
      <PageHeader
        title="Knowledge Graph"
        description="Skills and prerequisite relationships, generated from your documents."
        action={
          docs.length > 0 && (
            <Button size="sm" className="bg-gradient-to-r from-primary to-primary text-white" onClick={() => setGenDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> From document
            </Button>
          )
        }
      />

      {!graph || graph.nodes.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No skills yet"
          description="Build your knowledge graph from an uploaded document — AI extracts concepts and their prerequisite relationships."
          action={
            <Button onClick={() => setView("documents")} className="bg-gradient-to-r from-primary to-primary text-white">
              <FileText className="w-4 h-4 mr-1.5" /> Upload a document
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(graph.nodes.map((n) => n.category))).map((c) => (
              <Badge key={c} variant="outline" className="gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[c] ?? "var(--muted-foreground)" }} />
                {c}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="lg:col-span-2 p-2 overflow-hidden relative">
              <div className="absolute inset-0 mesh-bg opacity-20 pointer-events-none" />
              <svg viewBox="0 0 800 600" className="w-full h-[600px] relative z-10">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="22" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="var(--muted-foreground)" />
                  </marker>
                  {layout.nodes.map((n) => (
                    <radialGradient key={`grad-${n.id}`} id={`glow-${n.id}`}>
                      <stop offset="0%" stopColor={CATEGORY_COLORS[n.category] ?? "var(--muted-foreground)"} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={CATEGORY_COLORS[n.category] ?? "var(--muted-foreground)"} stopOpacity="0" />
                    </radialGradient>
                  ))}
                </defs>
                {layout.edges.map((e, i) => (
                  <line key={i} x1={e.source!.x} y1={e.source!.y} x2={e.target!.x} y2={e.target!.y}
                    stroke="var(--border)" strokeWidth={1.5} markerEnd="url(#arrow)" opacity={0.6} />
                ))}
                {layout.nodes.map((n) => {
                  const color = CATEGORY_COLORS[n.category] ?? "var(--muted-foreground)";
                  const radius = 20 + n.lessonCount * 3;
                  const isSelected = selected === n.id;
                  const masteryLevel = n.mastery > 0.7 ? "high" : n.mastery > 0.4 ? "medium" : "low";
                  return (
                    <g key={n.id} className="cursor-pointer" onClick={() => setSelected(isSelected ? null : n.id)}>
                      {/* Glow effect for high-mastery nodes */}
                      {masteryLevel === "high" && (
                        <circle cx={n.x} cy={n.y} r={radius + 8} fill={`url(#glow-${n.id})`} className="pointer-events-none" />
                      )}
                      <motion.circle cx={n.x} cy={n.y} r={radius} fill={color}
                        fillOpacity={0.25 + n.mastery * 0.55}
                        stroke={color} strokeWidth={isSelected ? 3 : 2}
                        strokeOpacity={isSelected ? 1 : 0.7}
                        whileHover={{ scale: 1.15 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.3, type: "spring" }} />
                      <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
                        className="text-[10px] font-bold fill-foreground pointer-events-none" style={{ userSelect: "none" }}>
                        {n.name.length > 14 ? n.name.slice(0, 12) + "…" : n.name}
                      </text>
                      <text x={n.x} y={n.y + radius + 13} textAnchor="middle"
                        className={`text-[10px] font-bold pointer-events-none ${masteryLevel === "high" ? "fill-emerald-500" : masteryLevel === "medium" ? "fill-amber-500" : "fill-muted-foreground"}`}>
                        {Math.round(n.mastery * 100)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </Card>

            <Card className="p-5">
              {selected && graph ? (
                (() => {
                  const node = graph.nodes.find((n) => n.id === selected)!;
                  const color = CATEGORY_COLORS[node.category] ?? "var(--muted-foreground)";
                  return (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + "22" }}>
                          <Brain className="w-4 h-4" style={{ color }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{node.name}</h3>
                          <Badge variant="outline" className="text-[9px]">{node.category}</Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">Mastery (P known)</span>
                            <span className="font-semibold">{Math.round(node.mastery * 100)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${node.mastery * 100}%`, background: color }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-base font-bold">{node.observations}</p>
                            <p className="text-[9px] text-muted-foreground">Observations</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-base font-bold">{node.lessonCount}</p>
                            <p className="text-[9px] text-muted-foreground">Lessons</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Prerequisites</p>
                          {graph.edges.filter((e) => e.target === selected).length === 0 ? (
                            <p className="text-[10px] text-muted-foreground">None — foundational skill.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {graph.edges.filter((e) => e.target === selected).map((e) => {
                                const p = graph.nodes.find((n) => n.id === e.source);
                                return p ? <Badge key={e.source} variant="secondary" className="text-[9px] cursor-pointer" onClick={() => setSelected(p.id)}>{p.name}</Badge> : null;
                              })}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Unlocks</p>
                          {graph.edges.filter((e) => e.source === selected).length === 0 ? (
                            <p className="text-[10px] text-muted-foreground">No dependents.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {graph.edges.filter((e) => e.source === selected).map((e) => {
                                const d = graph.nodes.find((n) => n.id === e.target);
                                return d ? <Badge key={e.target} variant="secondary" className="text-[9px] cursor-pointer" onClick={() => setSelected(d.id)}>{d.name}</Badge> : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })()
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    <Share2 className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">Select a skill</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">Click any node to inspect its mastery, prerequisites, and dependents.</p>
                  <p className="text-[10px] text-muted-foreground mt-3">{graph?.nodes.length} skills · {graph?.edges.length} relationships</p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Dialog open={genDialog} onOpenChange={setGenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Build knowledge graph from document</DialogTitle>
            <DialogDescription>AI extracts concepts and prerequisite relationships from your document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Document</Label>
            <Select value={genDoc} onValueChange={setGenDoc}>
              <SelectTrigger><SelectValue placeholder="Choose a document" /></SelectTrigger>
              <SelectContent>
                {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialog(false)}>Cancel</Button>
            <Button onClick={buildFromDoc} disabled={generating} className="bg-gradient-to-r from-primary to-primary text-white">
              {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Build graph
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
