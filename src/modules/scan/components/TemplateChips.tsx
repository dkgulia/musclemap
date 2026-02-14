"use client";

import { useApp } from "@/context/AppContext";
import { isCheckinTemplate } from "@/modules/scan/models/poseTemplates";
import { motion } from "framer-motion";

export default function TemplateChips() {
  const { templates, selectedTemplateId, setSelectedTemplateId, mode } = useApp();

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 py-3">
      {templates.map((t) => {
        const active = selectedTemplateId === t.id;
        const checkin = isCheckinTemplate(t.id);
        return (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedTemplateId(t.id)}
            className={`relative flex-shrink-0 px-4 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
              active
                ? "bg-accent text-accent-fg"
                : "bg-text/[0.05] text-text2 hover:text-text"
            }`}
          >
            {t.label}
            {checkin && (
              <span className={`ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                active ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-500/10 text-emerald-500"
              }`}>
                CHECK-IN
              </span>
            )}
            {t.pro && mode === "pro" && (
              <span className={`ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                active ? "bg-accent-fg/10 text-accent-fg/50" : "bg-text/[0.06] text-muted"
              }`}>
                PRO
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
