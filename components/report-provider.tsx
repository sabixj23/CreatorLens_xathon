"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { loadReport, type Report } from "@/lib/api";
import { getChosenPath, setChosenPath } from "@/lib/storage";
import type { PathId } from "@/lib/types";

type State = { status: "loading"; report?: never } | { status: "unauthenticated"; report?: never } | { status: "ready"; report: Report };
type Context = { state: State; selected: PathId; select: (path: PathId) => void; retry: () => void; href: (path: string, hash?: string) => string };
const ReportContext = createContext<Context | null>(null);
export function ReportProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const connect = params.get("connect") === "1";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  const [selected, setSelected] = useState<PathId>("B");
  useEffect(() => { setSelected(getChosenPath()); }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (connect && !demo) { setState({ status: "unauthenticated" }); return () => controller.abort(); }
    setState({ status: "loading" });
    loadReport(demo, controller.signal).then(result => {
      if (!controller.signal.aborted) setState(result);
    }).catch(() => { /* Navigation aborted this request; the next view owns its state. */ });
    return () => controller.abort();
  }, [demo, connect, attempt]);
  const select = useCallback((path: PathId) => { setSelected(path); setChosenPath(path); }, []);
  const href = (path: string, hash?: string) => `${path}${demo || state.report?.source === "demo" ? "?demo=1" : ""}${hash ? `#${hash}` : ""}`;
  return <ReportContext.Provider value={{ state, selected, select, retry: () => setAttempt(n => n + 1), href }}>{children}</ReportContext.Provider>;
}
export function useReport() {
  const value = useContext(ReportContext);
  if (!value) throw new Error("A report provider is required.");
  return value;
}
