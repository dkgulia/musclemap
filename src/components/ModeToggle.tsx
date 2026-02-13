"use client";

import { useApp } from "@/context/AppContext";
import { motion } from "framer-motion";

export default function ModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toggleMode } = useApp();

  return (
    <button
      onClick={toggleMode}
      className="relative flex items-center rounded-full bg-text/[0.06] h-7 w-[108px] cursor-pointer select-none"
      aria-label={`Switch to ${mode === "simple" ? "pro" : "simple"} mode`}
    >
      <motion.div
        className="absolute top-[3px] h-[22px] w-[50px] rounded-full bg-text/[0.12]"
        animate={{ left: mode === "simple" ? 3 : 55 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
      <span
        className={`relative z-10 flex-1 text-center text-[11px] tracking-wide transition-colors ${
          mode === "simple" ? "text-text" : "text-muted"
        }`}
      >
        {compact ? "Sim" : "Simple"}
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-[11px] tracking-wide transition-colors ${
          mode === "pro" ? "text-text" : "text-muted"
        }`}
      >
        Pro
      </span>
    </button>
  );
}
