/**
 * ApplicationForm — per-domain question editor for the DALI application form.
 *
 * Each domain can manage their own set of custom questions.
 * Questions are stored in localStorage (keyed by domain) until a backend
 * table is added.
 */

import { useState } from "react";
import { Plus, Trash2, GripVertical, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

const DOMAINS = [
  "Fullstack",
  "Data",
  "Engines",
  "AR/VR",
  "UI/UX",
  "Video",
  "PM",
  "3D Modeling",
  "Animation",
] as const;

type Domain = typeof DOMAINS[number];

const QUESTION_TYPES = ["short_text", "long_text", "multiple_choice", "checkbox", "url"] as const;
type QuestionType = typeof QUESTION_TYPES[number];

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short_text: "Short Answer",
  long_text: "Long Answer",
  multiple_choice: "Multiple Choice",
  checkbox: "Checkboxes",
  url: "URL",
};

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[]; // for multiple_choice / checkbox
}

type DomainQuestions = Record<Domain, Question[]>;

const STORAGE_KEY = "dali_application_form_questions";
const COMMON_STORAGE_KEY = "dali_application_form_common_questions";

function loadFromStorage(): DomainQuestions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const empty: Partial<DomainQuestions> = {};
  DOMAINS.forEach((d) => (empty[d] = []));
  return empty as DomainQuestions;
}

