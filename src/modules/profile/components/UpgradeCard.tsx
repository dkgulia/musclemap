"use client";

import { useApp } from "@/context/AppContext";
import Card from "@/components/Card";

export default function UpgradeCard() {
  const { mode } = useApp();

  if (mode !== "pro") return null;

  return (
    <Card className="relative overflow-hidden !border-accent/10">
      <div className="absolute top-0 right-0 w-40 h-40 bg-text/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-medium text-text2 bg-text/[0.06] px-2 py-0.5 rounded-md uppercase tracking-wider">
            Pro
          </span>
          <span className="text-sm text-text">Unlock Everything</span>
        </div>
        <p className="text-[11px] text-text2 mb-4 leading-relaxed">
          All 4 pose templates, weekly reports, trend exports, and priority support.
        </p>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-semibold text-text">$4.99</span>
          <span className="text-xs text-muted">/month</span>
        </div>
        <button className="w-full py-3 rounded-xl bg-accent text-accent-fg text-sm font-medium hover:opacity-90 transition-colors cursor-pointer">
          Upgrade to Pro
        </button>
        <p className="text-[10px] text-muted text-center mt-2">Cancel anytime. 7-day free trial.</p>
      </div>
    </Card>
  );
}
