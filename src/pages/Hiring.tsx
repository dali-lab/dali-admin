import { useEffect, useState, useMemo } from "react";
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  X,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import { getApplications, patchApplicationStatus } from "@/lib/api";
import type { Application } from "@/lib/api";
import { useTermContext } from "@/context/TermContext";
import ResizablePanel from "@/components/ResizablePanel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const APPLICATION_STATUSES = ["PENDING", "UNDER_REVIEW", "ACCEPTED", "REJECTED"] as const;
type AppStatus = typeof APPLICATION_STATUSES[number];

const STATUS_ORDER: AppStatus[] = ["PENDING", "UNDER_REVIEW", "ACCEPTED", "REJECTED"];

const STATUS_LABEL: Record<AppStatus, string> = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<AppStatus, { col: string; badge: string; dot: string }> = {
  PENDING:      { col: "bg-gray-50 border-gray-200",    badge: "bg-gray-100 text-gray-600 border-gray-200",       dot: "bg-gray-400" },
  UNDER_REVIEW: { col: "bg-amber-50 border-amber-200",  badge: "bg-amber-100 text-amber-700 border-amber-200",    dot: "bg-amber-400" },
  ACCEPTED:     { col: "bg-green-50 border-green-200",  badge: "bg-green-100 text-green-700 border-green-200",    dot: "bg-green-500" },
  REJECTED:     { col: "bg-red-50 border-red-200",      badge: "bg-red-100 text-red-600 border-red-200",          dot: "bg-red-400" },
};

type SortKey = "name" | "email" | "roles" | "submittedAt";
type SortDir = "asc" | "desc";
type ViewMode = "kanban" | "table";

function applicantName(app: Application): string {
  const { firstName, lastName } = app.user;
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return app.user.dartmouthEmail;
}

