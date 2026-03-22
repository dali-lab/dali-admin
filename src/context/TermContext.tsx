import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCurrentTerm, getTerms, createTerm } from "@/lib/api";
import type { Term } from "@/lib/api";

interface TermContextValue {
  currentTerm: string;          // the active term name used across pages
  setCurrentTerm: (name: string) => void;
  terms: Term[];
  reloadTerms: () => Promise<Term[]>;
  addTerm: (data: { name: string; startDate: string; endDate: string }) => Promise<void>;
  termsLoaded: boolean;
}

const TermContext = createContext<TermContextValue | null>(null);

const STORAGE_KEY = "dali_admin_current_term";

export function TermProvider({ children }: { children: React.ReactNode }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentTerm, setCurrentTermState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? ""
  );
  const [termsLoaded, setTermsLoaded] = useState(false);

  const setCurrentTerm = useCallback((name: string) => {
    setCurrentTermState(name);
    localStorage.setItem(STORAGE_KEY, name);
  }, []);

  const reloadTerms = useCallback(async () => {
    const data = await getTerms();
    setTerms(data);
    return data;
  }, []);

  useEffect(() => {
    async function init() {
      const saved = localStorage.getItem(STORAGE_KEY);
      const [data, current] = await Promise.all([
        getTerms().catch(() => [] as Term[]),
        getCurrentTerm(),
      ]);
      setTerms(data);
      // Use saved selection if present, otherwise GET /terms/current (DB `isCurrent` or date range), then most-recent
      if (!saved) {
        if (current) {
          setCurrentTerm(current.name);
        } else if (data.length > 0) {
          setCurrentTerm(data[0].name);
        }
      }
      setTermsLoaded(true);
    }
    init();
  }, [setCurrentTerm]);

  const addTerm = useCallback(async (data: { name: string; startDate: string; endDate: string }) => {
    const created = await createTerm(data);
    setTerms(prev => [created, ...prev]);
    setCurrentTerm(created.name);
  }, [setCurrentTerm]);

  return (
    <TermContext.Provider value={{ currentTerm, setCurrentTerm, terms, reloadTerms, addTerm, termsLoaded }}>
      {children}
    </TermContext.Provider>
  );
}

export function useTermContext() {
  const ctx = useContext(TermContext);
  if (!ctx) throw new Error("useTermContext must be used within TermProvider");
  return ctx;
}
