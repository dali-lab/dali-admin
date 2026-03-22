/**
 * BidAssignBoard — drag-and-drop project assignment board.
 *
 * Layout: horizontal scrolling columns, one per active project.
 * Left column: "Unassigned" pool of all bids without an assigned project.
 * Each column shows member cards; dragging a card onto a column assigns that bid.
 * Uses native HTML5 DnD — no external library.
 */

import { useState, useRef, useCallback } from "react";
import { RefreshCw, X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { patchBid, publishBids } from "@/lib/api";
import type { Bid, Project } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Role picker modal ────────────────────────────────────────────────────────

function RolePickerModal({ roles, onConfirm, onCancel }: {
  roles: string[];
  onConfirm: (role: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl p-5 w-72 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Assign as which role?</p>
          <button onClick={onCancel}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500">This member has multiple roles. Select the one for this project assignment.</p>
        <div className="space-y-1.5">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => onConfirm(r)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  bids: Bid[];
  projects: Project[];
  term: string;
  onBidsChange: (bids: Bid[]) => void;
  onRefresh: () => void;
  loading: boolean;
  onSelectBid?: (bid: Bid) => void;
  onDeleteBid?: (bidId: string) => void;
  selectedBidId?: string | null;
}

// Pref match level for a bid → project
function prefLevel(bid: Bid, projectId: string): 1 | 2 | 3 | null {
  if (bid.projectPref1?.id === projectId) return 1;
  if (bid.projectPref2?.id === projectId) return 2;
  if (bid.projectPref3?.id === projectId) return 3;
  return null;
}

function prefDot(level: 1 | 2 | 3 | null) {
  if (!level) return null;
  const colors = ["", "bg-green-500", "bg-yellow-400", "bg-orange-400"] as const;
  const labels = ["", "#1 choice", "#2 choice", "#3 choice"] as const;
  return (
    <span
      title={labels[level]}
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", colors[level])}
    />
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function BidAvatar({ imageUrl, name }: { imageUrl: string | null; name: string | null }) {
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={name ?? ""}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium shrink-0">
      {initials(name)}
    </div>
  );
}

function roleColor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("fullstack") || r.includes("dev")) return "bg-blue-100 text-blue-700";
  if (r.includes("design") || r.includes("ui") || r.includes("ux")) return "bg-purple-100 text-purple-700";
  if (r.includes("data")) return "bg-orange-100 text-orange-700";
  if (r.includes("pm") || r.includes("product")) return "bg-pink-100 text-pink-700";
  if (r.includes("engine") || r.includes("ar") || r.includes("vr")) return "bg-cyan-100 text-cyan-700";
  if (r.includes("video")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

// ─── Member card ─────────────────────────────────────────────────────────────

function MemberCard({
  bid,
  projectId,
  onDragStart,
  onDragEnd,
  isDragging,
  isRecentlyMoved,
  isSelected,
  onSelect,
  onDelete,
}: {
  bid: Bid;
  projectId: string | null;
  onDragStart: (bidId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isRecentlyMoved: boolean;
  isSelected: boolean;
  onSelect?: (bid: Bid) => void;
  onDelete?: (bidId: string) => void;
}) {
  const pref = projectId ? prefLevel(bid, projectId) : null;
  const hiredRoles = bid.member?.hiredRoles ?? [];
  const isMentor = bid.isMentorThisTerm;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("bidId", bid.id);
        onDragStart(bid.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect?.(bid)}
      className={cn(
        "bg-white rounded-lg border p-3 cursor-pointer active:cursor-grabbing",
        "hover:border-[#00C795] hover:shadow-sm transition-all select-none",
        isDragging && "opacity-40 scale-95",
        isSelected
          ? "border-[#00C795] shadow-[0_0_0_2px_#00C79540] bg-[#E6FFF9]"
          : isRecentlyMoved
          ? "border-[#00C795] shadow-[0_0_0_2px_#00C79540]"
          : "border-gray-200",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <BidAvatar imageUrl={bid.member?.imageUrl ?? null} name={bid.member?.fullName ?? null} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {pref && prefDot(pref)}
            <p className="text-sm font-medium text-gray-900 truncate leading-tight">
              {bid.member?.fullName ?? "Unknown"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {bid.assignedRole ? (
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", roleColor(bid.assignedRole))}>
                {bid.assignedRole}
              </span>
            ) : hiredRoles.map(({ role, level }) => (
              <span key={role} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", roleColor(role))}>
                {role}{level && (role.toLowerCase() === "core" || role.toLowerCase() === "instructor") ? ` · ${level}` : ""}
              </span>
            ))}
            {isMentor && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                mentor
              </span>
            )}
          </div>
          {bid.hoursPerWeek && (
            <p className="text-[10px] text-gray-400 mt-0.5">{bid.hoursPerWeek}</p>
          )}
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(bid.id); }}
            title="Delete bid"
            className="shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Project column ───────────────────────────────────────────────────────────

function ProjectColumn({
  projectId,
  title,
  bids,
  dragOverId,
  draggingId,
  recentlyMovedId,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  isUnassigned,
  onSelectBid,
  onDeleteBid,
  selectedBidId,
  onPublish,
  publishState,
}: {
  projectId: string | null;
  title: string;
  bids: Bid[];
  dragOverId: string | null;
  draggingId: string | null;
  recentlyMovedId: string | null;
  onDragOver: (id: string | null) => void;
  onDragLeave: () => void;
  onDrop: (targetProjectId: string | null) => void;
  onDragStart: (bidId: string) => void;
  onDragEnd: () => void;
  isUnassigned?: boolean;
  onSelectBid?: (bid: Bid) => void;
  onDeleteBid?: (bidId: string) => void;
  selectedBidId?: string | null;
  onPublish?: () => void;
  publishState?: "idle" | "loading" | "done" | "error";
}) {
  const colId = projectId ?? "__unassigned__";
  const isOver = dragOverId === colId;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border-2 transition-colors shrink-0",
        "w-[240px]",
        isOver
          ? "border-[#00C795] bg-[#E6FFF9]"
          : isUnassigned
          ? "border-gray-200 bg-gray-50"
          : "border-gray-200 bg-white",
      )}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(colId); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(projectId); }}
    >
      {/* Column header */}
      <div className={cn(
        "px-3 py-2.5 border-b border-gray-200 rounded-t-xl",
        isUnassigned ? "bg-gray-100" : "bg-gray-50",
      )}>
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
              {bids.length}
            </span>
            {onPublish && (
              <button
                onClick={onPublish}
                disabled={publishState === "loading" || bids.length === 0}
                title={publishState === "done" ? "Published!" : "Publish team"}
                className={cn(
                  "p-1 rounded transition-colors disabled:opacity-40",
                  publishState === "done"
                    ? "text-[#00C795]"
                    : publishState === "error"
                    ? "text-red-500 hover:bg-red-50"
                    : "text-gray-400 hover:text-[#00C795] hover:bg-[#E6FFF9]",
                )}
              >
                {publishState === "loading"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : publishState === "done"
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <Send className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[80px]">
        {bids.length === 0 ? (
          <div className={cn(
            "flex items-center justify-center h-16 rounded-lg border-2 border-dashed text-xs text-gray-400",
            isOver ? "border-[#00C795] text-[#00C795]" : "border-gray-200",
          )}>
            {isOver ? "Drop here" : isUnassigned ? "All assigned!" : "Drop here"}
          </div>
        ) : (
          bids.map(bid => (
            <MemberCard
              key={bid.id}
              bid={bid}
              projectId={projectId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggingId === bid.id}
              isRecentlyMoved={recentlyMovedId === bid.id}
              isSelected={selectedBidId === bid.id}
              onSelect={onSelectBid}
              onDelete={onDeleteBid}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main board ───────────────────────────────────────────────────────────────

export default function BidAssignBoard({ bids, projects, term, onBidsChange, onRefresh, loading, onSelectBid, onDeleteBid, selectedBidId }: Props) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [publishStates, setPublishStates] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [rolePick, setRolePick] = useState<{ bidId: string; targetProjectId: string | null; roles: string[] } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentlyMovedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleProjects = projects.filter(p =>
    !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // Filter bids by member name search
  const filteredBids = bids.filter(b => {
    if (!memberSearch) return true;
    const name = b.member?.fullName?.toLowerCase() ?? "";
    return name.includes(memberSearch.toLowerCase());
  });

  // Group bids: unassigned + per project
  const unassignedBids = filteredBids.filter(b => !b.assignedProjectId);
  const bidsByProject = (projectId: string) =>
    filteredBids.filter(b => b.assignedProjectId === projectId);

  const handleDragOver = useCallback((id: string | null) => {
    if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragLeaveTimer.current = setTimeout(() => setDragOverId(null), 80);
  }, []);

  const applyAssignment = useCallback(async (bidId: string, targetProjectId: string | null, assignedRole: string | null) => {
    // Optimistic update
    const updated = bids.map(b =>
      b.id === bidId
        ? {
            ...b,
            assignedProjectId: targetProjectId,
            assignedRole: assignedRole,
            assignedProject: targetProjectId
              ? (projects.find(p => p.id === targetProjectId)
                  ? { id: targetProjectId, name: projects.find(p => p.id === targetProjectId)!.name }
                  : b.assignedProject)
              : null,
          }
        : b
    );
    onBidsChange(updated);

    setSaving(prev => new Set(prev).add(bidId));
    setErrors(prev => { const n = { ...prev }; delete n[bidId]; return n; });

    try {
      await patchBid(bidId, { assignedProjectId: targetProjectId, assignedRole });
    } catch (err: any) {
      onBidsChange(bids);
      setErrors(prev => ({ ...prev, [bidId]: err.message ?? "Save failed" }));
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(bidId); return n; });
    }
  }, [bids, projects, onBidsChange]);

  const handleDrop = useCallback(async (targetProjectId: string | null) => {
    setDragOverId(null);
    if (!draggingId) return;

    const bid = bids.find(b => b.id === draggingId);
    if (!bid) return;

    // No-op if same project
    if (bid.assignedProjectId === targetProjectId) return;

    // Highlight the moved card briefly
    setRecentlyMovedId(draggingId);
    if (recentlyMovedTimer.current) clearTimeout(recentlyMovedTimer.current);
    recentlyMovedTimer.current = setTimeout(() => setRecentlyMovedId(null), 1800);

    const roles = bid.member?.hiredRoles?.map(r => r.role) ?? [];

    if (targetProjectId === null) {
      // Moving to unassigned — clear role too
      await applyAssignment(draggingId, null, null);
    } else if (roles.length <= 1) {
      // Single or no role — auto-assign
      await applyAssignment(draggingId, targetProjectId, roles[0] ?? null);
    } else {
      // Multiple roles — ask
      setRolePick({ bidId: draggingId, targetProjectId, roles });
    }
  }, [draggingId, bids, applyAssignment]);

  const handlePublish = useCallback(async (projectId: string) => {
    setPublishStates(prev => ({ ...prev, [projectId]: "loading" }));
    try {
      await publishBids(projectId, term);
      setPublishStates(prev => ({ ...prev, [projectId]: "done" }));
    } catch {
      setPublishStates(prev => ({ ...prev, [projectId]: "error" }));
    }
  }, [term]);

  const pendingSaves = saving.size;

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {rolePick && (
        <RolePickerModal
          roles={rolePick.roles}
          onConfirm={async (role) => {
            const { bidId, targetProjectId } = rolePick;
            setRolePick(null);
            await applyAssignment(bidId, targetProjectId, role);
          }}
          onCancel={() => setRolePick(null)}
        />
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <input
          type="text"
          placeholder="Search members…"
          value={memberSearch}
          onChange={e => setMemberSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#00C795]/40 focus:border-[#00C795]"
        />
        <input
          type="text"
          placeholder="Filter projects…"
          value={projectSearch}
          onChange={e => setProjectSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#00C795]/40 focus:border-[#00C795]"
        />
        <div className="flex items-center gap-2 ml-auto">
          {pendingSaves > 0 && (
            <span className="text-xs text-[#00C795] font-medium animate-pulse">
              Saving {pendingSaves}…
            </span>
          )}
          {Object.keys(errors).length > 0 && (
            <span className="text-xs text-red-500 font-medium">
              {Object.keys(errors).length} save error(s)
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500 shrink-0">
        <span className="font-medium text-gray-600">Pref indicator:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> #1 choice</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> #2 choice</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> #3 choice</span>
        <span className="ml-2 text-gray-400">Drag cards between columns to assign</span>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-5 h-full items-start">
          {/* Unassigned column */}
          <ProjectColumn
            projectId={null}
            title="Unassigned"
            bids={unassignedBids}
            dragOverId={dragOverId}
            draggingId={draggingId}
            recentlyMovedId={recentlyMovedId}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            isUnassigned
            onSelectBid={onSelectBid}
            onDeleteBid={onDeleteBid}
            selectedBidId={selectedBidId}
          />

          {/* Separator */}
          <div className="w-px bg-gray-200 self-stretch shrink-0 mx-1" />

          {/* Project columns */}
          {visibleProjects.length === 0 ? (
            <div className="flex items-center justify-center w-64 h-32 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
              No projects for term {term}
            </div>
          ) : (
            visibleProjects.map(project => (
              <ProjectColumn
                key={project.id}
                projectId={project.id}
                title={project.name}
                bids={bidsByProject(project.id)}
                dragOverId={dragOverId}
                draggingId={draggingId}
                recentlyMovedId={recentlyMovedId}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onSelectBid={onSelectBid}
                onDeleteBid={onDeleteBid}
                selectedBidId={selectedBidId}
                onPublish={() => handlePublish(project.id)}
                publishState={publishStates[project.id] ?? "idle"}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