function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          {[28, 24, 16, 14, 12].map((w, j) => (
            <TableCell key={j}>
              <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${w * (0.6 + Math.random() * 0.8)}%` }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function AppCard({
  app,
  selected,
  onClick,
}: {
  app: Application;
  selected: boolean;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[app.status as AppStatus];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        selected
          ? "border-[#00C795] bg-[#E6FFF9] shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      )}
    >
      <p className="text-sm font-medium text-gray-900 truncate">{applicantName(app)}</p>
      <p className="text-xs text-gray-500 truncate mt-0.5">{app.user.dartmouthEmail}</p>
      {app.rolesApplied.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {app.rolesApplied.slice(0, 3).map((r) => (
            <span key={r} className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", colors.badge)}>
              {r}
            </span>
          ))}
          {app.rolesApplied.length > 3 && (
            <span className="text-[10px] text-gray-400">+{app.rolesApplied.length - 3}</span>
          )}
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-2">
        {new Date(app.submittedAt).toLocaleDateString()}
      </p>
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  app,
  onClose,
  onUpdated,
}: {
  app: Application;
  onClose: () => void;
  onUpdated: (updated: Application) => void;
}) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState(app.status);
  const [notesDraft, setNotesDraft] = useState(app.reviewerNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset when app changes
  useEffect(() => {
    setStatusDraft(app.status);
    setNotesDraft(app.reviewerNotes ?? "");
    setEditingStatus(false);
    setSaveError(null);
  }, [app.id]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchApplicationStatus(app.id, {
        status: statusDraft,
        reviewerNotes: notesDraft || undefined,
      });
      onUpdated(updated);
      setEditingStatus(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const colors = STATUS_COLORS[app.status as AppStatus];

  return (
    <ResizablePanel defaultWidth={420}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm truncate">{applicantName(app)}</h2>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5 text-sm">
        {/* Status */}
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
          {editingStatus ? (
            <div className="flex items-center gap-2">
              <Select value={statusDraft} onValueChange={(v) => setStatusDraft(v as AppStatus)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingStatus(false)} disabled={saving}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", colors.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                {STATUS_LABEL[app.status as AppStatus]}
              </span>
              <button onClick={() => setEditingStatus(true)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Contact */}
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">Email</Label>
          <p className="text-gray-800">{app.user.dartmouthEmail}</p>
        </div>

        {/* Term */}
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">Term</Label>
          <p className="text-gray-800">{app.term.name}</p>
        </div>

        {/* Roles applied */}
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">Roles Applied</Label>
          {app.rolesApplied.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {app.rolesApplied.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-xs">None specified</p>
          )}
        </div>

        {/* Portfolio / Resume */}
        {(app.portfolioUrl || app.resumeUrl) && (
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Links</Label>
            <div className="space-y-1">
              {app.portfolioUrl && (
                <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-[#00C795] hover:underline truncate">
                  Portfolio
                </a>
              )}
              {app.resumeUrl && (
                <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-[#00C795] hover:underline truncate">
                  Resume
                </a>
              )}
            </div>
          </div>
        )}

        {/* Statement */}
        {app.statement && (
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Statement</Label>
            <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
              {app.statement}
            </p>
          </div>
        )}

        {/* Reviewer notes */}
        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">Reviewer Notes</Label>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Add internal notes..."
            rows={3}
            className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:border-[#00C795] bg-gray-50 text-gray-700 placeholder:text-gray-400"
          />
        </div>

        {saveError && <p className="text-xs text-red-500">{saveError}</p>}

        {(editingStatus || notesDraft !== (app.reviewerNotes ?? "")) && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00C795] hover:bg-[#00b085] text-white"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            Save Changes
          </Button>
        )}

        <div>
          <Label className="text-xs text-gray-500 mb-1.5 block">Submitted</Label>
          <p className="text-gray-600 text-xs">{new Date(app.submittedAt).toLocaleString()}</p>
        </div>
      </div>
    </ResizablePanel>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Hiring() {
  const { currentTerm } = useTermContext();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTerm, setFilterTerm] = useState<string>(currentTerm);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync term filter when global term changes
  useEffect(() => {
    setFilterTerm(currentTerm);
  }, [currentTerm]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplications({ term: filterTerm || undefined });
      setApplications(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterTerm]);

  function handleUpdated(updated: Application) {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  const selectedApp = applications.find((a) => a.id === selectedId) ?? null;

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...applications];

    if (filterStatus !== "all") {
      list = list.filter((a) => a.status === filterStatus);
    }

    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      list = list.filter((a) =>
        applicantName(a).toLowerCase().includes(q) ||
        a.user.dartmouthEmail.toLowerCase().includes(q) ||
        a.rolesApplied.some((r) => r.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "name") { av = applicantName(a); bv = applicantName(b); }
      else if (sortKey === "email") { av = a.user.dartmouthEmail; bv = b.user.dartmouthEmail; }
      else if (sortKey === "roles") { av = a.rolesApplied.join(","); bv = b.rolesApplied.join(","); }
      else if (sortKey === "submittedAt") { av = a.submittedAt; bv = b.submittedAt; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return list;
  }, [applications, filterStatus, filterSearch, sortKey, sortDir]);

  // Group by status for kanban
  const byStatus = useMemo(() => {
    const map: Record<AppStatus, Application[]> = {
      PENDING: [], UNDER_REVIEW: [], ACCEPTED: [], REJECTED: [],
    };
    for (const a of filtered) {
      const s = a.status as AppStatus;
      if (map[s]) map[s].push(a);
    }
    return map;
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3.5 w-3.5 text-[#00C795]" />
      : <ChevronDown className="h-3.5 w-3.5 text-[#00C795]" />;
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of applications) m[a.status] = (m[a.status] ?? 0) + 1;
    return m;
  }, [applications]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Applications</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? "Loading…" : `${applications.length} application${applications.length !== 1 ? "s" : ""} for ${filterTerm || "all terms"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              {(["kanban", "table"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    viewMode === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {v === "kanban" ? "Board" : "Table"}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search applicants..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              {APPLICATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {STATUS_LABEL[s]} {counts[s] != null ? `(${counts[s]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {viewMode === "kanban" ? (
            /* ── Kanban board ── */
            <div className="flex gap-4 p-6 h-full min-w-max">
              {STATUS_ORDER.map((status) => {
                const colors = STATUS_COLORS[status];
                const cards = byStatus[status];
                return (
                  <div key={status} className={cn("flex flex-col w-72 rounded-xl border", colors.col)}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-current border-opacity-20">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", colors.dot)} />
                        <span className="text-sm font-semibold text-gray-800">{STATUS_LABEL[status]}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">
                        {cards.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
                      {loading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="h-20 rounded-lg bg-white/60 animate-pulse" />
                        ))
                      ) : cards.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-8">No applications</p>
                      ) : (
                        cards.map((app) => (
                          <AppCard
                            key={app.id}
                            app={app}
                            selected={selectedId === app.id}
                            onClick={() => setSelectedId(selectedId === app.id ? null : app.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Table view ── */
            <div className="px-6 py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="flex items-center gap-1 text-xs font-semibold" onClick={() => toggleSort("name")}>
                        Name <SortIcon k="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 text-xs font-semibold" onClick={() => toggleSort("email")}>
                        Email <SortIcon k="email" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 text-xs font-semibold" onClick={() => toggleSort("roles")}>
                        Roles <SortIcon k="roles" />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 text-xs font-semibold" onClick={() => toggleSort("submittedAt")}>
                        Submitted <SortIcon k="submittedAt" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <SkeletonRows />
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 text-sm py-12">
                        No applications found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((app) => {
                      const colors = STATUS_COLORS[app.status as AppStatus];
                      return (
                        <TableRow
                          key={app.id}
                          className={cn("cursor-pointer transition-colors", selectedId === app.id ? "bg-[#E6FFF9]" : "hover:bg-gray-50")}
                          onClick={() => setSelectedId(selectedId === app.id ? null : app.id)}
                        >
                          <TableCell className="font-medium text-sm">{applicantName(app)}</TableCell>
                          <TableCell className="text-xs text-gray-600">{app.user.dartmouthEmail}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {app.rolesApplied.slice(0, 2).map((r) => (
                                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{r}</span>
                              ))}
                              {app.rolesApplied.length > 2 && (
                                <span className="text-[10px] text-gray-400">+{app.rolesApplied.length - 2}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border", colors.badge)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                              {STATUS_LABEL[app.status as AppStatus]}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(app.submittedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedApp && (
        <DetailPanel
          app={selectedApp}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
