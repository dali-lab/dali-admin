/**
 * BidAssignBoard — drag-and-drop project assignment board.
 *
 * Layout: horizontal scrolling columns, one per active project.
 * Left column: "Unassigned" pool of all bids without an assigned project.
 * Each column shows member cards; dragging a card onto a column assigns that bid.
 * Uses native HTML5 DnD — no external library.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshCw, X, Send, Loader2, CheckCircle2, AlertCircle, Zap, Database, MessageSquare, GitBranch } from "lucide-react";
import { patchBid, publishBids, notifySlack, checkTeam, updateGithub } from "@/lib/api";
import type { Bid, Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Ship modal ───────────────────────────────────────────────────────────────

type AutomationStatus = "idle" | "loading" | "done" | "error";

interface Automation {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  run: () => Promise<string>; // returns a result summary string
}

function ShipModal({
  projectId,
  projectName,
  term,
  bidCount,
  slackChannelId,
  githubTeamSlug,
  onClose,
}: {
  projectId: string;
  projectName: string;
  term: string;
  bidCount: number;
  slackChannelId: string | null | undefined;
  githubTeamSlug: string | null | undefined;
  onClose: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, AutomationStatus>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [runningAll, setRunningAll] = useState(false);

  // Editable channel/team name inputs
  const [slackInput, setSlackInput] = useState(slackChannelId ?? "");
  const [githubInput, setGithubInput] = useState(githubTeamSlug ?? "");

  // Team existence check for "Publish to DB"
  const [teamCheck, setTeamCheck] = useState<{ exists: boolean; members: string[] } | null>(null);
  const [teamChecking, setTeamChecking] = useState(true);
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  useEffect(() => {
    checkTeam(projectId, term)
      .then(r => setTeamCheck(r))
      .catch(() => setTeamCheck(null))
      .finally(() => setTeamChecking(false));
  }, [projectId, term]);

  const publishBlocked = teamCheck?.exists && !publishConfirmed;

  const automations: Automation[] = [
    {
      id: "publish",
      label: "Publish to DB",
      description: "Create team, set member roles, mark project active",
      icon: <Database className="h-4 w-4" />,
      run: async () => {
        const r = await publishBids(projectId, term);
        return `${r.memberCount} member${r.memberCount !== 1 ? "s" : ""} added to team`;
      },
    },
    {
      id: "slack",
      label: "Notify via Slack",
      description: "Create channel & notify team",
      icon: <MessageSquare className="h-4 w-4" />,
      run: async () => {
        const r = await notifySlack(projectId, term, slackInput || undefined);
        if (r.channelName) setSlackInput(r.channelName);
        if (r.sent === r.total) return `${r.sent}/${r.total} members notified`;
        const reason = r.firstFailure?.error ?? "some members not found in Slack";
        return `${r.sent}/${r.total} sent — ${reason}`;
      },
    },
    {
      id: "github",
      label: "Update GitHub",
      description: "Create team & add members",
      icon: <GitBranch className="h-4 w-4" />,
      run: async () => {
        const r = await updateGithub(projectId, term);
        if (r.teamSlug) setGithubInput(r.teamSlug);
        return `${r.updated}/${r.total} members added`;
      },
    }
  ];

  async function runOne(automation: Automation) {
    setStatuses(s => ({ ...s, [automation.id]: "loading" }));
    setResults(r => ({ ...r, [automation.id]: "" }));
    try {
      const summary = await automation.run();
      setStatuses(s => ({ ...s, [automation.id]: "done" }));
      setResults(r => ({ ...r, [automation.id]: summary }));
    } catch (e: any) {
      setStatuses(s => ({ ...s, [automation.id]: "error" }));
      setResults(r => ({ ...r, [automation.id]: e.message ?? "Failed" }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    for (const a of automations) {
      if (a.id === "publish" && publishBlocked) continue;
      await runOne(a);
    }
    setRunningAll(false);
  }

  const anyLoading = Object.values(statuses).includes("loading") || runningAll;
  const allDone = automations.every(a => a.id === "publish" && publishBlocked ? true : statuses[a.id] === "done");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-[95vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#00C795]" />
              <p className="font-semibold text-gray-900 text-sm">Finalize Assignment</p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{projectName}</span>
              {" · "}{bidCount} member{bidCount !== 1 ? "s" : ""} assigned{" · "}{term}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Automations list */}
        <div className="px-5 py-3 space-y-2">
          {automations.map(a => {
            const status = statuses[a.id] ?? "idle";
            const result = results[a.id];
            const isPublish = a.id === "publish";
            const blocked = isPublish && publishBlocked;

            return (
              <div key={a.id} className={cn(
                "flex flex-col gap-2 p-3 rounded-xl border transition-colors",
                status === "done" ? "border-[#00C795]/40 bg-[#E6FFF9]" :
                status === "error" ? "border-red-200 bg-red-50" :
                blocked ? "border-amber-200 bg-amber-50" :
                "border-gray-200 bg-gray-50"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                    status === "done" ? "bg-[#00C795]/15 text-[#00A87A]" :
                    status === "error" ? "bg-red-100 text-red-500" :
                    blocked ? "bg-amber-100 text-amber-600" :
                    "bg-white text-gray-500 border border-gray-200"
                  )}>
                    {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     status === "done" ? <CheckCircle2 className="h-4 w-4" /> :
                     status === "error" ? <AlertCircle className="h-4 w-4" /> :
                     blocked ? <AlertCircle className="h-4 w-4" /> :
                     teamChecking && isPublish ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{a.label}</p>
                    {!result && a.id === "slack" && (
                      <input
                        value={slackInput}
                        onChange={e => setSlackInput(e.target.value)}
                        placeholder="channel-name"
                        className="mt-0.5 w-full text-xs font-mono bg-transparent border-0 border-b border-gray-200 focus:border-gray-400 outline-none text-gray-600 placeholder:text-gray-300 truncate"
                      />
                    )}
                    {!result && a.id === "github" && (
                      <input
                        value={githubInput}
                        onChange={e => setGithubInput(e.target.value)}
                        placeholder="team-slug"
                        className="mt-0.5 w-full text-xs font-mono bg-transparent border-0 border-b border-gray-200 focus:border-gray-400 outline-none text-gray-600 placeholder:text-gray-300 truncate"
                      />
                    )}
                    {(result || (a.id !== "slack" && a.id !== "github")) && (
                      <p className="text-xs text-gray-500 truncate">
                        {result || a.description}
                      </p>
                    )}
                  </div>
                  {!blocked && (
                    <button
                      onClick={() => runOne(a)}
                      disabled={anyLoading || (isPublish && teamChecking)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40",
                        status === "done"
                          ? "bg-[#00C795]/10 text-[#00A87A] hover:bg-[#00C795]/20"
                          : status === "error"
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {status === "done" ? "Re-run" : status === "error" ? "Retry" : "Run"}
                    </button>
                  )}
                </div>

                {/* Team already exists warning */}
                {isPublish && blocked && teamCheck && (
                  <div className="ml-11 space-y-1.5">
                    <p className="text-xs text-amber-700 font-medium">
                      A team for {term} already exists with {teamCheck.members.length} member{teamCheck.members.length !== 1 ? "s" : ""}:
                    </p>
                    <p className="text-xs text-amber-600">{teamCheck.members.join(", ")}</p>
                    <p className="text-xs text-amber-700">Running will overwrite it with the current assignments.</p>
                    <button
                      onClick={() => {
                        setPublishConfirmed(true);
                        runOne(a);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors font-medium"
                    >
                      Overwrite & run anyway
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={runAll}
            disabled={anyLoading || teamChecking}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
              allDone
                ? "bg-[#00C795]/10 text-[#00A87A] hover:bg-[#00C795]/20"
                : "bg-[#00C795] text-white hover:bg-[#00B382]"
            )}
          >
            {anyLoading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</>
              : allDone
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> All done</>
              : <><Zap className="h-3.5 w-3.5" /> Run all</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

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
  terms: { id: string; name: string }[];
  currentTerm: string;
  onTermChange: (term: string) => void;
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
  onUnassign,
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
  onUnassign?: (bidId: string) => void;
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

        {/* Unassign button (only when assigned to a project) */}
        {onUnassign && projectId && (
          <button
            onClick={(e) => { e.stopPropagation(); onUnassign(bid.id); }}
            title="Unassign"
            className="shrink-0 p-0.5 rounded text-gray-300 hover:text-orange-400 hover:bg-orange-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Delete button (only when unassigned) */}
        {onDelete && !projectId && (
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
  onUnassignBid,
  selectedBidId,
  onShip,
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
  onUnassignBid?: (bidId: string) => void;
  selectedBidId?: string | null;
  onShip?: () => void;
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
            {onShip && (
              <button
                onClick={onShip}
                disabled={bids.length === 0}
                title="Finalize assignment"
                className="p-1 rounded transition-colors disabled:opacity-40 text-gray-400 hover:text-[#00C795] hover:bg-[#E6FFF9]"
              >
                <Send className="h-3.5 w-3.5" />
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
              onUnassign={onUnassignBid}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main board ───────────────────────────────────────────────────────────────

export default function BidAssignBoard({ bids, projects, term, terms, currentTerm, onTermChange, onBidsChange, onRefresh, loading, onSelectBid, onDeleteBid, selectedBidId }: Props) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shipProjectId, setShipProjectId] = useState<string | null>(null);
  const [rolePick, setRolePick] = useState<{ bidId: string; targetProjectId: string | null; roles: string[] } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentlyMovedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleUnassign = useCallback(async (bidId: string) => {
    await applyAssignment(bidId, null, null);
  }, [applyAssignment]);

  const handleDragMove = useCallback((e: React.DragEvent) => {
    const board = boardRef.current;
    if (!board) return;
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    const rect = board.getBoundingClientRect();
    const threshold = 80;
    const speed = 12;
    const distLeft = e.clientX - rect.left;
    const distRight = rect.right - e.clientX;
    if (distLeft < threshold) {
      autoScrollRef.current = setInterval(() => { board.scrollLeft -= speed; }, 16);
    } else if (distRight < threshold) {
      autoScrollRef.current = setInterval(() => { board.scrollLeft += speed; }, 16);
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) { clearInterval(autoScrollRef.current); autoScrollRef.current = null; }
  }, []);

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
      {shipProjectId && (() => {
        const proj = projects.find(p => p.id === shipProjectId);
        const assignedBids = bids.filter(b => b.assignedProjectId === shipProjectId);
        return (
          <ShipModal
            projectId={shipProjectId}
            projectName={proj?.name ?? "Project"}
            term={term}
            bidCount={assignedBids.length}
            slackChannelId={proj?.slackChannelId}
            githubTeamSlug={proj?.githubTeamSlug}
            onClose={() => setShipProjectId(null)}
          />
        );
      })()}
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white shrink-0 flex-wrap">
        <Select value={term} onValueChange={onTermChange}>
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
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
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
      <div
        ref={boardRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onDragOver={handleDragMove}
        onDragEnd={stopAutoScroll}
        onDrop={stopAutoScroll}
      >
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
                onUnassignBid={handleUnassign}
                selectedBidId={selectedBidId}
                onShip={() => setShipProjectId(project.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
