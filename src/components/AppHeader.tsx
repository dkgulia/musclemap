"use client";

import ModeToggle from "./ModeToggle";
import ThemeToggle from "./ThemeToggle";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-5 h-14 bg-bg/80 backdrop-blur-xl border-b border-border">
      <span className="font-display text-sm font-bold tracking-tight text-text">
        MuscleMap
      </span>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <ModeToggle />
      </div>
    </header>
  );
}
