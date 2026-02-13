"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import TemplateChips from "@/modules/scan/components/TemplateChips";
import TrendChart from "@/modules/trends/components/TrendChartMock";
import RecentScansList from "@/modules/trends/components/RecentScansList";
import { listScans, clearAll } from "@/modules/scan/storage/scanStore";
import type { ScanRecord } from "@/modules/scan/models/types";
import Modal from "@/components/Modal";

type MetricKey = "alignmentScore" | "shoulderIndex" | "hipIndex" | "vTaperIndex" | "shoulderWidthCm" | "hipWidthCm";

const BASE_METRICS: { key: MetricKey; label: string }[] = [
  { key: "alignmentScore", label: "Alignment" },
  { key: "shoulderIndex", label: "Shoulder" },
  { key: "vTaperIndex", label: "V-Taper" },
  { key: "hipIndex", label: "Hip" },
];

const CM_METRICS: { key: MetricKey; label: string }[] = [
  { key: "shoulderWidthCm", label: "Sh (cm)" },
  { key: "hipWidthCm", label: "Hip (cm)" },
];

const POSE_NAMES: Record<string, string> = {
  "front-biceps": "Front Biceps",
  "back-lats": "Back Lats",
  "side-glute": "Side Glute",
  "back-glute": "Back Glute",
};

export default function TrendsPage() {
  const { mode, selectedTemplateId } = useApp();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("alignmentScore");

  const loadScans = useCallback(async () => {
    setLoading(true);
    const data = await listScans(selectedTemplateId, 50);
    setScans(data);
    setLoading(false);
  }, [selectedTemplateId]);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleClearAll = async () => {
    await clearAll();
    setScans([]);
    setShowClearModal(false);
  };

  const poseName = POSE_NAMES[selectedTemplateId] || selectedTemplateId;

  // Show cm metrics only if any scan has calibration data
  const hasCmData = scans.some((s) => s.shoulderWidthCm > 0);
  const metrics = hasCmData ? [...BASE_METRICS, ...CM_METRICS] : BASE_METRICS;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TemplateChips />

      <div className="px-5 flex flex-col gap-4">
        {/* Metric selector pills */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {metrics.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedMetric === m.key
                  ? "bg-accent text-accent-fg"
                  : "bg-text/[0.05] text-text2 hover:text-text"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Trend chart */}
        {loading ? (
          <div className="bg-surface border border-border rounded-2xl px-4 py-8 text-center">
            <div className="w-5 h-5 border-2 border-border border-t-muted rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted">Loading...</p>
          </div>
        ) : (
          <TrendChart scans={scans} metric={selectedMetric} poseName={poseName} />
        )}

        {mode === "pro" && (
          <div className="bg-surface rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-text">Weekly Report</h3>
              <span className="text-[10px] text-muted bg-text/[0.05] px-2 py-0.5 rounded-md uppercase tracking-wider">
                Pro
              </span>
            </div>
            <p className="text-xs text-text2 mb-3 leading-relaxed">
              Your weekly muscle development summary with detailed metrics and recommendations.
            </p>
            <button className="w-full py-2.5 rounded-xl bg-text/[0.04] border border-border text-xs text-text2 hover:text-text transition-colors cursor-pointer">
              View Full Report
            </button>
          </div>
        )}

        {/* Recent scans list */}
        {!loading && (
          <RecentScansList scans={scans.slice(0, 20)} onDelete={loadScans} />
        )}

        {/* Actions */}
        {scans.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-muted hover:text-red-400 hover:border-red-400/30 transition-colors cursor-pointer"
          >
            Clear All Scans
          </button>
        )}

        {mode === "pro" && (
          <button className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-muted hover:text-text2 transition-colors cursor-pointer">
            Export Trend Data
          </button>
        )}
      </div>

      <Modal open={showClearModal} onClose={() => setShowClearModal(false)}>
        <div className="text-center">
          <h3 className="text-base font-semibold text-text mb-2">Clear All Scans?</h3>
          <p className="text-sm text-text2 mb-6">
            This will permanently delete all scan data from this device. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowClearModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm text-text2 hover:text-text transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
            >
              Delete All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
