"use client";

import { useApp } from "@/context/AppContext";
import ModeToggle from "@/components/ModeToggle";
import Card from "@/components/Card";
import StreakCard from "@/modules/profile/components/StreakCard";
import SettingsList from "@/modules/profile/components/SettingsList";
import UpgradeCard from "@/modules/profile/components/UpgradeCard";

export default function ProfilePage() {
  const { mode, userHeightCm, setUserHeightCm } = useApp();

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* User section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Profile</h2>
          <p className="text-[11px] text-muted mt-0.5">Manage your settings</p>
        </div>
        <ModeToggle />
      </div>

      <StreakCard />

      <Card>
        <p className="text-sm text-text mb-1">Body Measurements</p>
        <p className="text-[11px] text-muted mb-3">
          Enter your height for calibrated real-world measurements.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text2 shrink-0">Height</label>
          <input
            type="number"
            inputMode="decimal"
            min={100}
            max={250}
            step={1}
            value={userHeightCm ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setUserHeightCm(v ? Number(v) : null);
            }}
            placeholder="175"
            className="flex-1 bg-text/[0.04] border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/50"
          />
          <span className="text-xs text-muted shrink-0">cm</span>
        </div>
      </Card>

      <UpgradeCard />

      {mode === "pro" && (
        <button className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-muted hover:text-text2 transition-colors cursor-pointer">
          Export All Data
        </button>
      )}

      <SettingsList />

      <p className="text-[10px] text-muted text-center pt-2">
        MuscleMap v0.1.0 &middot; {mode === "pro" ? "Pro Preview" : "Simple Mode"}
      </p>
    </div>
  );
}
