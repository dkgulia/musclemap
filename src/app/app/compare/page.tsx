"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import IndexCards from "@/modules/compare/components/IndexCards";
import { listScans } from "@/modules/scan/storage/scanStore";
import type { ScanRecord } from "@/modules/scan/models/types";

const POSE_NAMES: Record<string, string> = {
  "front-biceps": "Front Biceps",
  "back-lats": "Back Lats",
  "side-glute": "Side Glute",
  "back-glute": "Back Glute",
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}, ${d.toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })}`;
}

function scanLabel(scan: ScanRecord): string {
  const pose = POSE_NAMES[scan.poseId] || scan.poseId;
  return `${pose} — ${formatDate(scan.timestamp)}`;
}

export default function ComparePage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanAId, setScanAId] = useState<number | null>(null);
  const [scanBId, setScanBId] = useState<number | null>(null);

  const loadScans = useCallback(async () => {
    setLoading(true);
    const data = await listScans(undefined, 100);
    setScans(data);

    // Auto-select: B = most recent, A = second most recent
    if (data.length >= 2) {
      setScanBId(data[0].id ?? null);
      setScanAId(data[1].id ?? null);
    } else if (data.length === 1) {
      setScanBId(data[0].id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const scanA = scans.find((s) => s.id === scanAId) ?? null;
  const scanB = scans.find((s) => s.id === scanBId) ?? null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-5">
        <div className="w-5 h-5 border-2 border-border border-t-muted rounded-full animate-spin mb-2" />
        <p className="text-xs text-muted">Loading scans...</p>
      </div>
    );
  }

  if (scans.length < 2) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Card className="text-center !py-8">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-text/[0.05] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5" />
            </svg>
          </div>
          <p className="text-sm text-text2 mb-1">Not enough scans</p>
          <p className="text-xs text-muted">
            Log at least 2 scans from the Scan tab to compare your progress
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Scan pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1.5 block px-1">
            Scan A (older)
          </label>
          <select
            value={scanAId ?? ""}
            onChange={(e) => setScanAId(Number(e.target.value))}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-text appearance-none cursor-pointer focus:outline-none focus:border-accent/50"
          >
            <option value="" disabled>
              Select scan
            </option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                {scanLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1.5 block px-1">
            Scan B (newer)
          </label>
          <select
            value={scanBId ?? ""}
            onChange={(e) => setScanBId(Number(e.target.value))}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-text appearance-none cursor-pointer focus:outline-none focus:border-accent/50"
          >
            <option value="" disabled>
              Select scan
            </option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                {scanLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary card */}
      {scanA && scanB && (
        <Card className="!p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Comparing</p>
              <p className="text-xs text-text2 mt-0.5">
                {POSE_NAMES[scanA.poseId] || scanA.poseId} → {POSE_NAMES[scanB.poseId] || scanB.poseId}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase tracking-wider">Time gap</p>
              <p className="text-xs text-text2 mt-0.5">
                {formatTimeGap(scanB.timestamp - scanA.timestamp)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Delta cards */}
      {scanA && scanB && (
        <div>
          <h3 className="text-[11px] text-muted uppercase tracking-wider mb-2 px-1">
            Index Comparison
          </h3>
          <IndexCards scanA={scanA} scanB={scanB} />
        </div>
      )}

      {(!scanA || !scanB) && (
        <Card className="text-center !py-6">
          <p className="text-sm text-text2">Select two scans above to compare</p>
        </Card>
      )}
    </div>
  );
}

function formatTimeGap(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
