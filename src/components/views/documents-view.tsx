"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, Upload, Search, Loader2, Sparkles, Folder, FolderPlus, MoreVertical,
  Trash2, Pencil, Download, FileUp, X, FileCheck2, ListChecks, Layers, Share2,
  ChevronRight, Home, Tag, Clock, FileWarning,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import type { DocSummary, Folder as FolderT, KnowledgeBuildResult } from "@/lib/types";
import { LoadingState, EmptyState, PageHeader } from "@/components/empty-states";
import { toast } from "sonner";
import { relativeTime, formatBytes, SOURCE_TYPE_META } from "@/lib/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";

interface UploadProgress {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

export function DocumentsView() {
  const { setView } = useAppStore();
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [folders, setFolders] = useState<FolderT[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocSummary | null>(null);
  const [renameDialog, setRenameDialog] = useState<DocSummary | null>(null);
  const [renameForm, setRenameForm] = useState({ title: "", tags: "" });
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([
        api.get<{ documents: DocSummary[] }>(`/api/documents${activeFolder ? `?folderId=${activeFolder}` : ""}`),
        api.get<{ folders: FolderT[] }>("/api/documents/folders"),
      ]);
      setDocs(d.documents);
      setFolders(f.folders);
    } finally {
      setLoading(false);
    }
  }, [activeFolder]);

  useEffect(() => { load(); }, [load]);

  const filtered = query.trim()
    ? docs.filter((d) => d.title.toLowerCase().includes(query.toLowerCase()) || d.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())))
    : docs;

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const file of arr) {
      const uploadId = `${Date.now()}-${file.name}`;
      setUploads((u) => [...u, { id: uploadId, fileName: file.name, size: file.size, progress: 0, status: "uploading" }]);

      // Simulate progress while uploading (XHR would be more accurate)
      const progressInterval = setInterval(() => {
        setUploads((u) => u.map((x) => x.id === uploadId && x.status === "uploading" ? { ...x, progress: Math.min(90, x.progress + 8) } : x));
      }, 200);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("folderId", activeFolder ?? "");
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.open("POST", "/api/documents");
          xhr.withCredentials = true;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploads((u) => u.map((x) => x.id === uploadId ? { ...x, progress: Math.min(95, (e.loaded / e.total) * 95) } : x));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed (${xhr.status})`));
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(form);
        });
        clearInterval(progressInterval);
        setUploads((u) => u.map((x) => x.id === uploadId ? { ...x, progress: 100, status: "processing" } : x));
        // Poll for completion by reloading
        await load();
        setTimeout(() => {
          setUploads((u) => u.map((x) => x.id === uploadId ? { ...x, status: "done" } : x));
          setTimeout(() => setUploads((u) => u.filter((x) => x.id !== uploadId)), 1500);
        }, 1500);
        toast.success(`"${file.name}" ingested`);
      } catch (err) {
        clearInterval(progressInterval);
        setUploads((u) => u.map((x) => x.id === uploadId ? { ...x, status: "error", error: (err as Error).message } : x));
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    try {
      await api.post("/api/documents/folders", { name: newFolderName, color: "violet", parentId: null });
      setNewFolderName("");
      setFolderDialog(false);
      load();
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document? This removes its chunks, flashcards, and quizzes.")) return;
    try {
      await api.delete(`/api/documents/${id}`);
      load();
      toast.success("Document deleted");
    } catch {
      toast.error("Delete failed");
    }
  }

  async function saveRename() {
    if (!renameDialog) return;
    try {
      const tags = renameForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await fetch(`/api/documents/${renameDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: renameForm.title, tags }),
      });
      toast.success("Updated");
      setRenameDialog(null);
      load();
    } catch {
      toast.error("Update failed");
    }
  }

  async function generateFromDoc(doc: DocSummary, kind: "quiz" | "flashcards" | "knowledge") {
    setGenBusy(doc.id + kind);
    try {
      if (kind === "quiz") {
        await api.post("/api/documents/from-doc/quiz", { documentId: doc.id, count: 5, difficulty: "medium" });
        toast.success("Quiz generated from document!");
        setView("quizzes");
      } else if (kind === "flashcards") {
        await api.post("/api/documents/from-doc/flashcards", { documentId: doc.id, count: 8 });
        toast.success("Flashcards generated!");
        setView("flashcards");
      } else {
        const r = await api.post<KnowledgeBuildResult>("/api/documents/from-doc/knowledge", { documentId: doc.id });
        toast.success(`Knowledge graph built: ${r.skillCount} skills, ${r.edgeCount} edges`);
        setView("knowledge");
      }
    } catch (err) {
      toast.error((err as Error).message || "Generation failed");
    } finally {
      setGenBusy(null);
    }
  }

  const activeFolderName = activeFolder ? folders.find((f) => f.id === activeFolder)?.name : null;

  return (
    <div className="max-w-7xl mx-auto fade-in">
      <PageHeader
        title="Documents"
        description="Upload, organize, and learn from your material — PDF, DOCX, PPTX, TXT, MD."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setFolderDialog(true)}>
              <FolderPlus className="w-3.5 h-3.5 mr-1.5" /> Folder
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-primary to-primary text-white" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        }
      />

      {/* Upload progress */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-4 space-y-2">
            {uploads.map((u) => (
              <Card key={u.id} className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.status === "done" ? "bg-emerald-500/10" : u.status === "error" ? "bg-rose-500/10" : "bg-primary/10"}`}>
                  {u.status === "done" ? <FileCheck2 className="w-4 h-4 text-emerald-600" /> : u.status === "error" ? <FileWarning className="w-4 h-4 text-rose-600" /> : <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate">{u.fileName}</span>
                    <span className="text-muted-foreground">{u.status === "processing" ? "Indexing…" : u.status === "done" ? "Done" : u.status === "error" ? "Failed" : `${Math.round(u.progress)}%`}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${u.status === "error" ? "bg-rose-500" : u.status === "done" ? "bg-emerald-500" : "bg-gradient-to-r from-primary to-primary"}`} style={{ width: `${u.progress}%` }} />
                  </div>
                </div>
                <button onClick={() => setUploads((p) => p.filter((x) => x.id !== u.id))} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Folders sidebar */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveFolder(null)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${activeFolder === null ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
          >
            <Home className="w-3.5 h-3.5" /> All documents
            <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0">{docs.length}</Badge>
          </button>
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mt-2">Folders</p>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${activeFolder === f.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
            >
              <Folder className="w-3.5 h-3.5 text-primary" /> {f.name}
              <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0">{f.documentCount}</Badge>
            </button>
          ))}
          {folders.length === 0 && (
            <p className="px-2.5 text-[10px] text-muted-foreground">No folders yet</p>
          )}
        </div>

        {/* Main panel */}
        <div>
          {/* Search + drag-drop */}
          <div className="mb-4 relative">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative rounded-xl border-2 border-dashed transition-all ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center gap-2 p-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search documents by title or tag…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 h-9 border-transparent bg-transparent focus-visible:border-transparent"
                  />
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="w-3.5 h-3.5 mr-1" /> Browse
                </Button>
              </div>
              {dragOver && (
                <div className="absolute inset-0 bg-primary/10 rounded-xl flex items-center justify-center pointer-events-none">
                  <p className="text-sm font-medium text-primary flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Drop files to upload
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumb */}
          {activeFolderName && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
              <button onClick={() => setActiveFolder(null)} className="hover:text-foreground">All</button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{activeFolderName}</span>
            </div>
          )}

          {loading ? (
            <LoadingState message="Loading documents…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={query ? "No matches" : "No documents yet"}
              description={query ? "Try a different search." : "Drag & drop files here, or click upload. Supported: PDF, DOCX, PPTX, TXT, MD."}
              action={!query && (
                <Button onClick={() => fileInputRef.current?.click()} className="bg-gradient-to-r from-primary to-primary text-white">
                  <Upload className="w-4 h-4 mr-1.5" /> Upload your first document
                </Button>
              )}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((doc, i) => {
                const meta = SOURCE_TYPE_META[doc.sourceType] ?? SOURCE_TYPE_META.txt;
                const typeGradient = {
                  pdf: "from-rose-500 to-red-600",
                  docx: "from-cyan-500 to-blue-600",
                  pptx: "from-amber-500 to-orange-600",
                  txt: "from-slate-500 to-slate-600",
                  md: "from-primary to-primary",
                }[doc.sourceType] ?? "from-primary to-primary";
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="p-0 overflow-hidden hover:shadow-elevated transition-shadow group cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                      {/* Colored header strip */}
                      <div className={`h-1.5 bg-gradient-to-r ${typeGradient}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2.5">
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${typeGradient} flex items-center justify-center shrink-0 shadow-sm`}>
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                                <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); }}>
                                <FileText className="w-3.5 h-3.5 mr-2" /> Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameDialog(doc); setRenameForm({ title: doc.title, tags: doc.tags.join(", ") }); }}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Rename / tag
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/api/documents/${doc.id}/preview`, "_blank"); }}>
                                <Download className="w-3.5 h-3.5 mr-2" /> Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generateFromDoc(doc, "quiz"); }} disabled={genBusy === doc.id + "quiz"}>
                                <ListChecks className="w-3.5 h-3.5 mr-2" /> Generate quiz
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generateFromDoc(doc, "flashcards"); }} disabled={genBusy === doc.id + "flashcards"}>
                                <Layers className="w-3.5 h-3.5 mr-2" /> Generate flashcards
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); generateFromDoc(doc, "knowledge"); }} disabled={genBusy === doc.id + "knowledge"}>
                                <Share2 className="w-3.5 h-3.5 mr-2" /> Build knowledge graph
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }} className="text-rose-600 dark:text-rose-400 focus:text-rose-600">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1.5 group-hover:group-hover:text-primary transition-colors">{doc.title}</h3>

                        {/* Summary (if available) */}
                        {doc.summary && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">{doc.summary}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${meta.color}`}>{meta.label}</Badge>
                          <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{relativeTime(doc.updatedAt)}</span>
                          <span>{formatBytes(doc.sizeBytes)}</span>
                        </div>

                        {/* Status / stats */}
                        {doc.status === "processing" ? (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px]">Processing…</Badge>
                        ) : doc.status === "failed" ? (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px]">Failed</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1 items-center">
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">{doc.wordCount.toLocaleString()} words</Badge>
                            {doc.chunkCount > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0">{doc.chunkCount} chunks</Badge>}
                            {doc.flashcardCount > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-primary/10 text-primary"><Layers className="w-2 h-2" />{doc.flashcardCount}</Badge>}
                            {doc.quizCount > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><ListChecks className="w-2 h-2" />{doc.quizCount}</Badge>}
                          </div>
                        )}

                        {/* Tags */}
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {doc.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                                <Tag className="w-2 h-2" />{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Folder dialog */}
      <Dialog open={folderDialog} onOpenChange={setFolderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Organize your documents into folders.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="folderName">Name</Label>
            <Input id="folderName" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Machine Learning" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog(false)}>Cancel</Button>
            <Button onClick={createFolder} className="bg-gradient-to-r from-primary to-primary text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(o) => !o && setRenameDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
            <DialogDescription>Rename or retag this document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rTitle">Title</Label>
              <Input id="rTitle" value={renameForm.title} onChange={(e) => setRenameForm({ ...renameForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rTags">Tags (comma separated)</Label>
              <Input id="rTags" value={renameForm.tags} onChange={(e) => setRenameForm({ ...renameForm, tags: e.target.value })} placeholder="ml, notes, week-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>Cancel</Button>
            <Button onClick={saveRename} className="bg-gradient-to-r from-primary to-primary text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <DocPreview doc={selectedDoc} onClose={() => setSelectedDoc(null)} onGenerate={generateFromDoc} busy={genBusy} />
    </div>
  );
}

function DocPreview({ doc, onClose, onGenerate, busy }: {
  doc: DocSummary | null;
  onClose: () => void;
  onGenerate: (d: DocSummary, kind: "quiz" | "flashcards" | "knowledge") => void;
  busy: string | null;
}) {
  const [detail, setDetail] = useState<{ docId: string; contentPreview: string; summary: string | null } | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    api.get<{ document: any }>(`/api/documents/${doc.id}`)
      .then((d) => {
        if (!cancelled) setDetail({ docId: doc.id, contentPreview: d.document.contentPreview, summary: d.document.summary });
      })
      .catch(() => { if (!cancelled) setDetail(null); });
    return () => { cancelled = true; };
  }, [doc]);

  if (!doc) return null;
  const meta = SOURCE_TYPE_META[doc.sourceType] ?? SOURCE_TYPE_META.txt;
  const showLoading = !detail || detail.docId !== doc.id;

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${meta.color}`} />
            {doc.title}
          </DialogTitle>
          <DialogDescription>
            {meta.label} · {formatBytes(doc.sizeBytes)} · {doc.wordCount.toLocaleString()} words · {doc.chunkCount} chunks
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin -mx-6 px-6">
          {showLoading ? (
            <LoadingState message="Loading preview…" />
          ) : (
            <div className="space-y-4">
              {detail?.summary && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">AI Summary</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{detail.summary}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Content preview</p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap line-clamp-[20]">{detail?.contentPreview}</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onGenerate(doc, "quiz")} disabled={busy === doc.id + "quiz"}>
            {busy === doc.id + "quiz" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ListChecks className="w-3.5 h-3.5 mr-1" />}
            Quiz
          </Button>
          <Button size="sm" variant="outline" onClick={() => onGenerate(doc, "flashcards")} disabled={busy === doc.id + "flashcards"}>
            {busy === doc.id + "flashcards" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Layers className="w-3.5 h-3.5 mr-1" />}
            Flashcards
          </Button>
          <Button size="sm" variant="outline" onClick={() => onGenerate(doc, "knowledge")} disabled={busy === doc.id + "knowledge"}>
            {busy === doc.id + "knowledge" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Share2 className="w-3.5 h-3.5 mr-1" />}
            Knowledge graph
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => window.open(`/api/documents/${doc.id}/preview`, "_blank")}>
            <Download className="w-3.5 h-3.5 mr-1" /> Open original
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
