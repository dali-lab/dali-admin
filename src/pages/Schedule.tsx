/**
 * Schedule — interview calendar for the hiring process.
 *
 * Displays a monthly calendar. Each day can have interview slots.
 * Each slot shows: time, applicant name, interviewer (member) name.
 * Slots are stored in localStorage until a backend table is added.
 */

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  User,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterviewSlot {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  applicantName: string;
  interviewerName: string;
  notes?: string;
}

const STORAGE_KEY = "dali_interview_slots";

function loadSlots(): InterviewSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSlots(slots: InterviewSlot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Add slot modal ───────────────────────────────────────────────────────────

function AddSlotModal({
  date,
  onAdd,
  onClose,
}: {
  date: string;
  onAdd: (slot: InterviewSlot) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    time: "10:00",
    applicantName: "",
    interviewerName: "",
    notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.applicantName.trim() || !form.interviewerName.trim()) return;
    onAdd({
      id: newId(),
      date,
      time: form.time,
      applicantName: form.applicantName.trim(),
      interviewerName: form.interviewerName.trim(),
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[95vw]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Add Interview Slot</p>
            <p className="text-xs text-gray-500 mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Time</Label>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="h-8 text-sm"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Applicant Name</Label>
            <Input
              value={form.applicantName}
              onChange={(e) => setForm((f) => ({ ...f, applicantName: e.target.value }))}
              placeholder="e.g. Jane Smith"
              className="h-8 text-sm"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Interviewer</Label>
            <Input
              value={form.interviewerName}
              onChange={(e) => setForm((f) => ({ ...f, interviewerName: e.target.value }))}
              placeholder="e.g. Alex Johnson"
              className="h-8 text-sm"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Add any notes..."
              className="h-8 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              size="sm"
              disabled={!form.applicantName.trim() || !form.interviewerName.trim()}
              className="bg-[#00C795] hover:bg-[#00b085] text-white"
            >
              Add Slot
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Day detail panel ─────────────────────────────────────────────────────────

function DayPanel({
  date,
  slots,
  onAdd,
  onDelete,
  onClose,
}: {
  date: string;
  slots: InterviewSlot[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const sorted = [...slots].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="w-80 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">{displayDate}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {sorted.length} slot{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No slots scheduled</p>
        ) : (
          sorted.map((slot) => (
            <div key={slot.id} className="group rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00C795]">
                  <Clock className="h-3.5 w-3.5" />
                  {slot.time}
                </div>
                <button
                  onClick={() => onDelete(slot.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-800 font-medium truncate">{slot.applicantName}</p>
                </div>
                <p className="text-xs text-gray-500 pl-5">with {slot.interviewerName}</p>
              </div>
              {slot.notes && (
                <p className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                  {slot.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#00C795] hover:text-[#00C795] hover:bg-[#E6FFF9] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Slot
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Schedule() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [slots, setSlots] = useState<InterviewSlot[]>(loadSlots);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addingToDate, setAddingToDate] = useState<string | null>(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function addSlot(slot: InterviewSlot) {
    const updated = [...slots, slot];
    setSlots(updated);
    saveSlots(updated);
    setSelectedDate(slot.date);
  }

  function deleteSlot(id: string) {
    const updated = slots.filter((s) => s.id !== id);
    setSlots(updated);
    saveSlots(updated);
  }

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [viewYear, viewMonth]);

  // Slot counts per date
  const slotsByDate = useMemo(() => {
    const map: Record<string, InterviewSlot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [slots]);

  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  // Total slots this month
  const monthSlotCount = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`;
    return slots.filter((s) => s.date.startsWith(prefix)).length;
  }, [slots, viewYear, viewMonth]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Interview Schedule</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {monthSlotCount} interview{monthSlotCount !== 1 ? "s" : ""} in {MONTH_NAMES[viewMonth]} {viewYear}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold text-gray-900 min-w-36 text-center">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => setAddingToDate(todayKey)}
              className="h-8 text-xs bg-[#00C795] hover:bg-[#00b085] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Slot
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-auto p-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              const dateKey = formatDateKey(viewYear, viewMonth, day);
              const daySlots = slotsByDate[dateKey] ?? [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className={cn(
                    "aspect-square rounded-xl p-1.5 text-left flex flex-col transition-all border",
                    isSelected
                      ? "border-[#00C795] bg-[#E6FFF9] shadow-sm"
                      : isToday
                      ? "border-[#00C795]/40 bg-[#E6FFF9]/50 hover:border-[#00C795]"
                      : daySlots.length > 0
                      ? "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                      : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium leading-none mb-auto",
                      isToday ? "text-[#00C795] font-bold" : "text-gray-700"
                    )}
                  >
                    {day}
                  </span>

                  {daySlots.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {daySlots.slice(0, 2).map((s) => (
                        <div
                          key={s.id}
                          className="text-[9px] leading-tight bg-[#00C795]/15 text-[#00A87A] rounded px-1 py-0.5 truncate font-medium"
                        >
                          {s.time} {s.applicantName.split(" ")[0]}
                        </div>
                      ))}
                      {daySlots.length > 2 && (
                        <p className="text-[9px] text-gray-400 leading-none px-1">
                          +{daySlots.length - 2} more
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <DayPanel
          date={selectedDate}
          slots={selectedSlots}
          onAdd={() => setAddingToDate(selectedDate)}
          onDelete={deleteSlot}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* Add slot modal */}
      {addingToDate && (
        <AddSlotModal
          date={addingToDate}
          onAdd={addSlot}
          onClose={() => setAddingToDate(null)}
        />
      )}
    </div>
  );
}
