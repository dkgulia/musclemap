"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Mode = "simple" | "pro";

export interface Template {
  id: string;
  label: string;
  pro: boolean;
}

export const TEMPLATES: Template[] = [
  { id: "front-biceps", label: "Front Biceps", pro: false },
  { id: "back-lats", label: "Back Lats", pro: false },
  { id: "side-glute", label: "Side Glute", pro: true },
  { id: "back-glute", label: "Back Glute", pro: true },
];

interface AppState {
  mode: Mode;
  toggleMode: () => void;
  setMode: (m: Mode) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  alignmentScore: number;
  setAlignmentScore: (s: number) => void;
  isReady: boolean;
  templates: Template[];
  userHeightCm: number | null;
  setUserHeightCm: (h: number | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("simple");
  const [selectedTemplateId, setSelectedTemplateId] = useState("front-biceps");
  const [alignmentScore, setAlignmentScore] = useState(72);
  const [userHeightCm, setUserHeightCmState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("musclemap_height_cm");
    return stored ? Number(stored) : null;
  });

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "simple" ? "pro" : "simple"));
  }, []);

  const setUserHeightCm = useCallback((h: number | null) => {
    setUserHeightCmState(h);
    if (h !== null) {
      localStorage.setItem("musclemap_height_cm", String(h));
    } else {
      localStorage.removeItem("musclemap_height_cm");
    }
  }, []);

  const isReady = alignmentScore >= 80;

  const templates =
    mode === "simple"
      ? TEMPLATES.filter((t) => !t.pro)
      : TEMPLATES;

  return (
    <AppContext.Provider
      value={{
        mode,
        toggleMode,
        setMode,
        selectedTemplateId,
        setSelectedTemplateId,
        alignmentScore,
        setAlignmentScore,
        isReady,
        templates,
        userHeightCm,
        setUserHeightCm,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
