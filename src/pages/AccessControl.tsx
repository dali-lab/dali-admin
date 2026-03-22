import { useState, useEffect } from "react";
import { ShieldCheck, Users, Plus, X, ChevronRight, Trash2, Lock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAccessGroups,
  createAccessGroup,
  deleteAccessGroup,
  patchAccessGroup,
  addAccessGroupMember,
  removeAccessGroupMember,
  getMembers,
  type AccessGroup,
} from "@/lib/api";

const ALL_PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: "members:read",    label: "Members — Read",    description: "View member profiles and data" },
  { key: "members:write",   label: "Members — Write",   description: "Edit member profiles, roles, and status" },
  { key: "projects:read",   label: "Projects — Read",   description: "View project details" },
  { key: "projects:write",  label: "Projects — Write",  description: "Edit project details and visibility" },
  { key: "bids:read",       label: "Bids — Read",       description: "View bid submissions" },
  { key: "bids:write",      label: "Bids — Write",      description: "Edit and publish bid assignments" },
  { key: "hiring:read",     label: "Hiring — Read",     description: "View hiring applications" },
  { key: "hiring:write",    label: "Hiring — Write",    description: "Review and update applications" },
  { key: "access:manage",   label: "Access — Manage",   description: "Manage user groups and permissions" },
];

