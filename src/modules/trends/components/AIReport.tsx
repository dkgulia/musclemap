"use client";

import { useState, useEffect } from "react";
import type { ScanRecord } from "@/modules/scan/models/types";
import { generateProgressReport } from "@/modules/ai/deepseekService";
import { listMeasurements, type MeasurementEntry } from "@/modules/measurements/measurementStore";

const CACHE_KEY = "musclemap_ai_report";

interface CachedReport {
  text: string;
  timestamp: number;
}

interface Props {
  scans: ScanRecord[];
  heightCm: number | null;
}

export default function AIReport({ scans, heightCm }: Props) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);

  // Load cached report on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedReport = JSON.parse(cached);
        setReport(parsed.text);
        setLastGenerated(parsed.timestamp);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      let measurements: MeasurementEntry[] = [];
      try {
        measurements = await listMeasurements(30);
      } catch {
        // measurements store might not exist yet
      }

      const text = await generateProgressReport(scans, measurements, heightCm);
      const now = Date.now();
      setReport(text);
      setLastGenerated(now);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ text, timestamp: now }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-text">AI Progress Report</h3>
        <span className="text-[10px] text-muted bg-text/[0.05] px-2 py-0.5 rounded-md uppercase tracking-wider">
          DeepSeek R1
        </span>
      </div>

      {report && (
        <div className="mb-3">
          <p className="text-xs text-text2 leading-relaxed whitespace-pre-line">
            {report}
          </p>
          {lastGenerated && (
            <p className="text-[10px] text-muted mt-2">
              Generated {formatDate(lastGenerated)}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      {!report && !loading && (
        <p className="text-xs text-text2 mb-3 leading-relaxed">
          Get an AI-powered analysis of your progress, symmetry, and actionable tips.
        </p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || scans.length === 0}
        className="w-full py-2.5 rounded-xl bg-accent text-accent-fg text-xs font-medium disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border border-accent-fg/40 border-t-accent-fg rounded-full animate-spin" />
            Analyzing...
          </>
        ) : report ? (
          "Regenerate Report"
        ) : (
          "Generate Report"
        )}
      </button>

      {scans.length === 0 && (
        <p className="text-[10px] text-muted text-center mt-2">
          Log some scans first to generate a report
        </p>
      )}
    </div>
  );
}
