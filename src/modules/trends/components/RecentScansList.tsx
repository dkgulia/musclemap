"use client";

import Card from "@/components/Card";
import { deleteScan } from "@/modules/scan/storage/scanStore";
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

interface Props {
  scans: ScanRecord[];
  onDelete?: () => void;
}

export default function RecentScansList({ scans, onDelete }: Props) {
  const handleDelete = async (id: number | undefined) => {
    if (id == null) return;
    await deleteScan(id);
    onDelete?.();
  };

  if (scans.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[11px] text-muted uppercase tracking-wider px-1">Recent Scans</h3>
        <Card className="text-center !py-6">
          <p className="text-sm text-text2 mb-1">No scans yet</p>
          <p className="text-xs text-muted">Go to Scan tab to log your first scan</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] text-muted uppercase tracking-wider px-1">Recent Scans</h3>
      {scans.map((scan) => (
        <Card key={scan.id} className="flex items-center justify-between !py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text">{POSE_NAMES[scan.poseId] || scan.poseId}</p>
            <p className="text-[11px] text-muted mt-0.5">{formatDate(scan.timestamp)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-semibold text-text">{scan.alignmentScore}</p>
              <p className="text-[10px] text-muted">align</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-text2">{scan.vTaperIndex.toFixed(2)}</p>
              <p className="text-[10px] text-muted">v-taper</p>
            </div>
            {scan.shoulderWidthCm > 0 && (
              <div className="text-right">
                <p className="text-sm font-mono text-text2">{scan.shoulderWidthCm.toFixed(1)}</p>
                <p className="text-[10px] text-muted">sh cm</p>
              </div>
            )}
            <button
              onClick={() => handleDelete(scan.id)}
              className="p-1.5 rounded-lg hover:bg-text/[0.05] transition-colors cursor-pointer"
              title="Delete scan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
              </svg>
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
