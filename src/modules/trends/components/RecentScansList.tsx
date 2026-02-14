"use client";

import { deleteScan } from "@/modules/scan/storage/scanStore";
import type { ScanRecord } from "@/modules/scan/models/types";
import { POSE_NAMES } from "@/modules/scan/models/poseNames";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
}

interface Props {
  scans: ScanRecord[];
  onDelete?: () => void;
}

export default function RecentScansList({ scans, onDelete }: Props) {
  const handleDelete = async (e: React.MouseEvent, id: number | undefined) => {
    e.stopPropagation();
    if (id == null) return;
    await deleteScan(id);
    onDelete?.();
  };

  if (scans.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[11px] text-muted uppercase tracking-wider px-1">Progress Photos</h3>
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-text2 mb-1">No photos yet</p>
          <p className="text-xs text-muted">Go to Scan tab to capture your first progress photo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] text-muted uppercase tracking-wider px-1">Progress Photos</h3>
      <div className="grid grid-cols-3 gap-2">
        {scans.map((scan) => (
          <div
            key={scan.id}
            className="relative bg-surface rounded-xl border border-border overflow-hidden group"
          >
            {scan.photoDataUrl ? (
              <img
                src={scan.photoDataUrl}
                alt={`${POSE_NAMES[scan.poseId] || scan.poseId}`}
                className="w-full aspect-[3/4] object-cover"
              />
            ) : (
              <div className="w-full aspect-[3/4] bg-text/[0.03] flex items-center justify-center">
                <span className="text-[10px] text-muted">No photo</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
              <p className="text-[10px] text-white/90 font-medium">{formatDate(scan.timestamp)}</p>
            </div>
            {scan.scanCategory === "CHECKIN_FULL" ? (
              <div className="absolute top-1 left-1 bg-emerald-500/80 backdrop-blur-sm rounded px-1.5 py-0.5">
                <span className="text-[8px] font-semibold text-white">FULL</span>
              </div>
            ) : scan.scanCategory === "CHECKIN_SELFIE" ? (
              <div className="absolute top-1 left-1 bg-blue-500/80 backdrop-blur-sm rounded px-1.5 py-0.5">
                <span className="text-[8px] font-semibold text-white">SELFIE</span>
              </div>
            ) : scan.scanType === "CHECKIN" ? (
              <div className="absolute top-1 left-1 bg-emerald-500/80 backdrop-blur-sm rounded px-1.5 py-0.5">
                <span className="text-[8px] font-semibold text-white">CHECK-IN</span>
              </div>
            ) : null}
            <button
              onClick={(e) => handleDelete(e, scan.id)}
              className="absolute top-1 right-1 p-1 rounded-md bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Delete"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
