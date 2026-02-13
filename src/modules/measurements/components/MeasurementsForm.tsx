"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/components/Card";
import {
  addMeasurement,
  getLatestByName,
  getPreviousEntry,
  type MeasurementEntry,
} from "../measurementStore";

const SUGGESTIONS = [
  "Chest",
  "Waist",
  "Bicep L",
  "Bicep R",
  "Thigh L",
  "Thigh R",
  "Calf L",
  "Calf R",
  "Neck",
  "Forearm L",
  "Forearm R",
  "Shoulders",
];

interface LatestWithDelta {
  entry: MeasurementEntry;
  delta: number | null; // difference from previous, null if first entry
  daysSince: number | null;
}

export default function MeasurementsForm() {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [latest, setLatest] = useState<Map<string, LatestWithDelta>>(new Map());
  const [saving, setSaving] = useState(false);
  const valueRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const latestMap = await getLatestByName();
    const withDeltas = new Map<string, LatestWithDelta>();

    for (const [n, entry] of latestMap) {
      const prev = await getPreviousEntry(n);
      withDeltas.set(n, {
        entry,
        delta: prev ? entry.value - prev.value : null,
        daysSince: prev
          ? Math.round((entry.timestamp - prev.timestamp) / 86400000)
          : null,
      });
    }
    setLatest(withDeltas);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    const trimmed = name.trim();
    const num = parseFloat(value);
    if (!trimmed || isNaN(num) || num <= 0) return;

    setSaving(true);
    await addMeasurement({
      timestamp: Date.now(),
      name: trimmed,
      value: num,
      unit: "cm",
    });
    setName("");
    setValue("");
    await loadData();
    setSaving(false);
  };

  const handleChip = (suggestion: string) => {
    setName(suggestion);
    // Pre-fill with last value if exists
    const existing = latest.get(suggestion);
    if (existing) {
      setValue(existing.entry.value.toString());
    }
    valueRef.current?.focus();
  };

  const handleRowTap = (n: string) => {
    const existing = latest.get(n);
    setName(n);
    if (existing) setValue(existing.entry.value.toString());
    valueRef.current?.focus();
  };

  // Filter suggestions to show un-logged ones first, then already logged
  const unusedSuggestions = SUGGESTIONS.filter((s) => !latest.has(s));
  const chipsToShow = unusedSuggestions.length > 0 ? unusedSuggestions.slice(0, 6) : SUGGESTIONS.slice(0, 6);

  return (
    <Card>
      <p className="text-sm text-text mb-1">Body Measurements</p>
      <p className="text-[11px] text-muted mb-3">
        Track your muscle growth with tape measurements.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {chipsToShow.map((s) => (
          <button
            key={s}
            onClick={() => handleChip(s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
              name === s
                ? "bg-accent text-accent-fg"
                : "bg-text/[0.05] text-text2 hover:text-text"
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => {
            setName("");
            valueRef.current?.focus();
          }}
          className="px-2.5 py-1 rounded-lg text-[11px] bg-text/[0.05] text-muted hover:text-text2 transition-colors cursor-pointer"
        >
          + Custom
        </button>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Measurement name"
          className="flex-1 min-w-0 bg-text/[0.04] border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/50"
        />
        <input
          ref={valueRef}
          type="number"
          inputMode="decimal"
          step={0.1}
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="w-20 bg-text/[0.04] border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-accent/50 text-right"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <span className="text-xs text-muted shrink-0">cm</span>
        <button
          onClick={handleAdd}
          disabled={saving || !name.trim() || !value}
          className="px-3 py-2 rounded-xl bg-accent text-accent-fg text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer"
        >
          {saving ? "..." : "Add"}
        </button>
      </div>

      {/* Logged measurements list */}
      {latest.size > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted uppercase tracking-wider">
            Your Measurements
          </p>
          {Array.from(latest.entries()).map(([n, data]) => (
            <button
              key={n}
              onClick={() => handleRowTap(n)}
              className="w-full flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-text/[0.03] transition-colors cursor-pointer text-left"
            >
              <span className="text-sm text-text">{n}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-text">
                  {data.entry.value}
                  <span className="text-muted text-[10px] ml-0.5">cm</span>
                </span>
                {data.delta !== null && (
                  <span
                    className={`text-[11px] font-medium ${
                      data.delta > 0
                        ? "text-emerald-400"
                        : data.delta < 0
                        ? "text-red-400"
                        : "text-muted"
                    }`}
                  >
                    {data.delta > 0 ? "+" : ""}
                    {data.delta.toFixed(1)}
                    {data.daysSince != null && (
                      <span className="text-muted font-normal ml-0.5">
                        ({data.daysSince}d)
                      </span>
                    )}
                  </span>
                )}
                {data.delta === null && (
                  <span className="text-[10px] text-accent/70">NEW</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {latest.size === 0 && (
        <p className="text-xs text-muted text-center py-2">
          Grab a tape measure and log your first measurement
        </p>
      )}
    </Card>
  );
}
