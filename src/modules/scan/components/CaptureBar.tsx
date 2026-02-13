"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isReady: boolean;
  onCapture: () => void;
}

export default function CaptureBar({ isReady, onCapture }: Props) {
  const [justLogged, setJustLogged] = useState(false);

  const handleCapture = () => {
    if (!isReady || justLogged) return;
    onCapture();
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 2000);
  };

  return (
    <div className="px-5">
      <AnimatePresence mode="wait">
        {justLogged ? (
          <motion.div
            key="logged"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="w-full py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-center"
          >
            <span className="text-xs font-medium text-accent">Scan logged successfully</span>
          </motion.div>
        ) : isReady ? (
          <motion.button
            key="capture"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCapture}
            className="w-full py-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Log Scan
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
