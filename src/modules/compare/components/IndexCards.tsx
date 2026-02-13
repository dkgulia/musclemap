"use client";

import Card from "@/components/Card";
import type { ScanRecord } from "@/modules/scan/models/types";

interface MetricDef {
  key: keyof ScanRecord;
  label: string;
  format: (v: number) => string;
}

const BASE_METRICS: MetricDef[] = [
  { key: "shoulderIndex", label: "Shoulder", format: (v) => v.toFixed(3) },
  { key: "vTaperIndex", label: "V-Taper", format: (v) => v.toFixed(3) },
  { key: "hipIndex", label: "Hip", format: (v) => v.toFixed(3) },
  { key: "alignmentScore", label: "Alignment", format: (v) => `${Math.round(v)}` },
  { key: "confidenceScore", label: "Confidence", format: (v) => `${Math.round(v)}` },
];

const CM_METRICS: MetricDef[] = [
  { key: "shoulderWidthCm", label: "Shoulder (cm)", format: (v) => v.toFixed(1) },
  { key: "hipWidthCm", label: "Hip (cm)", format: (v) => v.toFixed(1) },
  { key: "bodyHeightCm", label: "Height (cm)", format: (v) => v.toFixed(1) },
];

interface Props {
  scanA: ScanRecord | null;
  scanB: ScanRecord | null;
}

export default function IndexCards({ scanA, scanB }: Props) {
  if (!scanA || !scanB) return null;

  // Include cm metrics only when both scans have calibration data
  const hasCm = scanA.shoulderWidthCm > 0 && scanB.shoulderWidthCm > 0;
  const METRICS = hasCm ? [...BASE_METRICS, ...CM_METRICS] : BASE_METRICS;

  return (
    <div className="space-y-2">
      {METRICS.map((m) => {
        const valA = scanA[m.key] as number;
        const valB = scanB[m.key] as number;
        const delta = valA !== 0 ? ((valB - valA) / Math.abs(valA)) * 100 : 0;
        const isUp = delta >= 0;

        // Bar widths: normalize both to the larger value
        const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 0.001);
        const barA = (Math.abs(valA) / maxVal) * 100;
        const barB = (Math.abs(valB) / maxVal) * 100;

        return (
          <Card key={m.key} className="!p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-muted uppercase tracking-wider">
                {m.label}
              </p>
              <span
                className={`text-xs font-medium ${
                  isUp ? "text-emerald-500" : "text-red-400"
                }`}
              >
                {isUp ? "\u2191" : "\u2193"} {Math.abs(delta).toFixed(1)}%
              </span>
            </div>

            {/* Horizontal bar comparison */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted w-5 shrink-0">A</span>
                <div className="flex-1 h-2 bg-text/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-text/20 rounded-full transition-all"
                    style={{ width: `${barA}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-text2 w-14 text-right">
                  {m.format(valA)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted w-5 shrink-0">B</span>
                <div className="flex-1 h-2 bg-text/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${barB}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-text w-14 text-right">
                  {m.format(valB)}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
