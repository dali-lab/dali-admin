import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw,
  X,
  Pencil,
  Check,
  Loader2,
  Globe,
  EyeOff,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { getProjects, getProject, patchProject, createProject, deleteProject, createRepo, deleteRepo } from "@/lib/api";
import type { Project, ProjectRepo } from "@/lib/api";
import { useTermContext } from "@/context/TermContext";
import ResizablePanel from "@/components/ResizablePanel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function compressImageToDataUrl(file: File, maxWidth = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

type SortKey = "name" | "status" | "term" | "teamSize" | "isPublic";
type SortDir = "asc" | "desc";

const STATUS_VARIANTS: Record<string, "success" | "blue" | "secondary" | "warning" | "destructive" | "outline"> = {
  ACTIVE: "success",
  SHIPPED: "blue",
  INACTIVE: "secondary",
  ON_HOLD: "warning",
  ACCEPTED: "success",
  IN_INTERVIEW: "warning",
  REJECTED: "destructive",
};

const PROJECT_STATUSES = ["ACCEPTED", "IN_INTERVIEW", "REJECTED", "ACTIVE", "SHIPPED", "INACTIVE", "ON_HOLD"];

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          {[35, 16, 14, 22, 10].map((w, j) => (
            <TableCell key={j}>
              <div
                className="h-4 bg-gray-200 rounded animate-pulse"
                style={{ width: `${w * (0.6 + Math.random() * 0.8)}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

interface EditState {
  name: string;
  isPublic: boolean;
  status: string;
  description: string;
  coverImage: string;
  publicNotionPageId: string;
  slackChannelId: string;
  githubTeamSlug: string;
  projectUrls: Array<{ label: string; url: string }>;
  repos: ProjectRepo[];
  sectors: string[];
  product: string[];
  techStack: string[];
  partnerNames: string[];
}

export default function Projects() {
  const { currentTerm, terms } = useTermContext();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to global current term; user can change locally
  const [filterTerm, setFilterTerm] = useState<string>(currentTerm || "all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectStatus, setNewProjectStatus] = useState("ACTIVE");
  const [newProjectTerm, setNewProjectTerm] = useState("");
  const [newProjectSaving, setNewProjectSaving] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  // Sync to global term on first load once it resolves
  useEffect(() => {
    if (currentTerm && filterTerm === "all") setFilterTerm(currentTerm);
  }, [currentTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof getProjects>[0] = {};
      if (filterTerm !== "all") params.term = filterTerm;
      if (filterStatus !== "all") params.status = filterStatus;
      const data = await getProjects(params);
      setProjects(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [filterTerm, filterStatus]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = useMemo(() => {
    let list = [...projects];
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.teamMembers?.some(n => n.toLowerCase().includes(q)) ||
        p.partnerNames?.some(n => n.toLowerCase().includes(q)) ||
        p.sectors?.some(s => s.toLowerCase().includes(q)) ||
        p.techStack?.some(s => s.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "status":
          av = a.status.toLowerCase();
          bv = b.status.toLowerCase();
          break;
        case "term":
          av = a.term ?? "";
          bv = b.term ?? "";
          break;
        case "teamSize":
          av = a.teamMembers?.length ?? 0;
          bv = b.teamMembers?.length ?? 0;
          break;
        case "isPublic":
          av = a.isPublic ? 1 : 0;
          bv = b.isPublic ? 1 : 0;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [projects, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1 text-[#00C795]" />
      : <ChevronDown className="h-3 w-3 ml-1 text-[#00C795]" />;
  }

  function makeEditState(p: Project): EditState {
    return {
      name: p.name,
      isPublic: p.isPublic,
      status: p.status,
      description: p.description ?? "",
      coverImage: p.coverImage ?? "",
      publicNotionPageId: p.publicNotionPageId ?? "",
      slackChannelId: p.slackChannelId ?? "",
      githubTeamSlug: p.githubTeamSlug ?? "",
      projectUrls: p.projectUrls ?? [],
      repos: p.repos ?? [],
      sectors: p.sectors ?? [],
      product: p.product ?? [],
      techStack: p.techStack ?? [],
      partnerNames: p.partnerNames ?? [],
    };
  }

  async function openDetail(p: Project) {
    setSelectedId(p.id);
    setDetail(p);
    setEditing(false);
    setSaveError(null);
    setEditState(makeEditState(p));
    setDetailLoading(true);
    try {
      const full = await getProject(p.id);
      setDetail(full);
      setEditState(makeEditState(full));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setEditing(false);
    setEditState(null);
    setSaveError(null);
    setConfirmDelete(false);
  }

  async function handleDelete() {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await deleteProject(selectedId);
      setProjects(prev => prev.filter(p => p.id !== selectedId));
      closeDetail();
    } catch (e: any) {
      setSaveError(e.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!selectedId || !editState || !detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Sync repos: delete removed, create added
      const originalRepos = detail.repos ?? [];
      const removedRepos = originalRepos.filter(r => !editState.repos.some(er => er.id === r.id));
      const addedRepos = editState.repos.filter(r => !r.id);
      await Promise.all(removedRepos.map(r => deleteRepo(selectedId, r.id)));
      const createdRepos = await Promise.all(addedRepos.map(r => createRepo(selectedId, { type: r.type, url: r.url })));

      const updated = await patchProject(selectedId, {
        name: editState.name,
        isPublic: editState.isPublic,
        status: editState.status,
        description: editState.description,
        coverImage: editState.coverImage || null,
        publicNotionPageId: editState.publicNotionPageId || null,
        slackChannelId: editState.slackChannelId || null,
        githubTeamSlug: editState.githubTeamSlug || null,
        projectUrls: editState.projectUrls,
      });

      const finalRepos = [...editState.repos.filter(r => r.id), ...createdRepos];
      const merged = { ...updated, repos: finalRepos };
      setDetail(prev => prev ? { ...prev, ...merged } : prev);
      setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, ...merged } : p));
      setEditState(s => s ? { ...s, repos: finalRepos } : s);
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setNewProjectSaving(true);
    setNewProjectError(null);
    try {
      const project = await createProject({
        name: newProjectName.trim(),
        status: newProjectStatus,
        term: newProjectTerm || undefined,
      });
      setProjects(prev => [project, ...prev]);
      setNewProjectOpen(false);
      setNewProjectName("");
      setNewProjectStatus("ACTIVE");
      setNewProjectTerm("");
      openDetail(project);
    } catch (e: any) {
      setNewProjectError(e.message ?? "Failed to create project");
    } finally {
      setNewProjectSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Project Modal */}
      {newProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[95vw] overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900 text-sm">New Project</p>
              <button onClick={() => setNewProjectOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="px-5 py-4 space-y-4">
              <div className="space-y-1">
                <Label>Project name</Label>
                <Input
                  autoFocus
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="My Project"
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={newProjectStatus} onValueChange={setNewProjectStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Term <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Select value={newProjectTerm} onValueChange={setNewProjectTerm}>
                  <SelectTrigger><SelectValue placeholder="No term" /></SelectTrigger>
                  <SelectContent>
                    {terms.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {newProjectError && <p className="text-xs text-red-600">{newProjectError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setNewProjectOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!newProjectName.trim() || newProjectSaving}>
                  {newProjectSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
            <button onClick={fetchProjects} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${filtered.length} projects`}
          </p>
        </div>
        <Button size="sm" onClick={() => setNewProjectOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="w-52 h-8 pl-7 text-sm"
            placeholder="Search name, team, tech…"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          {filterSearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setFilterSearch("")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PROJECT_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTerm} onValueChange={setFilterTerm}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All terms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All terms</SelectItem>
            {terms.map(t => (
              <SelectItem key={t.id} value={t.name}>
                <span className="flex items-center gap-1.5">
                  {t.name === currentTerm && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C795] shrink-0" />
                  )}
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterTerm !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterTerm("all"); setFilterStatus("all"); }}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className={cn("flex-1 overflow-auto", selectedId && "lg:border-r lg:border-gray-200")}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-red-600 font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchProjects}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                    <span className="flex items-center">Name <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    <span className="flex items-center">Status <SortIcon col="status" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("term")}>
                    <span className="flex items-center">Term <SortIcon col="term" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("teamSize")}>
                    <span className="flex items-center">Team <SortIcon col="teamSize" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("isPublic")}>
                    <span className="flex items-center">Published to Website <SortIcon col="isPublic" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows count={10} />
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                      No projects found. Try adjusting filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(p => (
                    <TableRow
                      key={p.id}
                      className={cn("cursor-pointer", selectedId === p.id && "bg-[#E6FFF9]")}
                      onClick={() => openDetail(p)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {p.coverImage ? (
                            <img
                              src={p.coverImage}
                              alt=""
                              className="w-8 h-8 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#00C795]/20 to-[#00C795]/5 flex items-center justify-center shrink-0">
                              <span className="text-xs text-[#00C795] font-bold">
                                {p.name[0]?.toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-gray-400 truncate max-w-[200px]">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{p.term || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-gray-500">
                            {p.teamMembers?.length ?? 0} members
                          </span>
                          {p.teamMembers?.slice(0, 2).map((name, i) => (
                            <span key={i} className="text-xs text-gray-700">{name}</span>
                          ))}
                          {(p.teamMembers?.length ?? 0) > 2 && (
                            <span className="text-xs text-gray-400">
                              +{(p.teamMembers?.length ?? 0) - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.isPublic ? (
                          <Globe className="h-4 w-4 text-[#00C795]" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-300" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Slide-over */}
        {selectedId && detail && (
          <ResizablePanel defaultWidth={420}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900 text-sm">Project Details</h2>
                {detailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
              </div>
              <button
                onClick={closeDetail}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Cover image preview */}
              {detail.coverImage ? (
                <img src={detail.coverImage} alt="" className="w-full h-36 object-cover rounded-lg" />
              ) : (
                <div className="w-full h-36 rounded-lg bg-gradient-to-br from-[#00C795]/10 to-[#00C795]/5 flex items-center justify-center">
                  <span className="text-4xl font-bold text-[#00C795]/30">{detail.name[0]?.toUpperCase()}</span>
                </div>
              )}

              {/* Name + badges */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  {editing && editState ? (
                    <Input
                      value={editState.name}
                      onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : s)}
                      className="font-semibold text-base"
                    />
                  ) : (
                    <h3 className="font-semibold text-gray-900 text-base leading-snug">{detail.name}</h3>
                  )}
                  {!editing ? (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="shrink-0">
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setSaveError(null); setEditState(makeEditState(detail)); }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Save
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <Badge variant={STATUS_VARIANTS[detail.status] ?? "secondary"}>{detail.status}</Badge>
                  {detail.isPublic && <Badge variant="success"><Globe className="h-3 w-3 mr-1" />Published</Badge>}
                  {detail.term && <Badge variant="secondary">{detail.term}</Badge>}
                </div>
              </div>

              {/* Description */}
              {detail.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detail.description}</p>
                </div>
              )}

              {/* Tech breakdown */}
              {(detail.sectors?.length > 0 || detail.product?.length > 0 || detail.techStack?.length > 0) && (
                <div className="space-y-2">
                  {detail.sectors?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Sectors</p>
                      <div className="flex flex-wrap gap-1">
                        {detail.sectors.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {detail.product?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Product</p>
                      <div className="flex flex-wrap gap-1">
                        {detail.product.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {detail.techStack?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Tech Stack</p>
                      <div className="flex flex-wrap gap-1">
                        {detail.techStack.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Team */}
              {detail.teamsByTerm && detail.teamsByTerm.length > 0 ? (
                <TeamByTermSection teamsByTerm={detail.teamsByTerm} currentTerm={currentTerm} />
              ) : detail.teamMembers?.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Team ({detail.teamMembers.length})
                  </p>
                  <div className="space-y-0.5">
                    {detail.teamMembers.map((name, i) => (
                      <p key={i} className="text-sm text-gray-700">{name}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Partners */}
              {detail.partnerNames?.length ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Partners</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.partnerNames.map((n, i) => <Badge key={i} variant="secondary">{n}</Badge>)}
                  </div>
                </div>
              ) : null}

              {/* Repos */}
              {detail.repos && detail.repos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Repos</p>
                  <div className="space-y-1">
                    {detail.repos.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-[#00C795] hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium text-gray-500 uppercase mr-0.5">{r.type}</span>
                        <span className="truncate">{r.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Project URLs */}
              {detail.projectUrls?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Links</p>
                  <div className="space-y-1">
                    {detail.projectUrls.map((u, i) => (
                      <a
                        key={i}
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-[#00C795] hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        {u.label || u.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit section */}
              <div className="border-t border-gray-100 pt-4">
                {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}
                <div className="flex justify-end mb-3">
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete project
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">Cancel</button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {editState && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Published to Website</Label>
                      <Switch
                        checked={editState.isPublic}
                        onCheckedChange={v => editing && setEditState(s => s ? { ...s, isPublic: v } : s)}
                        disabled={!editing}
                      />
                    </div>

                    {editState.isPublic && (
                      <div className="space-y-1">
                        <Label>Public Notion Page ID</Label>
                        <Input
                          value={editState.publicNotionPageId}
                          onChange={e => setEditState(s => s ? { ...s, publicNotionPageId: e.target.value } : s)}
                          disabled={!editing}
                          placeholder="Paste Notion page ID…"
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-gray-400">The Notion case study page shown on the website.</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label>Slack Channel Name</Label>
                      <Input
                        value={editState.slackChannelId}
                        onChange={e => setEditState(s => s ? { ...s, slackChannelId: e.target.value } : s)}
                        disabled={!editing}
                        placeholder="e.g. my-project"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-gray-400">Slack channel for this project (shared across terms).</p>
                    </div>

                    <div className="space-y-1">
                      <Label>GitHub Team Slug</Label>
                      <Input
                        value={editState.githubTeamSlug}
                        onChange={e => setEditState(s => s ? { ...s, githubTeamSlug: e.target.value } : s)}
                        disabled={!editing}
                        placeholder="e.g. my-project"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-gray-400">GitHub team slug in the DALI org (shared across terms).</p>
                    </div>

                    <div className="space-y-1">
                      <Label>Cover Image</Label>
                      {editState.coverImage && (
                        <img src={editState.coverImage} alt="" className="w-full h-24 object-cover rounded-md" />
                      )}
                      {editing && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setImageUploading(true);
                              try {
                                const dataUrl = await compressImageToDataUrl(file);
                                setEditState(s => s ? { ...s, coverImage: dataUrl } : s);
                              } finally {
                                setImageUploading(false);
                                e.target.value = "";
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={imageUploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {imageUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            {imageUploading ? "Processing…" : "Upload image"}
                          </Button>
                        </>
                      )}
                      <Input
                        value={editState.coverImage.startsWith("data:") ? "" : editState.coverImage}
                        onChange={e => setEditState(s => s ? { ...s, coverImage: e.target.value } : s)}
                        disabled={!editing}
                        placeholder="Or paste a URL…"
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select
                        value={editState.status}
                        onValueChange={v => editing && setEditState(s => s ? { ...s, status: v } : s)}
                        disabled={!editing}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Description</Label>
                      <textarea
                        value={editState.description}
                        onChange={e => setEditState(s => s ? { ...s, description: e.target.value } : s)}
                        disabled={!editing}
                        rows={4}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C795] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                        placeholder="Project description…"
                      />
                    </div>

                    {/* Repos */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Repos</Label>
                        {editing && (
                          <button
                            onClick={() => setEditState(s => s ? { ...s, repos: [...s.repos, { id: "", type: "FULLSTACK", url: "" }] } : s)}
                            className="text-[#00C795] hover:text-[#00A87A]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {editState.repos.length === 0 && <p className="text-xs text-gray-400">No repos.</p>}
                      {editState.repos.map((repo, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <Select
                            value={repo.type}
                            onValueChange={v => editing && setEditState(s => s ? { ...s, repos: s.repos.map((r, j) => j === i ? { ...r, type: v } : r) } : s)}
                            disabled={!editing}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["FULLSTACK","FRONTEND","BACKEND","DATA","AGENT","OTHER"].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={repo.url}
                            onChange={e => setEditState(s => s ? { ...s, repos: s.repos.map((r, j) => j === i ? { ...r, url: e.target.value } : r) } : s)}
                            disabled={!editing}
                            placeholder="https://github.com/…"
                            className="h-7 text-xs flex-1"
                          />
                          {editing && (
                            <button
                              onClick={() => setEditState(s => s ? { ...s, repos: s.repos.filter((_, j) => j !== i) } : s)}
                              className="text-gray-300 hover:text-red-400 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Project URLs */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Links</Label>
                        {editing && (
                          <button
                            onClick={() => setEditState(s => s ? { ...s, projectUrls: [...s.projectUrls, { label: "", url: "" }] } : s)}
                            className="text-[#00C795] hover:text-[#00A87A]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {editState.projectUrls.length === 0 && <p className="text-xs text-gray-400">No links.</p>}
                      {editState.projectUrls.map((u, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <Input
                            value={u.label}
                            onChange={e => setEditState(s => s ? { ...s, projectUrls: s.projectUrls.map((x, j) => j === i ? { ...x, label: e.target.value } : x) } : s)}
                            disabled={!editing}
                            placeholder="Label"
                            className="h-7 text-xs w-24"
                          />
                          <Input
                            value={u.url}
                            onChange={e => setEditState(s => s ? { ...s, projectUrls: s.projectUrls.map((x, j) => j === i ? { ...x, url: e.target.value } : x) } : s)}
                            disabled={!editing}
                            placeholder="https://…"
                            className="h-7 text-xs flex-1"
                          />
                          {editing && (
                            <button
                              onClick={() => setEditState(s => s ? { ...s, projectUrls: s.projectUrls.filter((_, j) => j !== i) } : s)}
                              className="text-gray-300 hover:text-red-400 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        )}
      </div>
    </div>
  );
}

function TeamByTermSection({
  teamsByTerm,
  currentTerm,
}: {
  teamsByTerm: Array<{ term: string; members: string[] }>;
  currentTerm: string;
}) {
  const [openTerms, setOpenTerms] = useState<Set<string>>(
    () => new Set(teamsByTerm.some(t => t.term === currentTerm) ? [currentTerm] : [teamsByTerm[teamsByTerm.length - 1]?.term ?? ""])
  );

  function toggle(term: string) {
    setOpenTerms(prev => {
      const next = new Set(prev);
      next.has(term) ? next.delete(term) : next.add(term);
      return next;
    });
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Team</p>
      <div className="space-y-1">
        {teamsByTerm.map(t => {
          const isOpen = openTerms.has(t.term);
          const isCurrent = t.term === currentTerm;
          return (
            <div key={t.term} className="rounded-md border border-gray-100 overflow-hidden">
              <button
                onClick={() => toggle(t.term)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#00C795] shrink-0" />}
                  {t.term}
                  <span className="font-normal text-gray-400">· {t.members.length}</span>
                </span>
                {isOpen
                  ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-3 py-2 space-y-0.5 bg-white">
                  {t.members.map((name, i) => (
                    <p key={i} className="text-sm text-gray-700">{name}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
