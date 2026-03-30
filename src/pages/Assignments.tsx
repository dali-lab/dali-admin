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
  Clock,
  Search,
  Trash2,
} from "lucide-react";
import { getBids, patchBid, createBid, deleteBid, getProjects, getMembers } from "@/lib/api";
import type { Bid, Project, Member } from "@/lib/api";
import BidAssignBoard from "@/components/BidAssignBoard";
import ResizablePanel from "@/components/ResizablePanel";
import { useTermContext } from "@/context/TermContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SortKey = "memberName" | "term" | "pref1" | "pref2" | "pref3" | "assignedProject" | "role" | "hours" | "preference";
type SortDir = "asc" | "desc";
type AssignedFilter = "all" | "assigned" | "unassigned";

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          {[22, 10, 22, 22, 14, 8, 8].map((w, j) => (
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
  assignedProjectId: string;
  assignedRole: string;
}

type TabKey = "table" | "assign";

export default function Bids() {
  const { currentTerm, terms, setCurrentTerm } = useTermContext();

  const [bids, setBids] = useState<Bid[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("assign");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);

  const [filterTerm, setFilterTermLocal] = useState<string>(currentTerm);
  const [filterAssigned, setFilterAssigned] = useState<AssignedFilter>("all");
  const [filterSearch, setFilterSearch] = useState<string>("");

  const [sortKey, setSortKey] = useState<SortKey>("memberName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Bid | null>(null);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create bid dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [createState, setCreateState] = useState({ memberId: "", termId: "", rolePref1: "", hoursPerWeek: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Member combobox state
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);

  // Sync local filter when global current term changes (e.g. on first load)
  useEffect(() => {
    if (currentTerm && filterTerm !== currentTerm) {
      setFilterTermLocal(currentTerm);
    }
  }, [currentTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  function setFilterTerm(name: string) {
    setFilterTermLocal(name);
    setCurrentTerm(name);
  }

  // Default assign tab to "assigned" filter
  useEffect(() => {
    if (activeTab === "assign") setFilterAssigned("assigned");
    else setFilterAssigned("all");
  }, [activeTab]);

  const fetchBids = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIs404(false);
    try {
      const params: Parameters<typeof getBids>[0] = {};
      if (filterTerm) params.term = filterTerm;
      const data = await getBids(params);
      setBids(data);
    } catch (e: any) {
      if (e.message?.includes("404") || e.message?.includes("not found") || e.message?.toLowerCase().includes("cannot get")) {
        setIs404(true);
        setBids([]);
      } else {
        setError(e.message ?? "Failed to load bids");
      }
    } finally {
      setLoading(false);
    }
  }, [filterTerm]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  useEffect(() => {
    getProjects({ term: filterTerm || undefined }).then(setProjects).catch(() => {});
  }, [filterTerm]);

  useEffect(() => {
    if (createOpen) {
      getMembers().then(setMembers).catch(() => {});
    }
  }, [createOpen]);

  const filtered = useMemo(() => {
    let list = [...bids];
    if (filterAssigned === "assigned") list = list.filter(b => b.assignedProjectId);
    if (filterAssigned === "unassigned") list = list.filter(b => !b.assignedProjectId);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      list = list.filter(b =>
        (b.member?.fullName ?? "").toLowerCase().includes(q) ||
        (b.member?.daliEmail ?? "").toLowerCase().includes(q) ||
        (b.projectPref1?.name ?? "").toLowerCase().includes(q) ||
        (b.projectPref2?.name ?? "").toLowerCase().includes(q) ||
        (b.projectPref3?.name ?? "").toLowerCase().includes(q) ||
        (b.assignedProject?.name ?? "").toLowerCase().includes(q) ||
        (b.assignedRole ?? "").toLowerCase().includes(q) ||
        (b.rolePref1 ?? "").toLowerCase().includes(q) ||
        (b.rolePref2 ?? "").toLowerCase().includes(q) ||
        (b.rolePref3 ?? "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "memberName":
          av = (a.member?.fullName ?? "").toLowerCase();
          bv = (b.member?.fullName ?? "").toLowerCase();
          break;
        case "term":
          av = a.term?.name ?? "";
          bv = b.term?.name ?? "";
          break;
        case "pref1":
          av = a.projectPref1?.name ?? "";
          bv = b.projectPref1?.name ?? "";
          break;
        case "pref2":
          av = a.projectPref2?.name ?? "";
          bv = b.projectPref2?.name ?? "";
          break;
        case "pref3":
          av = a.projectPref3?.name ?? "";
          bv = b.projectPref3?.name ?? "";
          break;
        case "assignedProject":
          av = a.assignedProject?.name ?? "";
          bv = b.assignedProject?.name ?? "";
          break;
        case "role":
          av = a.member?.hiredRoles?.[0]?.role ?? "";
          bv = b.member?.hiredRoles?.[0]?.role ?? "";
          break;
        case "hours":
          av = a.hoursPerWeek ?? 0;
          bv = b.hoursPerWeek ?? 0;
          break;
        case "preference":
          av = a.preference ?? "";
          bv = b.preference ?? "";
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [bids, filterAssigned, filterSearch, sortKey, sortDir]);

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

  function openDetail(bid: Bid) {
    setSelectedId(bid.id);
    setDetail(bid);
    setEditing(false);
    setSaveError(null);
    setEditState({
      assignedProjectId: bid.assignedProjectId ?? "",
      assignedRole: bid.assignedRole ?? "",
    });
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setEditing(false);
    setEditState(null);
    setSaveError(null);
  }

  async function handleCreate() {
    if (!createState.memberId || !createState.termId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createBid({
        memberId: createState.memberId,
        termId: createState.termId,
        rolePref1: createState.rolePref1 || undefined,
        hoursPerWeek: createState.hoursPerWeek || undefined,
      });
      setBids(prev => [created, ...prev]);
      setCreateOpen(false);
      setCreateState({ memberId: "", termId: "", rolePref1: "", hoursPerWeek: "" });
      setMemberSearch("");
    } catch (e: any) {
      setCreateError(e.message ?? "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await deleteBid(selectedId);
      setBids(prev => prev.filter(b => b.id !== selectedId));
      closeDetail();
    } catch (e: any) {
      setSaveError(e.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!selectedId || !editState) return;
    if (editState.assignedProjectId && !editState.assignedRole) {
      setSaveError("Role is required when assigning a project.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await patchBid(selectedId, {
        assignedProjectId: editState.assignedProjectId || null,
        assignedRole: editState.assignedRole || null,
      });
      // Reconstruct nested assignedProject in case the API response omits it
      const assignedProject = updated.assignedProject
        ?? (updated.assignedProjectId
            ? projects.find(p => p.id === updated.assignedProjectId)
                ? { id: updated.assignedProjectId, name: projects.find(p => p.id === updated.assignedProjectId)!.name }
                : null
            : null);
      const merged = { ...updated, assignedProject };
      setDetail(merged);
      setBids(prev => prev.map(b => b.id === selectedId ? { ...b, ...merged } : b));
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
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Project Assignment</h1>
            <button onClick={fetchBids} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? "Loading…"
              : is404
              ? "Bids endpoint not available"
              : `${filtered.length} bids`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => { setCreateOpen(true); setCreateError(null); }}>
            + New Bid
          </Button>
          {/* Tab switcher */}
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(["table", "assign"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                  activeTab === tab
                    ? "bg-[#00C795] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                {tab === "table" ? "Table" : "Assign"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create bid dialog */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) { setMemberSearch(""); setCreateState({ memberId: "", termId: "", rolePref1: "", hoursPerWeek: "" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Member <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  placeholder="Search member…"
                  value={memberSearch}
                  onChange={e => {
                    setMemberSearch(e.target.value);
                    setMemberDropdownOpen(true);
                    // If the user clears the input, also clear the selected member
                    if (!e.target.value) setCreateState(s => ({ ...s, memberId: "" }));
                  }}
                  onFocus={() => setMemberDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setMemberDropdownOpen(false), 150)}
                  className="w-full"
                />
                {memberDropdownOpen && (
                  <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-200 bg-white shadow-md text-sm">
                    {members
                      .filter(m => {
                        const q = memberSearch.toLowerCase();
                        return (
                          (m.fullName ?? "").toLowerCase().includes(q) ||
                          (m.daliEmail ?? "").toLowerCase().includes(q)
                        );
                      })
                      .map(m => (
                        <li
                          key={m.id}
                          onMouseDown={() => {
                            setCreateState(s => ({ ...s, memberId: m.id }));
                            setMemberSearch(m.fullName ?? m.daliEmail ?? m.id);
                            setMemberDropdownOpen(false);
                          }}
                          className={cn(
                            "px-3 py-2 cursor-pointer hover:bg-gray-50",
                            createState.memberId === m.id && "bg-[#E6FFF9] text-[#00A87A]"
                          )}
                        >
                          <span className="font-medium">{m.fullName ?? m.daliEmail ?? m.id}</span>
                          {m.fullName && m.daliEmail && (
                            <span className="ml-2 text-gray-400 text-xs">{m.daliEmail}</span>
                          )}
                        </li>
                      ))}
                    {members.filter(m => {
                      const q = memberSearch.toLowerCase();
                      return (
                        (m.fullName ?? "").toLowerCase().includes(q) ||
                        (m.daliEmail ?? "").toLowerCase().includes(q)
                      );
                    }).length === 0 && (
                      <li className="px-3 py-2 text-gray-400">No members found</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Term <span className="text-red-500">*</span></Label>
              <select
                value={createState.termId}
                onChange={e => setCreateState(s => ({ ...s, termId: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:border-[#00C795]"
              >
                <option value="">Select term…</option>
                {terms.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Role Preference</Label>
              <Select
                value={createState.rolePref1 || "__none__"}
                onValueChange={v => setCreateState(s => ({ ...s, rolePref1: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {["FULLSTACK", "DATA", "ENGINES", "AR_VR", "UI_UX", "VIDEO", "INSTRUCTOR", "PM"].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hours / Week</Label>
              <Input
                placeholder="e.g. 10"
                value={createState.hoursPerWeek}
                onChange={e => setCreateState(s => ({ ...s, hoursPerWeek: e.target.value }))}
              />
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createState.memberId || !createState.termId}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Board */}
      {activeTab === "assign" && (
        <div className="flex flex-1 overflow-hidden min-h-0">
          <BidAssignBoard
            bids={bids}
            projects={projects}
            term={filterTerm}
            terms={terms}
            currentTerm={currentTerm}
            onTermChange={setFilterTerm}
            onBidsChange={setBids}
            onRefresh={fetchBids}
            loading={loading}
            onSelectBid={openDetail}
            onDeleteBid={async (bidId) => {
              setDeleting(true);
              try {
                await deleteBid(bidId);
                setBids(prev => prev.filter(b => b.id !== bidId));
                if (selectedId === bidId) closeDetail();
              } catch (e: any) {
                setSaveError(e.message ?? "Delete failed");
              } finally {
                setDeleting(false);
              }
            }}
            selectedBidId={selectedId}
          />
          {selectedId && detail && (
            <ResizablePanel defaultWidth={380}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="font-semibold text-gray-900 text-sm">Bid Details</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    title="Delete bid"
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={closeDetail}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="px-5 py-4 space-y-5">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {detail.member?.fullName ?? detail.memberId}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{detail.member?.daliEmail ?? ""}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Term: {detail.term?.name ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Preferences</p>
                  <div className="space-y-1">
                    {detail.projectPref1 && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <p className="text-sm text-gray-800">{detail.projectPref1.name}</p>
                      </div>
                    )}
                    {detail.projectPref2 && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                        <p className="text-sm text-gray-800">{detail.projectPref2.name}</p>
                      </div>
                    )}
                    {detail.projectPref3 && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                        <p className="text-sm text-gray-800">{detail.projectPref3.name}</p>
                      </div>
                    )}
                    {!detail.projectPref1 && !detail.projectPref2 && !detail.projectPref3 && (
                      <p className="text-sm text-gray-400">None</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Role" value={detail.member?.hiredRoles?.map(r => r.role).join(", ") || "—"} className="col-span-2" />
                  <InfoField label="Hours / Week" value={detail.hoursPerWeek != null ? `${detail.hoursPerWeek}h` : "—"} />
                  <InfoField label="Preference" value={detail.preference ?? "—"} />
                  <InfoField label="Mentor" value={detail.isMentorThisTerm ? "Yes" : "No"} />
                  <InfoField label="Ready" value={detail.readyToMigrate ? "Yes" : "No"} />
                  <InfoField label="In Assignments" value={detail.addedToAssignments ? "Yes" : "No"} />
                  {detail.submittedAt && (
                    <InfoField label="Submitted" value={new Date(detail.submittedAt).toLocaleDateString()} className="col-span-2" />
                  )}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assignment</p>
                    {!editing ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setSaveError(null); setEditState({ assignedProjectId: detail.assignedProjectId ?? "", assignedRole: detail.assignedRole ?? "" }); }}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <InfoField label="Assigned Project" value={detail.assignedProject?.name ?? "Unassigned"} />
                    <InfoField label="Assigned Role" value={detail.assignedRole ?? "—"} />
                  </div>
                  {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}
                  {editing && editState && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Assigned Project ID</Label>
                        <Input
                          value={editState.assignedProjectId}
                          onChange={e => setEditState(s => s ? { ...s, assignedProjectId: e.target.value } : s)}
                          placeholder="Project UUID"
                        />
                        <p className="text-xs text-gray-400">Enter the project UUID to assign</p>
                      </div>
                      <div className="space-y-1">
                        <Label>
                          Assigned Role
                          {editState.assignedProjectId && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>
                        {(detail.member?.hiredRoles?.length ?? 0) > 0 ? (
                          <Select
                            value={editState.assignedRole || ""}
                            onValueChange={v => setEditState(s => s ? { ...s, assignedRole: v } : s)}
                          >
                            <SelectTrigger className={cn(!editState.assignedRole && editState.assignedProjectId && "border-red-300")}>
                              <SelectValue placeholder="Select role…" />
                            </SelectTrigger>
                            <SelectContent>
                              {detail.member!.hiredRoles!.map(r => (
                                <SelectItem key={r.role} value={r.role}>{r.role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={editState.assignedRole}
                            onChange={e => setEditState(s => s ? { ...s, assignedRole: e.target.value } : s)}
                            placeholder="e.g. FULLSTACK, DATA"
                            className={cn(!editState.assignedRole && editState.assignedProjectId && "border-red-300")}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {detail.interest && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Interest</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.interest}</p>
                  </div>
                )}
                {detail.roleQuestion1 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Question 1</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.roleQuestion1}</p>
                  </div>
                )}
                {detail.roleQuestion2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Question 2</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.roleQuestion2}</p>
                  </div>
                )}
                {detail.roleQuestion3 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Question 3</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.roleQuestion3}</p>
                  </div>
                )}
                {detail.preferWith && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Prefer to work with</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.preferWith}</p>
                  </div>
                )}
                {detail.preferNotWith && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Prefer NOT to work with</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.preferNotWith}</p>
                  </div>
                )}
              </div>
            </ResizablePanel>
          )}
        </div>
      )}

      {/* Table view (table only) */}
      {activeTab === "table" && <>
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
        {/* Term selector */}
        <Select value={filterTerm} onValueChange={setFilterTerm}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="All terms" />
          </SelectTrigger>
          <SelectContent>
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
        {/* Member / project search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="w-52 h-8 pl-7 text-sm"
            placeholder="Search member, project, role…"
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

        {/* Assigned toggle */}
        <div className="flex rounded-md border border-gray-300 overflow-hidden">
          {(["all", "assigned", "unassigned"] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilterAssigned(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                filterAssigned === v
                  ? "bg-[#00C795] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {v === "all" ? "All" : v === "assigned" ? "Assigned" : "Unassigned"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className={cn("flex-1 overflow-auto", selectedId && "lg:border-r lg:border-gray-200")}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-red-600 font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchBids}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : is404 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
              <Clock className="h-10 w-10 text-gray-300" />
              <p className="text-gray-700 font-medium">Bids endpoint not yet available</p>
              <p className="text-gray-400 text-sm max-w-sm">
                The <code className="bg-gray-100 px-1 rounded text-xs">/bids</code> route hasn't been added to dali-db yet. Once it's added, bid data will appear here automatically.
              </p>
              <Button variant="outline" size="sm" onClick={fetchBids}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("memberName")}>
                    <span className="flex items-center">Member <SortIcon col="memberName" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("term")}>
                    <span className="flex items-center">Term <SortIcon col="term" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("pref1")}>
                    <span className="flex items-center">Pref 1 <SortIcon col="pref1" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("pref2")}>
                    <span className="flex items-center">Pref 2 <SortIcon col="pref2" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("pref3")}>
                    <span className="flex items-center">Pref 3 <SortIcon col="pref3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("assignedProject")}>
                    <span className="flex items-center">Assigned Project <SortIcon col="assignedProject" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("role")}>
                    <span className="flex items-center">Role <SortIcon col="role" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("hours")}>
                    <span className="flex items-center">Hrs/wk <SortIcon col="hours" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("preference")}>
                    <span className="flex items-center">Pref <SortIcon col="preference" /></span>
                  </TableHead>
                  <TableHead>Ready</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows count={10} />
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-gray-400">
                      No bids found for this term / filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(bid => (
                    <TableRow
                      key={bid.id}
                      className={cn("cursor-pointer", selectedId === bid.id && "bg-[#E6FFF9]")}
                      onClick={() => openDetail(bid)}
                    >
                      <TableCell>
                        <p className="font-medium text-sm text-gray-900">
                          {bid.member?.fullName ?? bid.memberId}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {bid.term?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-[130px] truncate">
                        {bid.projectPref1?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-[130px] truncate">
                        {bid.projectPref2?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-[130px] truncate">
                        {bid.projectPref3?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {bid.assignedProject ? (
                          <Badge variant="secondary">{bid.assignedProject.name}</Badge>
                        ) : (
                          <span className="text-gray-400 text-xs">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {bid.member?.hiredRoles?.map(r => r.role).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {bid.hoursPerWeek != null ? `${bid.hoursPerWeek}h` : "—"}
                      </TableCell>
                      <TableCell>
                        {bid.preference != null ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              bid.preference === "MENTOR"
                                ? "bg-green-100 text-green-700"
                                : bid.preference === "CONTRIBUTOR"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {bid.preference}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            bid.readyToMigrate
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {bid.readyToMigrate ? "Ready" : "Not ready"}
                        </span>
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
          <ResizablePanel defaultWidth={380}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900 text-sm">Bid Details</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete bid"
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={closeDetail}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 px-5 py-4 space-y-5">
              {/* Member + term */}
              <div>
                <h3 className="font-semibold text-gray-900">
                  {detail.member?.fullName ?? detail.memberId}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">Term: {detail.term?.name ?? "—"}</p>
              </div>

              {/* Bid fields */}
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Role" value={detail.member?.hiredRoles?.map(r => r.role).join(", ") || "—"} className="col-span-2" />
                <InfoField label="Pref 1" value={detail.projectPref1?.name ?? "—"} />
                <InfoField label="Pref 2" value={detail.projectPref2?.name ?? "—"} />
                <InfoField label="Pref 3" value={detail.projectPref3?.name ?? "—"} />
                <InfoField label="Assigned Project" value={detail.assignedProject?.name ?? "Unassigned"} />
                <InfoField label="Hours / Week" value={detail.hoursPerWeek != null ? `${detail.hoursPerWeek}h` : "—"} />
                <InfoField label="Preference" value={detail.preference != null ? String(detail.preference) : "—"} />
                <InfoField label="Ready" value={detail.readyToMigrate ? "Yes" : "No"} />
                <InfoField label="In Assignments" value={detail.addedToAssignments ? "Yes" : "No"} />
                {detail.submittedAt && (
                  <InfoField
                    label="Submitted"
                    value={new Date(detail.submittedAt).toLocaleDateString()}
                    className="col-span-2"
                  />
                )}
              </div>

              {/* Interest */}
              {detail.interest && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Interest</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detail.interest}</p>
                </div>
              )}
              {detail.roleQuestion1 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Question 1</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detail.roleQuestion1}</p>
                </div>
              )}
              {detail.roleQuestion2 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Question 2</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detail.roleQuestion2}</p>
                </div>
              )}
              {detail.roleQuestion3 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Role Question 3</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{detail.roleQuestion3}</p>
                </div>
              )}

              {/* Edit */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assign</p>
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
                            assignedProjectId: detail.assignedProjectId ?? "",
                            assignedRole: detail.assignedRole ?? "",
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
                    <div className="space-y-1">
                      <Label>Assigned Project ID</Label>
                      <Input
                        value={editState.assignedProjectId}
                        onChange={e => setEditState(s => s ? { ...s, assignedProjectId: e.target.value } : s)}
                        disabled={!editing}
                        placeholder="Project UUID"
                      />
                      <p className="text-xs text-gray-400">Enter the project UUID to assign</p>
                    </div>
                    <div className="space-y-1">
                      <Label>
                        Assigned Role
                        {editState.assignedProjectId && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      <Input
                        value={editState.assignedRole}
                        onChange={e => setEditState(s => s ? { ...s, assignedRole: e.target.value } : s)}
                        disabled={!editing}
                        placeholder="e.g. FULLSTACK, DATA"
                        className={cn(!editState.assignedRole && editState.assignedProjectId && "border-red-300")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        )}
      </div>
      </>}
    </div>
  );
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5 font-medium">{value}</p>
    </div>
  );
}
