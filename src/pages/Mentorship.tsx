import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getMembers, getBids, patchBid } from "@/lib/api";
import type { Member, Bid } from "@/lib/api";
import { useTermContext } from "@/context/TermContext";
import { cn } from "@/lib/utils";
import { Users, AlertCircle, X } from "lucide-react";

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAINS = [
  { key: "FULLSTACK", label: "Fullstack", color: "bg-blue-100 text-blue-700",    border: "border-blue-200"   },
  { key: "DATA",      label: "Data",      color: "bg-orange-100 text-orange-700", border: "border-orange-200" },
  { key: "ENGINES",   label: "Engines",   color: "bg-cyan-100 text-cyan-700",    border: "border-cyan-200"   },
  { key: "AR_VR",     label: "AR/VR",     color: "bg-cyan-100 text-cyan-700",    border: "border-cyan-200"   },
  { key: "UI_UX",     label: "UI/UX",     color: "bg-purple-100 text-purple-700", border: "border-purple-200" },
  { key: "VIDEO",     label: "Video",     color: "bg-red-100 text-red-700",      border: "border-red-200"    },
];

function domainMatch(role: string, domainKey: string): boolean {
  const r = role.toUpperCase();
  if (domainKey === "FULLSTACK") return r.includes("FULLSTACK") || r.includes("DEV") || r.includes("STACK");
  if (domainKey === "DATA")      return r.includes("DATA");
  if (domainKey === "ENGINES")   return r.includes("ENGINE");
  if (domainKey === "AR_VR")     return r.includes("AR") || r.includes("VR");
  if (domainKey === "UI_UX")     return r.includes("UI") || r.includes("UX") || r.includes("DESIGN");
  if (domainKey === "VIDEO")     return r.includes("VIDEO");
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberWithBid extends Member {
  bidId: string | null;
  assignedProject: { id: string; name: string } | null;
  currentTermProject: { id: string; name: string } | null;
  /** Role from bid.assignedRole — scopes which domain card this member appears in */
  assignedRole: string | null;
  mentorOptOut: boolean | null;
  mentorId: string | null;
  mentor: { id: string; fullName: string | null; daliEmail: string | null; imageUrl: string | null } | null;
  externalMentor: string | null;
}

interface MentorGroup {
  mentor: MemberWithBid;
  mentees: MemberWithBid[];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ imageUrl, name, email, size = "sm" }: {
  imageUrl: string | null; name: string | null; email: string | null; size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? email ?? "?")[0]?.toUpperCase();
  const dim = size === "md" ? "w-9 h-9" : "w-7 h-7";
  const text = size === "md" ? "text-sm" : "text-xs";
  if (imageUrl && !failed) {
    return <img src={imageUrl} alt="" className={`${dim} rounded-full object-cover shrink-0`} onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${dim} rounded-full bg-gray-200 flex items-center justify-center shrink-0`}>
      <span className={`${text} text-gray-500 font-medium`}>{initial}</span>
    </div>
  );
}

// ─── Draggable mentee chip ────────────────────────────────────────────────────

function MenteeChip({
  member,
  isDragging,
  isDropTarget = false,
  isDropOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
}: {
  member: MemberWithBid;
  isDragging: boolean;
  isDropTarget?: boolean;
  isDropOver?: boolean;
  onDragStart: (memberId: string) => void;
  onDragEnd: () => void;
  onDragOver?: (mentorId: string) => void;
  onDragLeave?: () => void;
  onDrop?: (mentorId: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("memberId", member.id); onDragStart(member.id); }}
      onDragEnd={onDragEnd}
      onDragOver={isDropTarget ? e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(member.id); } : undefined}
      onDragLeave={isDropTarget ? onDragLeave : undefined}
      onDrop={isDropTarget ? e => { e.preventDefault(); e.stopPropagation(); onDrop?.(member.id); } : undefined}
      className={cn(
        "group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-grab active:cursor-grabbing select-none transition-all",
        isDropTarget && isDropOver ? "bg-[#E6FFF9] ring-2 ring-[#00C795]" : "hover:bg-gray-100",
        isDragging ? "opacity-40 scale-95" : "opacity-100",
      )}
    >
      <Avatar imageUrl={member.imageUrl} name={member.fullName} email={member.daliEmail} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
          {member.fullName ?? member.daliEmail ?? "—"}
        </p>
        {member.assignedProject && (
          <p className="text-xs text-gray-400 truncate">{member.assignedProject.name}</p>
        )}
      </div>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 shrink-0"
          title="Remove mentor assignment"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Mentor row (drop target) ─────────────────────────────────────────────────

function MentorRow({
  group,
  dragOverMentorId,
  draggingId,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onToggleOptOut,
  onUnassign,
}: {
  group: MentorGroup;
  dragOverMentorId: string | null;
  draggingId: string | null;
  onDragOver: (mentorId: string) => void;
  onDragLeave: () => void;
  onDrop: (mentorId: string) => void;
  onDragStart: (memberId: string) => void;
  onDragEnd: () => void;
  onToggleOptOut: (member: MemberWithBid) => void;
  onUnassign: (member: MemberWithBid) => void;
}) {
  const { mentor, mentees } = group;
  const isOver = dragOverMentorId === mentor.id;
  const optedOut = mentor.mentorOptOut === true;

  return (
    <div
      className={cn(
        "rounded-lg border-2 transition-colors",
        isOver ? "border-[#00C795] bg-[#E6FFF9]" : "border-transparent",
      )}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(mentor.id); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(mentor.id); }}
    >
      {/* Mentor header */}
      <div className={cn("flex items-center gap-2 px-2 py-2 rounded-md", optedOut && "opacity-50")}>
        <Avatar imageUrl={mentor.imageUrl} name={mentor.fullName} email={mentor.daliEmail} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {mentor.fullName ?? mentor.daliEmail ?? "—"}
          </p>
          {mentor.assignedProject && (
            <p className="text-xs text-gray-400 truncate">{mentor.assignedProject.name}</p>
          )}
        </div>
        {optedOut ? (
          <button
            onClick={() => onToggleOptOut(mentor)}
            className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 hover:bg-amber-100 transition-colors"
            title="Click to re-enable mentoring"
          >
            opt-out
          </button>
        ) : (
          <button
            onClick={() => onToggleOptOut(mentor)}
            className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded shrink-0 hover:bg-gray-300 transition-colors"
            title="Click to opt out of mentoring"
          >
            P3
          </button>
        )}
      </div>

      {/* Mentees */}
      {!optedOut && (
        <div className="pl-6 pb-1 min-h-[32px]">
          {mentees.length === 0 ? (
            <p className={cn(
              "text-xs text-gray-400 px-2 py-1",
              isOver && "text-[#00C795]",
            )}>
              {isOver ? "Drop to assign" : "Drop mentees here"}
            </p>
          ) : (
            mentees.map(m => (
              <MenteeChip
                key={m.id}
                member={m}
                isDragging={draggingId === m.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onRemove={() => onUnassign(m)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Domain card ──────────────────────────────────────────────────────────────

function DomainCard({
  domain,
  groups,
  unmentored,
  dragOverMentorId,
  dragOverUnassigned,
  draggingId,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onToggleOptOut,
  onUnassign,
}: {
  domain: typeof DOMAINS[number];
  groups: MentorGroup[];
  unmentored: MemberWithBid[];
  dragOverMentorId: string | null;
  dragOverUnassigned: boolean;
  draggingId: string | null;
  onDragOver: (mentorId: string | null) => void;
  onDragLeave: () => void;
  onDrop: (mentorId: string | null) => void;
  onDragStart: (memberId: string) => void;
  onDragEnd: () => void;
  onToggleOptOut: (member: MemberWithBid) => void;
  onUnassign: (member: MemberWithBid) => void;
}) {
  const totalMembers = groups.reduce((n, g) => n + 1 + g.mentees.length, 0) + unmentored.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className={cn("px-4 py-3 border-b flex items-center justify-between", domain.border)}>
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", domain.color)}>{domain.label}</span>
        <span className="text-xs text-gray-400">{totalMembers} member{totalMembers !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex-1 p-3 space-y-2">
        {groups.length === 0 && unmentored.length === 0 && (
          <p className="px-2 py-6 text-sm text-gray-400 text-center">No active members this term.</p>
        )}

        {groups.map(g => (
          <MentorRow
            key={g.mentor.id}
            group={g}
            dragOverMentorId={dragOverMentorId}
            draggingId={draggingId}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onToggleOptOut={onToggleOptOut}
            onUnassign={onUnassign}
          />
        ))}

        {/* Unassigned drop zone */}
        <div
          className={cn(
            "rounded-lg border-2 border-dashed transition-colors min-h-[48px]",
            dragOverUnassigned ? "border-[#00C795] bg-[#E6FFF9]" : "border-gray-200",
          )}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(null); }}
          onDragLeave={onDragLeave}
          onDrop={e => { e.preventDefault(); onDrop(null); }}
        >
          {unmentored.length === 0 && !dragOverUnassigned ? (
            <p className="text-xs text-gray-300 text-center py-3">Unassigned</p>
          ) : (
            <div className="p-1">
              {unmentored.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-2 pb-1">Unassigned</p>
              )}
              {dragOverUnassigned && (
                <p className="text-xs text-[#00C795] px-2 py-1">Drop to unassign</p>
              )}
              {unmentored.map(m => (
                <MenteeChip
                  key={m.id}
                  member={m}
                  isDragging={draggingId === m.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PM card ──────────────────────────────────────────────────────────────────

function PMCard({ members, allMembers, draggingId, dragOverMentorId, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onUnassign }: {
  members: MemberWithBid[];
  allMembers: MemberWithBid[];
  draggingId: string | null;
  dragOverMentorId: string | null;
  onDragStart: (memberId: string) => void;
  onDragEnd: () => void;
  onDragOver: (mentorId: string) => void;
  onDragLeave: () => void;
  onDrop: (mentorId: string) => void;
  onUnassign: (member: MemberWithBid) => void;
}) {
  const draggingMember = draggingId ? allMembers.find(m => m.id === draggingId) : null;
  const draggingIsPM = draggingMember ? members.some(m => m.id === draggingMember.id) : false;

  // Build mentor→mentee groups: any PM who has another PM pointing at them
  const mentorIds = new Set(members.map(m => m.mentorId).filter(Boolean) as string[]);
  const pmMentors = members.filter(m => mentorIds.has(m.id));
  const groups = pmMentors.map(mentor => ({
    mentor,
    mentees: members.filter(m => m.mentorId === mentor.id),
  }));
  const groupedIds = new Set([
    ...pmMentors.map(m => m.id),
    ...members.filter(m => m.mentorId && mentorIds.has(m.mentorId)).map(m => m.id),
  ]);
  const ungrouped = members.filter(m => !groupedIds.has(m.id));

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">PM</span>
          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            Manual assignment
          </div>
        </div>
        <span className="text-xs text-gray-400">{members.length} member{members.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex-1 p-3 space-y-1">
        {members.length === 0 && (
          <p className="px-2 py-4 text-sm text-gray-400 text-center">No active PMs this term.</p>
        )}

        {/* Mentor→mentee groups */}
        {groups.map(({ mentor, mentees }) => {
          const isOver = dragOverMentorId === mentor.id;
          return (
            <div
              key={mentor.id}
              className={cn("rounded-lg border-2 transition-colors", isOver ? "border-[#00C795] bg-[#E6FFF9]" : "border-transparent")}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(mentor.id); }}
              onDragLeave={onDragLeave}
              onDrop={e => { e.preventDefault(); onDrop(mentor.id); }}
            >
              <MenteeChip member={mentor} isDragging={draggingId === mentor.id} onDragStart={onDragStart} onDragEnd={onDragEnd} />
              <div className="pl-6">
                {mentees.map(m => (
                  <MenteeChip key={m.id} member={m} isDragging={draggingId === m.id} onDragStart={onDragStart} onDragEnd={onDragEnd} onRemove={() => onUnassign(m)} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Ungrouped PMs — drop target for other PMs */}
        {ungrouped.map(m => {
          const isDropTarget = draggingIsPM && !!draggingId && m.id !== draggingId;
          const isOver = isDropTarget && dragOverMentorId === m.id;
          return (
            <div
              key={m.id}
              className={cn("rounded-lg border-2 transition-colors", isOver ? "border-[#00C795] bg-[#E6FFF9]" : "border-transparent")}
              onDragOver={isDropTarget ? e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(m.id); } : undefined}
              onDragLeave={isDropTarget ? onDragLeave : undefined}
              onDrop={isDropTarget ? e => { e.preventDefault(); onDrop(m.id); } : undefined}
            >
              <MenteeChip member={m} isDragging={draggingId === m.id} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Mentorship() {
  const { currentTerm } = useTermContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DnD state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverMentorId, setDragOverMentorId] = useState<string | null>(null);
  // null = unassigned zone, string = mentor id
  const [dragOverTarget, setDragOverTarget] = useState<string | null | undefined>(undefined);
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentTerm) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getMembers({ active: true, limit: 500 }),
      getBids({ term: currentTerm }),
    ]).then(([m, b]) => {
      setMembers(m);
      setBids(b);
    }).catch(e => setError(e.message ?? "Failed to load")).finally(() => setLoading(false));
  }, [currentTerm]);

  const handlePatch = useCallback(async (bidId: string, patch: Partial<{ mentorOptOut: boolean | null; mentorId: string | null; externalMentor: string | null }>) => {
    const updated = await patchBid(bidId, patch);
    setBids(prev => prev.map(b => b.id === bidId ? { ...b, ...updated } : b));
  }, []);

  const membersWithBids = useMemo<MemberWithBid[]>(() => {
    const bidByMember = new Map(bids.map(b => [b.memberId, b]));
    return members
      .filter(m => m.isActive && !m.isAlum && m.termsInDali.some(t => t.name === currentTerm))
      .map(m => {
        const bid = bidByMember.get(m.id);
        const currentTermProject = m.memberTermRoles
          ?.find(r => r.term.name === currentTerm)
          ?.project ?? bid?.assignedProject ?? null;
        return {
          ...m,
          bidId: bid?.id ?? null,
          assignedProject: bid?.assignedProject ?? null,
          currentTermProject: currentTermProject as { id: string; name: string } | null,
          assignedRole: bid?.assignedRole ?? null,
          mentorOptOut: bid?.mentorOptOut ?? null,
          mentorId: bid?.mentorId ?? null,
          mentor: bid?.mentor ?? null,
          externalMentor: bid?.externalMentor ?? null,
        };
      });
  }, [members, bids, currentTerm]);

  const domainData = useMemo(() => {
    return DOMAINS.map(domain => {
      // If a member has an assignedRole, use only that to determine their domain.
      // Fall back to hiredRoles only if no role has been assigned yet.
      const domainMembers = membersWithBids.filter(m =>
        m.assignedRole
          ? domainMatch(m.assignedRole, domain.key)
          : m.hiredRoles.some(r => domainMatch(r.role, domain.key))
      );

      // P3 = hiredRole level P3 in this domain (level is on the hired role, not the assigned role)
      const isP3InDomain = (m: MemberWithBid) => {
        const domainRole = m.assignedRole
          ? m.hiredRoles.find(r => r.role === m.assignedRole)
          : m.hiredRoles.find(r => domainMatch(r.role, domain.key));
        return domainRole?.level === "P3";
      };

      const mentors = domainMembers.filter(isP3InDomain);
      const optedOutP3s = mentors.filter(m => m.mentorOptOut === true);
      const activeMentors = mentors.filter(m => m.mentorOptOut !== true);
      const nonP3s = domainMembers.filter(m => !isP3InDomain(m));

      // Opted-out P3s with a mentorId assigned appear as mentees under that mentor.
      // Opted-out P3s without a mentorId appear in the unassigned pool.
      const groups: MentorGroup[] = activeMentors.map(mentor => {
        const mentorProjectId = mentor.assignedProject?.id ?? null;
        const mentees = [
          // non-P3s assigned to this mentor or auto-matched by project
          ...nonP3s.filter(m =>
            m.mentorId === mentor.id ||
            (!m.mentorId && !m.externalMentor && mentorProjectId && m.assignedProject?.id === mentorProjectId)
          ),
          // opted-out P3s explicitly assigned to this mentor
          ...optedOutP3s.filter(m => m.mentorId === mentor.id),
        ];
        return { mentor, mentees };
      });

      const mentoredIds = new Set([
        ...groups.flatMap(g => g.mentees.map(m => m.id)),
        ...activeMentors.map(m => m.id),
      ]);
      // Unmentored = non-P3s with no mentor + opted-out P3s with no mentorId
      const unmentored = [
        ...nonP3s.filter(m => !mentoredIds.has(m.id)),
        ...optedOutP3s.filter(m => !m.mentorId),
      ];

      return { domain, groups, unmentored };
    });
  }, [membersWithBids]);

  const pmMembers = useMemo(() =>
    membersWithBids.filter(m => {
      const role = m.assignedRole ?? m.hiredRoles[0]?.role ?? "";
      return role.toUpperCase().includes("PM") || role.toUpperCase().includes("PRODUCT");
    }), [membersWithBids]
  );

  // ── DnD handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((memberId: string) => {
    setDraggingId(memberId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverTarget(undefined);
    setDragOverMentorId(null);
  }, []);

  // target: string = mentor id, null = unassigned zone
  const handleDragOver = useCallback((target: string | null) => {
    if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current);
    setDragOverTarget(target);
    setDragOverMentorId(target ?? null);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragLeaveTimer.current = setTimeout(() => {
      setDragOverTarget(undefined);
      setDragOverMentorId(null);
    }, 60);
  }, []);

  const handleDrop = useCallback(async (targetMentorId: string | null) => {
    setDragOverTarget(undefined);
    setDragOverMentorId(null);
    if (!draggingId) return;

    const member = membersWithBids.find(m => m.id === draggingId);
    if (!member?.bidId) return;

    // No-op if already assigned to this mentor
    if (member.mentorId === targetMentorId) return;
    // No-op if already unassigned and dropping on unassigned
    if (!member.mentorId && targetMentorId === null) return;

    // Optimistic update
    setBids(prev => prev.map(b =>
      b.id === member.bidId
        ? { ...b, mentorId: targetMentorId, externalMentor: null }
        : b
    ));

    try {
      await patchBid(member.bidId, { mentorId: targetMentorId, externalMentor: null });
    } catch {
      // Rollback
      getBids({ term: currentTerm }).then(setBids).catch(() => {});
    }
  }, [draggingId, membersWithBids, handlePatch, currentTerm]);

  const handleUnassign = useCallback(async (member: MemberWithBid) => {
    if (!member.bidId) return;
    setBids(prev => prev.map(b => b.id === member.bidId ? { ...b, mentorId: null } : b));
    try {
      await patchBid(member.bidId, { mentorId: null });
    } catch {
      getBids({ term: currentTerm }).then(setBids).catch(() => {});
    }
  }, [currentTerm]);

  const handleToggleOptOut = useCallback(async (member: MemberWithBid) => {
    if (!member.bidId) return;
    const next = member.mentorOptOut === true ? null : true;
    setBids(prev => prev.map(b => b.id === member.bidId ? { ...b, mentorOptOut: next } : b));
    try {
      await handlePatch(member.bidId, { mentorOptOut: next });
    } catch {
      getBids({ term: currentTerm }).then(setBids).catch(() => {});
    }
  }, [handlePatch, currentTerm]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-6 py-5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h1 className="text-base font-semibold text-gray-900">Mentorship Hub</h1>
          {currentTerm && (
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{currentTerm}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Drag members onto a mentor to assign them. Click a P3 badge to toggle opt-out.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && <div className="text-sm text-gray-400 text-center py-16">Loading…</div>}
        {error && <div className="text-sm text-red-500 text-center py-16">{error}</div>}
        {!loading && !error && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {domainData.map(({ domain, groups, unmentored }) => (
              <DomainCard
                key={domain.key}
                domain={domain}
                groups={groups}
                unmentored={unmentored}
                dragOverMentorId={dragOverMentorId}
                dragOverUnassigned={dragOverTarget === null}
                draggingId={draggingId}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onToggleOptOut={handleToggleOptOut}
                onUnassign={handleUnassign}
              />
            ))}
            <PMCard
              members={pmMembers}
              allMembers={membersWithBids}
              draggingId={draggingId}
              dragOverMentorId={dragOverMentorId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onUnassign={handleUnassign}
            />
          </div>
        )}
      </div>
    </div>
  );
}
