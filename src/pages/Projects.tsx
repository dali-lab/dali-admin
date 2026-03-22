import { useEffect, useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { getProjects, patchProject } from "@/lib/api";
import type { Project } from "@/lib/api";
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
  isPublic: boolean;
  status: string;
  description: string;
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
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  function openDetail(p: Project) {
    setSelectedId(p.id);
    setDetail(p);
    setEditing(false);
    setSaveError(null);
    setEditState({
      isPublic: p.isPublic,
      status: p.status,
      description: p.description ?? "",
    });
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setEditing(false);
    setEditState(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!selectedId || !editState) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchProject(selectedId, {
        isPublic: editState.isPublic,
        status: editState.status,
        description: editState.description,
      });
      setDetail(prev => prev ? { ...prev, ...updated } : prev);
      setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, ...updated } : p));
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-6 py-5 border-b border-gray-200 bg-white">
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
                    <span className="flex items-center">Public <SortIcon col="isPublic" /></span>
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
          <ResizablePanel defaultWidth={400}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900 text-sm">Project Details</h2>
              <button
                onClick={closeDetail}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 space-y-5">
              {/* Cover */}
              {detail.coverImage && (
                <img
                  src={detail.coverImage}
                  alt=""
                  className="w-full h-32 object-cover rounded-lg"
                />
              )}

              {/* Name + status */}
              <div>
                <h3 className="font-semibold text-gray-900 text-base">{detail.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={STATUS_VARIANTS[detail.status] ?? "secondary"}>
                    {detail.status}
                  </Badge>
                  {detail.term && <Badge variant="secondary">{detail.term}</Badge>}
                </div>
              </div>

              {/* Tags */}
              {detail.tags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.tags.map((t, i) => (
                      <Badge key={i} variant="outline">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Team — grouped by term, collapsible */}
              {detail.teamsByTerm && detail.teamsByTerm.length > 0 ? (
                <TeamByTermSection teamsByTerm={detail.teamsByTerm} currentTerm={currentTerm} />
              ) : detail.teamMembers?.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Team ({detail.teamMembers.length})
                  </p>
                  <div className="space-y-1">
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
                    {detail.partnerNames.map((n, i) => (
                      <Badge key={i} variant="secondary">{n}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Edit section */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Edit</p>
                  {!editing ? (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(false);
                          setSaveError(null);
                          setEditState({
                            isPublic: detail.isPublic,
                            status: detail.status,
                            description: detail.description ?? "",
                          });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Save
                      </Button>
                    </div>
                  )}
                </div>

                {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}

                {editState && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Public</Label>
                      <Switch
                        checked={editState.isPublic}
                        onCheckedChange={v => editing && setEditState(s => s ? { ...s, isPublic: v } : s)}
                        disabled={!editing}
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
                  </div>
                )}
              </div>

              {/* Project URLs */}
              {detail.projectUrls?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Links</p>
                  <div className="space-y-1">
                    {detail.projectUrls.map((u, i) => (
                      <a
                        key={i}
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-[#00C795] hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {u.label || u.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
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
