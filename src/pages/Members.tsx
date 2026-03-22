import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw,
  X,
  ExternalLink,
  Pencil,
  Check,
  Loader2,
  Search,
} from "lucide-react";
import { getMembers, getMember, patchMember, createMember, addHiredRole, updateHiredRole, deleteHiredRole, getTerms } from "@/lib/api";
import type { Member, HiredRole, Term } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type SortKey = "name" | "role" | "classYear" | "joinedTerm" | "isActive" | "isAlum";
type SortDir = "asc" | "desc";

function roleBadgeVariant(role: string) {
  const r = role.toLowerCase();
  if (r.includes("fullstack") || r.includes("dev") || r.includes("stack")) return "blue" as const;
  if (r.includes("design") || r.includes("ui") || r.includes("ux")) return "purple" as const;
  if (r.includes("data")) return "orange" as const;
  if (r.includes("pm") || r.includes("product")) return "pink" as const;
  if (r.includes("engine") || r.includes("ar") || r.includes("vr")) return "cyan" as const;
  if (r.includes("video")) return "red" as const;
  return "default" as const;
}

function MemberAvatar({ imageUrl, name, email, size = "sm" }: { imageUrl: string | null; name: string | null; email: string | null; size?: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? email ?? "?")[0]?.toUpperCase();
  const dim = size === "lg" ? "w-12 h-12" : "w-7 h-7";
  const text = size === "lg" ? "text-lg" : "text-xs";

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${dim} rounded-full object-cover shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gray-200 flex items-center justify-center shrink-0`}>
      <span className={`${text} text-gray-500 font-medium`}>{initial}</span>
    </div>
  );
}

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          {[40, 24, 16, 16, 12, 12, 12].map((w, j) => (
            <TableCell key={j}>
              <div
                className={`h-4 bg-gray-200 rounded animate-pulse`}
                style={{ width: `${w * (0.7 + Math.random() * 0.6)}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

interface EditState {
  isActive: boolean;
  isAlum: boolean;
  classYear: string;
  major: string;
  minor: string;
  linkedinUrl: string;
}

export default function Members() {

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentTerm } = useTermContext();

  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "this-term">("this-term");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Slide-over
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Member | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Create member dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState({
    fullName: "", dartmouthEmail: "", daliEmail: "", joinedTermName: "",
    classYear: "", major: "", minor: "", linkedinUrl: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof getMembers>[0] = { limit: 200 };
      if (filterRole !== "all") params.role = filterRole;
      if (filterActive === "active" || filterActive === "this-term") params.active = true;
      const data = await getMembers(params);
      setMembers(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterActive, currentTerm]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Derive unique roles from data
  const allRoles = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      m.hiredRoles?.forEach(r => r.role && set.add(r.role));
    });
    return Array.from(set).sort();
  }, [members]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...members];
    if (filterActive === "this-term") list = list.filter(m => m.isActive && !m.isAlum && m.termsInDali.some(t => t.name === currentTerm));
    if (filterActive === "active") list = list.filter(m => m.isActive && !m.isAlum);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      list = list.filter(m =>
        (m.fullName ?? "").toLowerCase().includes(q) ||
        (m.daliEmail ?? "").toLowerCase().includes(q) ||
        (m.major ?? "").toLowerCase().includes(q) ||
        (m.classYear ?? "").toLowerCase().includes(q) ||
        m.hiredRoles?.some(r => r.role.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let av: string | boolean | number = "";
      let bv: string | boolean | number = "";
      switch (sortKey) {
        case "name":
          av = (a.fullName ?? a.daliEmail ?? "").toLowerCase();
          bv = (b.fullName ?? b.daliEmail ?? "").toLowerCase();
          break;
        case "role":
          av = (a.hiredRoles?.[0]?.role ?? "").toLowerCase();
          bv = (b.hiredRoles?.[0]?.role ?? "").toLowerCase();
          break;
        case "classYear":
          av = a.classYear ?? "";
          bv = b.classYear ?? "";
          break;
        case "joinedTerm":
          av = a.joinedTerm?.name ?? "";
          bv = b.joinedTerm?.name ?? "";
          break;
        case "isActive":
          av = a.isActive ? 1 : 0;
          bv = b.isActive ? 1 : 0;
          break;
        case "isAlum":
          av = a.isAlum ? 1 : 0;
          bv = b.isAlum ? 1 : 0;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [members, filterActive, filterSearch, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1 text-[#00C795]" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1 text-[#00C795]" />
    );
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    setEditing(false);
    setEditState(null);
    setSaveError(null);
    setDetailLoading(true);
    try {
      const m = await getMember(id);
      setDetail(m);
      setEditState({
        isActive: m.isActive,
        isAlum: m.isAlum,
        classYear: m.classYear ?? "",
        major: m.major ?? "",
        minor: m.minor ?? "",
        linkedinUrl: m.linkedinUrl ?? "",
      });
    } catch {
      // Fall back to list data
      const found = members.find(x => x.id === id) ?? null;
      setDetail(found);
      if (found) {
        setEditState({
          isActive: found.isActive,
          isAlum: found.isAlum,
          classYear: found.classYear ?? "",
          major: found.major ?? "",
          minor: found.minor ?? "",
          linkedinUrl: found.linkedinUrl ?? "",
        });
      }
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
  }

  async function handleSave() {
    if (!selectedId || !editState) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchMember(selectedId, {
        isActive: editState.isActive,
        isAlum: editState.isAlum,
        classYear: editState.classYear || undefined,
        major: editState.major || undefined,
        minor: editState.minor || undefined,
        linkedinUrl: editState.linkedinUrl || undefined,
      });
      setDetail(updated);
      setMembers(prev =>
        prev.map(m => (m.id === selectedId ? { ...m, ...updated } : m))
      );
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!createState.dartmouthEmail.trim() || !createState.daliEmail.trim() || !createState.joinedTermName) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createMember({
        dartmouthEmail: createState.dartmouthEmail.trim(),
        daliEmail: createState.daliEmail.trim(),
        joinedTermName: createState.joinedTermName,
        fullName: createState.fullName.trim() || undefined,
        classYear: createState.classYear.trim() || undefined,
        major: createState.major.trim() || undefined,
        minor: createState.minor.trim() || undefined,
        linkedinUrl: createState.linkedinUrl.trim() || undefined,
      });
      setMembers(prev => [created, ...prev]);
      setCreateOpen(false);
      setCreateState({ fullName: "", dartmouthEmail: "", daliEmail: "", joinedTermName: "", classYear: "", major: "", minor: "", linkedinUrl: "" });
    } catch (e: any) {
      setCreateError(e.message ?? "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Members</h1>
            <button onClick={fetchMembers} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${filtered.length} members`}
          </p>
        </div>
        <Button size="sm" onClick={() => {
          setCreateOpen(true);
          setCreateError(null);
          getTerms().then(setTerms).catch(() => {});
        }}>
          + New Member
        </Button>
      </div>

      {/* Create member dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input
                placeholder="Jane Smith"
                value={createState.fullName}
                onChange={e => setCreateState(s => ({ ...s, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Dartmouth Email <span className="text-red-500">*</span></Label>
              <Input
                placeholder="jane.smith@dartmouth.edu"
                value={createState.dartmouthEmail}
                onChange={e => setCreateState(s => ({ ...s, dartmouthEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>DALI Email <span className="text-red-500">*</span></Label>
              <Input
                placeholder="jane.smith@dali.dartmouth.edu"
                value={createState.daliEmail}
                onChange={e => setCreateState(s => ({ ...s, daliEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Joined Term <span className="text-red-500">*</span></Label>
              <Select
                value={createState.joinedTermName}
                onValueChange={v => setCreateState(s => ({ ...s, joinedTermName: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term…" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map(t => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Class Year</Label>
              <Input
                placeholder="2027"
                value={createState.classYear}
                onChange={e => setCreateState(s => ({ ...s, classYear: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Major</Label>
              <Input
                placeholder="Computer Science"
                value={createState.major}
                onChange={e => setCreateState(s => ({ ...s, major: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Minor</Label>
              <Input
                placeholder="Mathematics"
                value={createState.minor}
                onChange={e => setCreateState(s => ({ ...s, minor: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>LinkedIn URL</Label>
              <Input
                placeholder="https://linkedin.com/in/…"
                value={createState.linkedinUrl}
                onChange={e => setCreateState(s => ({ ...s, linkedinUrl: e.target.value }))}
              />
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createState.dartmouthEmail.trim() || !createState.daliEmail.trim() || !createState.joinedTermName}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="w-52 h-8 pl-7 text-sm"
            placeholder="Search name, email, role…"
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

        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {allRoles.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {(["this-term", "active", "all"] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilterActive(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                filterActive === v
                  ? "bg-[#00C795] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {v === "this-term" ? "This Term" : v === "active" ? "Active" : "All"}
            </button>
          ))}
        </div>

        {(filterRole !== "all" || filterActive !== "this-term") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterRole("all");
              setFilterActive("this-term");
            }}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Table + slide-over layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className={cn("flex-1 overflow-auto", selectedId && "lg:border-r lg:border-gray-200")}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-red-600 font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchMembers}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    <span className="flex items-center">Name <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("role")}
                  >
                    <span className="flex items-center">Role(s) <SortIcon col="role" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("classYear")}
                  >
                    <span className="flex items-center">Class Year <SortIcon col="classYear" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("joinedTerm")}
                  >
                    <span className="flex items-center">Joined <SortIcon col="joinedTerm" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("isActive")}
                  >
                    <span className="flex items-center">Active <SortIcon col="isActive" /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("isAlum")}
                  >
                    <span className="flex items-center">Alum <SortIcon col="isAlum" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows count={10} />
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                      No members found. Try adjusting filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(m => (
                    <TableRow
                      key={m.id}
                      className={cn(
                        "cursor-pointer",
                        selectedId === m.id && "bg-[#E6FFF9]"
                      )}
                      onClick={() => openDetail(m.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar imageUrl={m.imageUrl} name={m.fullName} email={m.daliEmail} />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {m.fullName ?? "—"}
                            </p>
                            {m.daliEmail && (
                              <p className="text-xs text-gray-400">{m.daliEmail}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.hiredRoles?.slice(0, 2).map((r, i) => (
                            <Badge key={i} variant={roleBadgeVariant(r.role)}>
                              {r.role}
                            </Badge>
                          ))}
                          {(m.hiredRoles?.length ?? 0) > 2 && (
                            <Badge variant="secondary">+{(m.hiredRoles?.length ?? 0) - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{m.classYear ?? "—"}</TableCell>
                      <TableCell className="text-sm text-gray-700">{m.joinedTerm?.name ?? "—"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            m.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {m.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            m.isAlum
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {m.isAlum ? "Alum" : "Current"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Slide-over panel */}
        {selectedId && (
          <ResizablePanel defaultWidth={380}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900 text-sm">Member Details</h2>
              <button
                onClick={closeDetail}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-5 w-5 animate-spin text-[#00C795]" />
              </div>
            ) : detail ? (
              <div className="flex-1 px-5 py-4 space-y-5">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <MemberAvatar imageUrl={detail.imageUrl} name={detail.fullName} email={detail.daliEmail} size="lg" />
                  <div>
                    <p className="font-semibold text-gray-900">{detail.fullName ?? "—"}</p>
                    <p className="text-sm text-gray-500">{detail.daliEmail ?? "—"}</p>
                  </div>
                </div>

                {/* Roles */}
                <RolesEditor
                  memberId={detail.id}
                  hiredRoles={detail.hiredRoles ?? []}
                  onRolesChange={(roles: HiredRole[]) => setDetail(d => d ? { ...d, hiredRoles: roles } : d)}
                />

                {/* Terms */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Terms in DALI</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.termsInDali?.map((t, i) => (
                      <Badge key={i} variant="secondary">{t.name}</Badge>
                    ))}
                    {(!detail.termsInDali?.length) && <span className="text-sm text-gray-400">—</span>}
                  </div>
                </div>

                {/* Editable fields */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Edit</p>
                    {!editing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(true)}
                      >
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
                            if (detail) {
                              setEditState({
                                isActive: detail.isActive,
                                isAlum: detail.isAlum,
                                classYear: detail.classYear ?? "",
                                major: detail.major ?? "",
                                minor: detail.minor ?? "",
                                linkedinUrl: detail.linkedinUrl ?? "",
                              });
                            }
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

                  {saveError && (
                    <p className="text-xs text-red-600 mb-3">{saveError}</p>
                  )}

                  {editState && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Active</Label>
                        <Switch
                          checked={editState.isActive}
                          onCheckedChange={v =>
                            editing && setEditState(s => s ? { ...s, isActive: v } : s)
                          }
                          disabled={!editing}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Alum</Label>
                        <Switch
                          checked={editState.isAlum}
                          onCheckedChange={v =>
                            editing && setEditState(s => s ? { ...s, isAlum: v } : s)
                          }
                          disabled={!editing}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Class Year</Label>
                        <Input
                          value={editState.classYear}
                          onChange={e =>
                            setEditState(s => s ? { ...s, classYear: e.target.value } : s)
                          }
                          disabled={!editing}
                          placeholder="e.g. 2026"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Major</Label>
                        <Input
                          value={editState.major}
                          onChange={e =>
                            setEditState(s => s ? { ...s, major: e.target.value } : s)
                          }
                          disabled={!editing}
                          placeholder="Major"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Minor</Label>
                        <Input
                          value={editState.minor}
                          onChange={e =>
                            setEditState(s => s ? { ...s, minor: e.target.value } : s)
                          }
                          disabled={!editing}
                          placeholder="Minor"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>LinkedIn URL</Label>
                        <Input
                          value={editState.linkedinUrl}
                          onChange={e =>
                            setEditState(s => s ? { ...s, linkedinUrl: e.target.value } : s)
                          }
                          disabled={!editing}
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Links */}
                {detail.linkedinUrl && (
                  <div className="border-t border-gray-100 pt-4">
                    <a
                      href={detail.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#00C795] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      LinkedIn
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Could not load member details.
              </div>
            )}
          </ResizablePanel>
        )}
      </div>
    </div>
  );
}

const ALL_ROLES = ["FULLSTACK", "DATA", "ENGINES", "AR_VR", "UI_UX", "VIDEO", "INSTRUCTOR", "PM"] as const;
const ALL_LEVELS = ["P1", "P2", "P3", "C", "L"] as const;

function RolesEditor({
  memberId,
  hiredRoles,
  onRolesChange,
}: {
  memberId: string;
  hiredRoles: HiredRole[];
  onRolesChange: (roles: HiredRole[]) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null); // roleId or "new"
  const [error, setSaveError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>(ALL_ROLES[0]);
  const [newLevel, setNewLevel] = useState<string>(ALL_LEVELS[0]);

  const existingRoles = new Set(hiredRoles.map(r => r.role));

  async function handleLevelChange(r: HiredRole, level: string) {
    if (!r.id) return;
    setSaving(r.id);
    setSaveError(null);
    try {
      const updated = await updateHiredRole(memberId, r.id, level);
      onRolesChange(hiredRoles.map(x => x.id === r.id ? { ...x, ...updated } : x));
    } catch (e: any) {
      setSaveError(e.message ?? "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(r: HiredRole) {
    if (!r.id) return;
    setSaving(r.id);
    setSaveError(null);
    try {
      await deleteHiredRole(memberId, r.id);
      onRolesChange(hiredRoles.filter(x => x.id !== r.id));
    } catch (e: any) {
      setSaveError(e.message ?? "Delete failed");
    } finally {
      setSaving(null);
    }
  }

  async function handleAdd() {
    setSaving("new");
    setSaveError(null);
    try {
      const created = await addHiredRole(memberId, newRole, newLevel);
      onRolesChange([...hiredRoles, created]);
      setAddOpen(false);
      setNewRole(ALL_ROLES[0]);
      setNewLevel(ALL_LEVELS[0]);
    } catch (e: any) {
      setSaveError(e.message ?? "Add failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Roles</p>
        <button
          onClick={() => setAddOpen(o => !o)}
          className="text-[10px] font-medium text-[#00C795] hover:underline"
        >
          {addOpen ? "Cancel" : "+ Add role"}
        </button>
      </div>

      {/* Existing roles */}
      <div className="space-y-1.5">
        {hiredRoles.length === 0 && !addOpen && (
          <span className="text-sm text-gray-400">No roles</span>
        )}
        {hiredRoles.map(r => (
          <div key={r.id ?? r.role} className="flex items-center gap-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded shrink-0", {
              "bg-blue-100 text-blue-700": roleBadgeVariant(r.role) === "blue",
              "bg-purple-100 text-purple-700": roleBadgeVariant(r.role) === "purple",
              "bg-orange-100 text-orange-700": roleBadgeVariant(r.role) === "orange",
              "bg-pink-100 text-pink-700": roleBadgeVariant(r.role) === "pink",
              "bg-cyan-100 text-cyan-700": roleBadgeVariant(r.role) === "cyan",
              "bg-red-100 text-red-700": roleBadgeVariant(r.role) === "red",
              "bg-gray-100 text-gray-700": roleBadgeVariant(r.role) === "default",
            })}>
              {r.role}
            </span>
            <select
              value={r.level ?? ""}
              onChange={e => handleLevelChange(r, e.target.value)}
              disabled={saving === r.id}
              className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none focus:border-[#00C795] disabled:opacity-50"
            >
              {ALL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {saving === r.id
              ? <Loader2 className="h-3 w-3 animate-spin text-gray-400 shrink-0" />
              : <button onClick={() => handleDelete(r)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0"><X className="h-3 w-3" /></button>
            }
          </div>
        ))}
      </div>

      {/* Add role form */}
      {addOpen && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700 focus:outline-none focus:border-[#00C795]"
          >
            {ALL_ROLES.filter(r => !existingRoles.has(r)).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={newLevel}
            onChange={e => setNewLevel(e.target.value)}
            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700 focus:outline-none focus:border-[#00C795]"
          >
            {ALL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            onClick={handleAdd}
            disabled={saving === "new"}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#00C795] text-white hover:bg-[#00b085] disabled:opacity-50 transition-colors"
          >
            {saving === "new" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Add
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
