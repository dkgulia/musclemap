"use client";

import Card from "@/components/Card";
import type { ScanRecord } from "@/modules/scan/models/types";

type MetricKey = "alignmentScore" | "shoulderIndex" | "hipIndex" | "vTaperIndex" | "shoulderWidthCm" | "hipWidthCm";

const METRIC_LABELS: Record<MetricKey, string> = {
  alignmentScore: "Alignment",
  shoulderIndex: "Shoulder Index",
  hipIndex: "Hip Index",
  vTaperIndex: "V-Taper",
  shoulderWidthCm: "Shoulder Width (cm)",
  hipWidthCm: "Hip Width (cm)",
};

interface Props {
  scans: ScanRecord[];
  metric: MetricKey;
  poseName: string;
}

export default function TrendChart({ scans, metric, poseName }: Props) {
  // Need oldest→newest for chart
  const ordered = [...scans].reverse();
  const values = ordered.map((s) => s[metric]);

  if (values.length < 2) {
    return (
      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-text2 mb-1">Not enough data</p>
          <p className="text-xs text-muted">Log at least 2 scans to see trends</p>
        </div>
      </Card>
    );
  }

  const first = values[0];
  const last = values[values.length - 1];
  const delta = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const isUp = delta >= 0;

  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const w = 320;
  const h = 140;
  const padX = 8;
  const padY = 12;

  const points = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (w - padX * 2),
    y: padY + (1 - (v - minVal) / range) * (h - padY * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;
  const lastPt = points[points.length - 1];

  // Format display value
  const displayVal = metric === "alignmentScore"
    ? `${Math.round(last)}`
    : metric.endsWith("Cm")
    ? last.toFixed(1)
    : last.toFixed(3);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wider">
            {METRIC_LABELS[metric]}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className="text-2xl font-bold text-text">{displayVal}</p>
            <span className={`text-xs font-medium ${isUp ? "text-emerald-500" : "text-red-400"}`}>
              {isUp ? "\u2191" : "\u2193"} {Math.abs(delta).toFixed(1)}%
            </span>
          </div>
        </div>
        <span className="text-[10px] text-muted border border-border px-2 py-1 rounded-lg">
          {poseName}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trend-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trend-area-grad)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="var(--accent)" />
        <circle cx={lastPt.x} cy={lastPt.y} r="7" fill="var(--accent)" fillOpacity="0.2" />
      </svg>
    </Card>
  );
}
