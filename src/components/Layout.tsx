import { useState } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";
import { Users, FolderOpen, Inbox, ChevronDown, Plus, X, Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTermContext } from "@/context/TermContext";

const navItems = [
  {
    to: "/members",
    label: "Members",
    icon: Users,
    subtabs: [
      { to: "/members/access-control", label: "Access Control", icon: ShieldCheck },
      { to: "/members/mentorship", label: "Mentorship", icon: Users },
    ],
  },
  { to: "/projects", 
    label: "Projects", 
    icon: FolderOpen,
    subtabs: [
      { to: "/projects/assignments", label: "Assignments", icon: Inbox },
    ],
  },
  {
    to: "/hiring",
    label: "Hiring",
    icon: Users,
  }
];

function NavItem({ item }: { item: typeof navItems[number] }) {
  /** Only the parent path itself (e.g. /members), not child routes — avoids highlighting the section header on subpages */
  const isParentExact = !!useMatch({ path: item.to, end: true });
  const [subtabsOpen, setSubtabsOpen] = useState(true);

  return (
    <div>
      <div
        className={cn(
          "group flex items-stretch rounded-md transition-colors duration-150",
          isParentExact
            ? "bg-white/[0.07]"
            : "hover:bg-white/[0.04]"
        )}
      >
        <NavLink
          to={item.to}
          end
          className={cn(
            "flex flex-1 min-w-0 items-center gap-3 px-3 py-2 text-sm font-medium transition-colors duration-150",
            item.subtabs ? "rounded-none" : "rounded-md",
            isParentExact
              ? "text-white"
              : "text-[#A0A3B1] group-hover:text-white"
          )}
        >
          <item.icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-150",
              isParentExact ? "text-[#00C795]" : "text-[#A0A3B1] group-hover:text-white"
            )}
          />
          {item.label}
        </NavLink>

        {item.subtabs && (
          <button
            type="button"
            aria-expanded={subtabsOpen}
            aria-label={subtabsOpen ? `Collapse ${item.label} subpages` : `Expand ${item.label} subpages`}
            onClick={() => setSubtabsOpen((o) => !o)}
            className={cn(
              "shrink-0 flex items-center justify-center w-8 rounded-none transition-colors duration-150",
              isParentExact
                ? "text-[#00C795]"
                : "text-[#A0A3B1] group-hover:text-white"
            )}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-150", subtabsOpen ? "rotate-180" : "rotate-0")}
            />
          </button>
        )}
      </div>

      {item.subtabs && subtabsOpen && (
        <div className="ml-3 mt-1 pl-3 border-l border-[#2A2D3E] space-y-0.5">
          {item.subtabs.map((sub) => (
            <NavLink
              key={sub.to}
              to={sub.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
                  isActive
                    ? "text-[#00C795] bg-white/[0.07]"
                    : "text-[#A0A3B1] hover:bg-white/[0.04] hover:text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <sub.icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-[#00C795]" : "text-[#A0A3B1]"
                    )}
                  />
                  {sub.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { currentTerm, setCurrentTerm, terms, addTerm } = useTermContext();
  const [termOpen, setTermOpen] = useState(false);
  const [addingTerm, setAddingTerm] = useState(false);
  const [newTerm, setNewTerm] = useState({ name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleAddTerm() {
    if (!newTerm.name.trim() || !newTerm.startDate || !newTerm.endDate) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addTerm(newTerm);
      setNewTerm({ name: "", startDate: "", endDate: "" });
      setAddingTerm(false);
      setTermOpen(false);
    } catch (e: any) {
      setSaveError(e.message ?? "Failed to create term");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex flex-col w-56 shrink-0 bg-[#0F1117] text-white overflow-y-auto">
        {/* Logo / branding */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#2A2D3E]">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#00C795]">
            <span className="text-white font-bold text-xs">D</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">DALI Lab</p>
            <p className="text-[#A0A3B1] text-xs">Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A0A3B1] mb-2">
            Navigation
          </p>
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        {/* Term selector */}
        <div className="px-3 py-4 border-t border-[#2A2D3E]">
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#A0A3B1]">
            Current Term
          </p>

          <div className="relative">
            <div className="flex gap-1">
              <button
                onClick={() => { setTermOpen(o => !o); setAddingTerm(false); }}
                className="flex-1 flex items-center justify-between px-3 py-2 rounded-md bg-[#1A1D27] text-sm text-white hover:bg-[#1E2130] transition-colors"
              >
                <span className="font-medium text-[#00C795]">{currentTerm || "—"}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-[#A0A3B1] transition-transform", termOpen && "rotate-180")} />
              </button>
              <button
                onClick={() => { setAddingTerm(o => !o); setTermOpen(false); setSaveError(null); }}
                title="Add term"
                className="flex items-center justify-center w-8 h-8 rounded-md bg-[#1A1D27] text-[#A0A3B1] hover:bg-[#1E2130] hover:text-[#00C795] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Term dropdown */}
            {termOpen && terms.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-[#1A1D27] border border-[#2A2D3E] rounded-md shadow-xl max-h-48 overflow-y-auto z-50">
                {terms.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setCurrentTerm(t.name); setTermOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors",
                      currentTerm === t.name
                        ? "text-[#00C795] bg-[#0F2A20] font-medium"
                        : "text-[#A0A3B1] hover:bg-[#1E2130] hover:text-white"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add term form */}
          {addingTerm && (
            <div className="mt-2 p-3 bg-[#1A1D27] rounded-md space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-[#A0A3B1]">New Term</p>
                <button onClick={() => { setAddingTerm(false); setSaveError(null); }}>
                  <X className="h-3.5 w-3.5 text-[#A0A3B1] hover:text-white" />
                </button>
              </div>
              <input
                placeholder="Name (e.g. 26W)"
                value={newTerm.name}
                onChange={e => setNewTerm(s => ({ ...s, name: e.target.value }))}
                className="w-full px-2 py-1.5 rounded bg-[#0F1117] border border-[#2A2D3E] text-white text-xs placeholder:text-[#505368] focus:outline-none focus:border-[#00C795]"
              />
              <input
                type="date"
                value={newTerm.startDate}
                onChange={e => setNewTerm(s => ({ ...s, startDate: e.target.value }))}
                className="w-full px-2 py-1.5 rounded bg-[#0F1117] border border-[#2A2D3E] text-white text-xs focus:outline-none focus:border-[#00C795]"
              />
              <input
                type="date"
                value={newTerm.endDate}
                onChange={e => setNewTerm(s => ({ ...s, endDate: e.target.value }))}
                className="w-full px-2 py-1.5 rounded bg-[#0F1117] border border-[#2A2D3E] text-white text-xs focus:outline-none focus:border-[#00C795]"
              />
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              <button
                onClick={handleAddTerm}
                disabled={saving || !newTerm.name.trim() || !newTerm.startDate || !newTerm.endDate}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#00C795] text-white text-xs font-medium hover:bg-[#00b085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Create
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2A2D3E]">
          <p className="text-[#A0A3B1] text-xs">dali-os internal</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