export default function AccessControl() {
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroup, setSelectedGroup] = useState<AccessGroup | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<{ id: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsOpen, setPermsOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);

  useEffect(() => {
    getAccessGroups()
      .then(setGroups)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getMembers().then((members) =>
      setMemberEmails(
        members
          .filter((m) => m.daliEmail)
          .map((m) => ({ id: m.id, email: m.daliEmail! }))
      )
    ).catch(() => {});
  }, []);

  // Keep selectedGroup in sync with groups state
  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find((g) => g.id === selectedGroup.id);
      if (updated) setSelectedGroup(updated);
    }
  }, [groups]);

  async function handleCreateGroup() {
    if (!newGroup.name.trim()) return;
    setSaving(true);
    try {
      const group = await createAccessGroup({ name: newGroup.name.trim(), description: newGroup.description.trim() || undefined });
      setGroups((prev) => [...prev, group]);
      setNewGroup({ name: "", description: "" });
      setCreatingGroup(false);
      setSelectedGroup(group);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    try {
      await deleteAccessGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedGroup?.id === id) setSelectedGroup(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAddUser() {
    const email = userInput.trim();
    if (!email || !selectedGroup) return;

    // Find user id by email — look in members list first
    const match = memberEmails.find((m) => m.email === email);
    if (!match) {
      setError(`No member found with email: ${email}`);
      return;
    }

    if (selectedGroup.members.some((m) => m.member.daliEmail === email)) {
      setUserInput("");
      return;
    }

    setSaving(true);
    try {
      const updated = await addAccessGroupMember(selectedGroup.id, match.id);
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setSelectedGroup(updated);
      setUserInput("");
      setAddingUser(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePermission(key: string) {
    if (!selectedGroup) return;
    const has = selectedGroup.permissions.includes(key);
    const permissions = has
      ? selectedGroup.permissions.filter((p) => p !== key)
      : [...selectedGroup.permissions, key];
    setSavingPerms(true);
    try {
      const updated = await patchAccessGroup(selectedGroup.id, { permissions });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setSelectedGroup(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingPerms(false);
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!selectedGroup) return;
    try {
      await removeAccessGroupMember(selectedGroup.id, userId);
      const updated = { ...selectedGroup, members: selectedGroup.members.filter((m) => m.memberId !== userId) };
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      setSelectedGroup(updated);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="h-5 w-5 text-[#00C795]" />
          <h1 className="text-xl font-semibold text-gray-900">Access Control</h1>
        </div>
        <p className="text-sm text-gray-500">Manage user groups and assign members to control permissions.</p>
        {error && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            {error}
            <button onClick={() => setError(null)} className="ml-1 text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
          </p>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Groups panel */}
        <div className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">User Groups</p>
            <button
              onClick={() => { setCreatingGroup(true); setSelectedGroup(null); }}
              className="flex items-center gap-1 text-xs text-[#00C795] hover:text-[#00b085] font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Group
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {groups.length === 0 && !creatingGroup && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No groups yet.</p>
            )}
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => { setSelectedGroup(group); setCreatingGroup(false); setAddingUser(false); }}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors group",
                  selectedGroup?.id === group.id
                    ? "bg-gray-50 border-r-2 border-[#00C795]"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium truncate", selectedGroup?.id === group.id ? "text-gray-900" : "text-gray-700")}>
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {group.members.length} {group.members.length === 1 ? "member" : "members"}
                  </p>
                </div>
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition-colors", selectedGroup?.id === group.id ? "text-[#00C795]" : "text-gray-300 group-hover:text-gray-400")} />
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {creatingGroup ? (
            <div className="max-w-lg mx-auto px-8 py-8">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Create User Group</h2>
              <p className="text-sm text-gray-500 mb-6">Groups let you manage access for multiple users at once.</p>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                <div className="px-5 py-4 space-y-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Group Name</label>
                  <input
                    autoFocus
                    placeholder="e.g. Dev Leads"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup((s) => ({ ...s, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="px-5 py-4 space-y-1">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                  <input
                    placeholder="What does this group have access to?"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup((s) => ({ ...s, description: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                    className="w-full text-sm text-gray-900 bg-transparent border-0 outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroup.name.trim() || saving}
                  className="px-4 py-2 rounded-lg bg-[#00C795] text-white text-sm font-medium hover:bg-[#00b085] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Create Group
                </button>
                <button
                  onClick={() => { setCreatingGroup(false); setNewGroup({ name: "", description: "" }); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedGroup ? (
            <div className="max-w-2xl mx-auto px-8 py-8">
              {/* Group header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{selectedGroup.name}</h2>
                  {selectedGroup.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{selectedGroup.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete group
                </button>
              </div>

              {/* Permissions section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
                <button
                  onClick={() => setPermsOpen((o) => !o)}
                  className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <Lock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 flex-1 text-left">Permissions</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full mr-2">
                    {selectedGroup.permissions.length}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", permsOpen ? "rotate-0" : "-rotate-90")} />
                </button>
                {permsOpen && <ul className="divide-y divide-gray-50 border-t border-gray-100">
                  {ALL_PERMISSIONS.map(({ key, label, description }) => {
                    const enabled = selectedGroup.permissions.includes(key);
                    return (
                      <li
                        key={key}
                        onClick={() => !savingPerms && handleTogglePermission(key)}
                        className={cn("flex items-center justify-between px-5 py-3 transition-colors", savingPerms ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-gray-50")}
                      >
                        <div>
                          <p className={cn("text-sm font-medium", enabled ? "text-gray-900" : "text-gray-400")}>{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                        </div>
                        <div className={cn(
                          "w-8 h-4.5 rounded-full relative shrink-0 transition-colors",
                          enabled ? "bg-[#00C795]" : "bg-gray-200"
                        )}
                          style={{ width: 32, height: 18 }}
                        >
                          <span className={cn(
                            "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform",
                            enabled ? "translate-x-[14px]" : "translate-x-0.5"
                          )} />
                        </div>
                      </li>
                    );
                  })}
                </ul>}
              </div>

              {/* Members section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <button
                    onClick={() => setMembersOpen((o) => !o)}
                    className="flex items-center gap-2 flex-1 hover:opacity-70 transition-opacity"
                  >
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Members</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {selectedGroup.members.length}
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform ml-1", membersOpen ? "rotate-0" : "-rotate-90")} />
                  </button>
                  <button
                    onClick={() => setAddingUser(true)}
                    className="flex items-center gap-1 text-xs text-[#00C795] hover:text-[#00b085] font-medium transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add user
                  </button>
                </div>

                {membersOpen && <>
                {/* Add user row */}
                {addingUser && (
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                    <input
                      autoFocus
                      list="user-suggestions"
                      placeholder="DALI email address"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddUser();
                        if (e.key === "Escape") { setAddingUser(false); setUserInput(""); }
                      }}
                      className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-[#00C795] bg-white"
                    />
                    <datalist id="user-suggestions">
                      {memberEmails.map((m) => <option key={m.id} value={m.email} />)}
                    </datalist>
                    <button
                      onClick={handleAddUser}
                      disabled={!userInput.trim() || saving}
                      className="px-3 py-1.5 rounded-lg bg-[#00C795] text-white text-xs font-medium hover:bg-[#00b085] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingUser(false); setUserInput(""); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {selectedGroup.members.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No members in this group yet.</p>
                    <button
                      onClick={() => setAddingUser(true)}
                      className="mt-2 text-xs text-[#00C795] hover:text-[#00b085] font-medium transition-colors"
                    >
                      Add the first member
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {selectedGroup.members.map((m) => {
                      const displayName = m.member.fullName || m.member.daliEmail;
                      return (
                        <li key={m.memberId} className="flex items-center justify-between px-5 py-3 group hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-[#E6FAF5] flex items-center justify-center overflow-hidden shrink-0">
                              {m.member.imageUrl ? (
                                <img src={m.member.imageUrl} alt={displayName} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-semibold text-[#00C795]">
                                  {m.member.daliEmail[0].toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-700">{displayName}</p>
                              {displayName !== m.member.daliEmail && (
                                <p className="text-xs text-gray-400">{m.member.daliEmail}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveUser(m.memberId)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-400 transition-all"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                </>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <ShieldCheck className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">Select a group to manage members</p>
              <p className="text-xs text-gray-300 mt-1">or create a new group to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
