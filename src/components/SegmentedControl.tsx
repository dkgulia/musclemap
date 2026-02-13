"use client";

import { motion } from "framer-motion";

interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

export default function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const activeIdx = options.indexOf(value);

  return (
    <div className="relative flex items-center rounded-xl bg-surface border border-border p-1 gap-0.5">
      <motion.div
        className="absolute top-1 bottom-1 rounded-lg bg-text/[0.08]"
        animate={{
          left: `calc(${(activeIdx / options.length) * 100}% + 4px)`,
          width: `calc(${100 / options.length}% - 8px)`,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`relative z-10 flex-1 text-center text-xs py-2 px-1 rounded-lg transition-colors cursor-pointer ${
            value === opt ? "text-text" : "text-muted"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