function saveToStorage(data: DomainQuestions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadCommonFromStorage(): Question[] {
  try {
    const raw = localStorage.getItem(COMMON_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveCommonToStorage(qs: Question[]) {
  localStorage.setItem(COMMON_STORAGE_KEY, JSON.stringify(qs));
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  onUpdate,
  onDelete,
}: {
  question: Question;
  index: number;
  onUpdate: (q: Question) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question);
  const [newOption, setNewOption] = useState("");

  function commitEdit() {
    if (!draft.text.trim()) return;
    onUpdate(draft);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(question);
    setEditing(false);
  }

  function addOption() {
    if (!newOption.trim()) return;
    setDraft((d) => ({ ...d, options: [...(d.options ?? []), newOption.trim()] }));
    setNewOption("");
  }

  function removeOption(i: number) {
    setDraft((d) => ({ ...d, options: d.options?.filter((_, idx) => idx !== i) }));
  }

  const needsOptions = draft.type === "multiple_choice" || draft.type === "checkbox";

  return (
    <div className={cn(
      "rounded-xl border bg-white transition-shadow",
      editing ? "border-[#00C795] shadow-md" : "border-gray-200 hover:border-gray-300"
    )}>
      {editing ? (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 w-5 shrink-0">{index + 1}.</span>
            <Input
              autoFocus
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              placeholder="Question text..."
              className="h-8 text-sm flex-1"
            />
          </div>

          <div className="flex items-center gap-3 pl-7">
            <Select value={draft.type} onValueChange={(v) => setDraft((d) => ({ ...d, type: v as QuestionType }))}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{QUESTION_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
                className="rounded"
              />
              Required
            </label>
          </div>

          {needsOptions && (
            <div className="pl-7 space-y-2">
              <Label className="text-xs text-gray-500">Options</Label>
              {(draft.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const opts = [...(draft.options ?? [])];
                      opts[i] = e.target.value;
                      setDraft((d) => ({ ...d, options: opts }));
                    }}
                    className="h-7 text-xs flex-1"
                  />
                  <button onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addOption()}
                  placeholder="Add option..."
                  className="h-7 text-xs flex-1"
                />
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addOption}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pl-7">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs bg-[#00C795] hover:bg-[#00b085] text-white" onClick={commitEdit}>
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 group">
          <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 shrink-0 cursor-grab" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-gray-800">
                <span className="text-gray-400 font-medium mr-1.5">{index + 1}.</span>
                {question.text}
                {question.required && <span className="text-red-400 ml-0.5">*</span>}
              </p>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setDraft(question); setEditing(true); }}
                  className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={onDelete} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {QUESTION_TYPE_LABEL[question.type]}
              </span>
              {(question.type === "multiple_choice" || question.type === "checkbox") && (question.options ?? []).length > 0 && (
                <span className="text-[10px] text-gray-400">
                  {question.options!.length} option{question.options!.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type ActiveSection = "common" | Domain;

export default function ApplicationForm() {
  const [domainQuestions, setDomainQuestions] = useState<DomainQuestions>(loadFromStorage);
  const [commonQuestions, setCommonQuestionsState] = useState<Question[]>(loadCommonFromStorage);
  const [activeSection, setActiveSection] = useState<ActiveSection>("common");
  const [saved, setSaved] = useState(false);

  const isCommon = activeSection === "common";
  const questions = isCommon ? commonQuestions : (domainQuestions[activeSection as Domain] ?? []);

  function setQuestions(qs: Question[]) {
    if (isCommon) {
      setCommonQuestionsState(qs);
    } else {
      setDomainQuestions((prev) => ({ ...prev, [activeSection as Domain]: qs }));
    }
  }

  function handleSave() {
    saveToStorage(domainQuestions);
    saveCommonToStorage(commonQuestions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addQuestion() {
    const q: Question = { id: newId(), text: "", type: "long_text", required: false };
    setQuestions([...questions, q]);
  }

  function updateQuestion(id: string, updated: Question) {
    setQuestions(questions.map((q) => (q.id === id ? updated : q)));
  }

  function deleteQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id));
  }

  const sectionLabel = isCommon ? "Common" : activeSection as string;
  const emptyHint = isCommon
    ? "Questions here appear on every application, regardless of domain"
    : `Click "Add Question" to get started`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Application Form</h1>
          <p className="text-xs text-gray-500 mt-0.5">Customize questions per domain</p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          className={cn(
            "h-8 text-xs transition-colors",
            saved ? "bg-green-500 hover:bg-green-600 text-white" : "bg-[#00C795] hover:bg-[#00b085] text-white"
          )}
        >
          {saved ? <><Check className="h-3.5 w-3.5 mr-1.5" /> Saved</> : "Save Changes"}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="px-3 py-3 space-y-4">
            {/* Common section */}
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                General
              </p>
              <button
                onClick={() => setActiveSection("common")}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                  activeSection === "common"
                    ? "bg-white shadow-sm text-gray-900 font-medium border border-[#00C795]/40"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                )}
              >
                <span className="truncate">Common</span>
                {commonQuestions.length > 0 && (
                  <span className="text-[10px] bg-[#00C795]/15 text-[#00A87A] px-1.5 py-0.5 rounded-full font-medium">
                    {commonQuestions.length}
                  </span>
                )}
              </button>
            </div>

            {/* Domain sections */}
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Domains
              </p>
              {DOMAINS.map((domain) => {
                const count = (domainQuestions[domain] ?? []).length;
                return (
                  <button
                    key={domain}
                    onClick={() => setActiveSection(domain)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === domain
                        ? "bg-white shadow-sm text-gray-900 font-medium border border-gray-200"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    )}
                  >
                    <span className="truncate">{domain}</span>
                    {count > 0 && (
                      <span className="text-[10px] bg-[#00C795]/15 text-[#00A87A] px-1.5 py-0.5 rounded-full font-medium">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Question editor */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{sectionLabel}</h2>
                {isCommon && (
                  <p className="text-xs text-gray-400 mt-0.5">Shown to all applicants regardless of domain</p>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {questions.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center px-6">
                <p className="text-sm text-gray-400">No questions yet{isCommon ? "" : ` for ${sectionLabel}`}</p>
                <p className="text-xs text-gray-400 mt-1">{emptyHint}</p>
              </div>
            )}

            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                onUpdate={(updated) => updateQuestion(q.id, updated)}
                onDelete={() => deleteQuestion(q.id)}
              />
            ))}

            <button
              onClick={addQuestion}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#00C795] hover:text-[#00C795] hover:bg-[#E6FFF9] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
