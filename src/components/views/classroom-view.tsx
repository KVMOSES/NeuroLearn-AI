"use client";

import { useEffect, useState } from "react";
import {
  School, Users, BookOpen, ClipboardList, Megaphone, Calendar, Plus,
  KeyRound, Loader2, ArrowRight, Check, Send,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";
import type { ClassroomSummary, ClassroomDetail, Announcement } from "@/lib/types";
import { LoadingState, EmptyState, PageHeader } from "@/components/empty-states";
import { relativeTime } from "@/lib/ui";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export function ClassroomView() {
  const { me } = useAppStore();
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [active, setActive] = useState<ClassroomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get<{ classrooms: ClassroomSummary[] }>("/api/lms/classrooms")
      .then((d) => setClassrooms(d.classrooms))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function openClassroom(id: string) {
    try {
      const d = await api.get<{ classroom: ClassroomDetail }>(`/api/classrooms/${id}`);
      setActive(d.classroom);
    } catch {
      toast.error("Failed to load classroom");
    }
  }

  async function createClassroom() {
    if (!createForm.name.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/classrooms", { name: createForm.name, description: createForm.description });
      toast.success("Classroom created");
      setCreateOpen(false);
      setCreateForm({ name: "", description: "" });
      load();
    } catch (err) {
      toast.error((err as Error).message || "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const d = await api.get<{ classroom: { id: string; name: string; alreadyMember: boolean } }>(`/api/classrooms/by-code?code=${joinCode.toUpperCase()}`);
      if (d.classroom.alreadyMember) {
        toast.info("You're already a member");
        openClassroom(d.classroom.id);
      } else {
        await api.post(`/api/classrooms/${d.classroom.id}/join`, { code: joinCode.toUpperCase() });
        toast.success(`Joined "${d.classroom.name}"`);
        load();
      }
      setJoinOpen(false);
      setJoinCode("");
    } catch (err) {
      toast.error((err as Error).message || "Classroom not found");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState message="Loading classrooms…" />;

  if (active) return <ClassroomDetail classroom={active} onBack={() => { setActive(null); load(); }} />;

  return (
    <div className="max-w-7xl mx-auto fade-in">
      <PageHeader
        title="Classroom"
        description="Cohort learning with announcements and assignments."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setJoinOpen(true)}>
              <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Join
            </Button>
            {me?.user.role !== "STUDENT" && (
              <Button size="sm" className="bg-gradient-to-r from-primary to-primary text-white" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create
              </Button>
            )}
          </div>
        }
      />

      {classrooms.length === 0 ? (
        <EmptyState
          icon={School}
          title="No classrooms yet"
          description="Join a classroom with an invite code, or create one if you're a teacher."
          action={
            <Button onClick={() => setJoinOpen(true)} className="bg-gradient-to-r from-primary to-primary text-white">
              <KeyRound className="w-4 h-4 mr-1.5" /> Join with code
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {classrooms.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-4 cursor-pointer hover:shadow-elevated transition-shadow group" onClick={() => openClassroom(c.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary flex items-center justify-center">
                    <School className="w-5 h-5 text-white" />
                  </div>
                  <Badge variant={c.role === "teacher" ? "default" : "secondary"} className="capitalize text-[10px]">{c.role}</Badge>
                </div>
                <h3 className="font-semibold text-sm leading-tight">{c.name}</h3>
                {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {c.memberCount}</span>
                  <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3" /> {c.courseCount}</span>
                  <span className="flex items-center gap-0.5"><ClipboardList className="w-3 h-3" /> {c.assignmentCount}</span>
                  <span className="ml-auto font-mono">{c.code}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create classroom</DialogTitle>
            <DialogDescription>Students can join with the generated code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Intro to ML 2026" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="What's this class about?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createClassroom} disabled={busy} className="bg-gradient-to-r from-primary to-primary text-white">
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a classroom</DialogTitle>
            <DialogDescription>Enter the invite code provided by your teacher.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Class code</Label>
            <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="e.g. AI2025" className="font-mono uppercase" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button onClick={joinByCode} disabled={busy} className="bg-gradient-to-r from-primary to-primary text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />} Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClassroomDetail({ classroom, onBack }: { classroom: ClassroomDetail; onBack: () => void }) {
  const { me } = useAppStore();
  const isTeacher = classroom.role === "teacher";
  const [annOpen, setAnnOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [annForm, setAnnForm] = useState({ title: "", body: "" });
  const [assignForm, setAssignForm] = useState({ title: "", description: "", dueDate: "", maxScore: 100 });
  const [submitFor, setSubmitFor] = useState<string | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(classroom);

  async function postAnnouncement() {
    setBusy(true);
    try {
      await api.post(`/api/classrooms/${classroom.id}/announcements`, annForm);
      toast.success("Posted");
      setAnnOpen(false);
      setAnnForm({ title: "", body: "" });
      const d = await api.get<{ classroom: ClassroomDetail }>(`/api/classrooms/${classroom.id}`);
      setLocal(d.classroom);
    } catch {
      toast.error("Failed to post");
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment() {
    setBusy(true);
    try {
      await api.post(`/api/classrooms/${classroom.id}/assignments`, {
        title: assignForm.title,
        description: assignForm.description,
        dueDate: new Date(assignForm.dueDate).toISOString(),
        maxScore: Number(assignForm.maxScore),
      });
      toast.success("Assignment created");
      setAssignOpen(false);
      setAssignForm({ title: "", description: "", dueDate: "", maxScore: 100 });
      const d = await api.get<{ classroom: ClassroomDetail }>(`/api/classrooms/${classroom.id}`);
      setLocal(d.classroom);
    } catch {
      toast.error("Failed to create");
    } finally {
      setBusy(false);
    }
  }

  async function submitAssignment(assignmentId: string) {
    setBusy(true);
    try {
      await api.post(`/api/assignments/${assignmentId}/submit`, { content: submitText });
      toast.success("Submitted!");
      setSubmitFor(null);
      setSubmitText("");
      const d = await api.get<{ classroom: ClassroomDetail }>(`/api/classrooms/${classroom.id}`);
      setLocal(d.classroom);
    } catch {
      toast.error("Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 text-xs">
        <Calendar className="w-3.5 h-3.5 mr-1" /> Back to classrooms
      </Button>

      <Card className="p-5 mb-4 bg-gradient-to-br from-primary to-primary text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <Badge className="bg-white/20 text-white hover:bg-white/20 border-white/20 mb-2 capitalize text-[10px]">{local.role}</Badge>
            <h1 className="text-2xl font-bold">{local.name}</h1>
            {local.description && <p className="text-white/70 text-sm mt-1">{local.description}</p>}
            <p className="text-xs text-white/60 mt-2">Code: <code className="font-mono bg-white/15 px-1.5 py-0.5 rounded">{local.code}</code> · {local.owner.name}</p>
          </div>
          <div className="flex gap-3 text-center">
            <div><p className="text-xl font-bold">{local.members.length}</p><p className="text-[10px] text-white/70">Members</p></div>
            <div><p className="text-xl font-bold">{local.courses.length}</p><p className="text-[10px] text-white/70">Courses</p></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Assignments */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Assignments</h3>
            {isTeacher && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAssignOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {local.assignments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No assignments yet.</p>
            ) : (
              local.assignments.map((a) => (
                <div key={a.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Due {new Date(a.dueDate).toLocaleDateString()} · /{a.maxScore} pts</p>
                    </div>
                    {!isTeacher && (
                      a.mySubmission ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] gap-0.5">
                          <Check className="w-2.5 h-2.5" />
                          {a.mySubmission.score !== null ? `Graded: ${a.mySubmission.score}` : "Submitted"}
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSubmitFor(a.id)}>Submit</Button>
                      )
                    )}
                  </div>
                  {a.mySubmission?.feedback && (
                    <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t italic">Feedback: {a.mySubmission.feedback}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Announcements */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Announcements</h3>
            {isTeacher && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAnnOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> Post
              </Button>
            )}
          </div>
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto scrollbar-thin">
            {local.announcements.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No announcements yet.</p>
            ) : (
              local.announcements.map((a) => (
                <div key={a.id} className="border-l-2 border-primary/40 pl-3 py-0.5">
                  <p className="text-xs font-medium">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{a.body}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">{a.author.name} · {relativeTime(a.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Members */}
      <Card className="p-5 mt-3">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Members ({local.members.length})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {local.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg border">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary text-white text-[9px]">
                  {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{m.name}{m.id === me?.user.id && " · you"}</p>
                <p className="text-[9px] text-muted-foreground capitalize">{m.memberRole} · Lvl {m.level}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Announcement dialog */}
      <Dialog open={annOpen} onOpenChange={setAnnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Post announcement</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Body</Label><Textarea rows={4} value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnOpen(false)}>Cancel</Button>
            <Button onClick={postAnnouncement} disabled={busy} className="bg-gradient-to-r from-primary to-primary text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create assignment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea rows={3} value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Due date</Label><Input type="date" value={assignForm.dueDate} onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Max score</Label><Input type="number" value={assignForm.maxScore} onChange={(e) => setAssignForm({ ...assignForm, maxScore: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={createAssignment} disabled={busy} className="bg-gradient-to-r from-primary to-primary text-white">
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit assignment dialog */}
      <Dialog open={!!submitFor} onOpenChange={(o) => !o && setSubmitFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit assignment</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Your submission</Label>
            <Textarea rows={6} value={submitText} onChange={(e) => setSubmitText(e.target.value)} placeholder="Write your answer here…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitFor(null)}>Cancel</Button>
            <Button onClick={() => submitFor && submitAssignment(submitFor)} disabled={busy || !submitText.trim()} className="bg-gradient-to-r from-primary to-primary text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
