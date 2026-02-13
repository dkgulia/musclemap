"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
}

function scanLabel(scan: ScanRecord): string {
  const pose = POSE_NAMES[scan.poseId] || scan.poseId;
  return `${pose} — ${formatDate(scan.timestamp)}`;
}

function PhotoSlider({ scanA, scanB }: { scanA: ScanRecord; scanB: ScanRecord }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const updatePosition = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pct)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updatePosition(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const hasPhotos = scanA.photoDataUrl && scanB.photoDataUrl;

  if (!hasPhotos) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-6 text-center">
        <p className="text-sm text-text2 mb-1">Photos not available</p>
        <p className="text-xs text-muted">
          {!scanA.photoDataUrl && !scanB.photoDataUrl
            ? "Both scans were captured before photo saving was enabled."
            : !scanA.photoDataUrl
            ? "The older scan doesn't have a photo saved."
            : "The newer scan doesn't have a photo saved."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-black touch-none select-none cursor-col-resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Photo B (newer) — full background */}
        <img
          src={scanB.photoDataUrl}
          alt="After"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Photo A (older) — clipped by slider */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={scanA.photoDataUrl}
            alt="Before"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ minWidth: containerWidth ? `${containerWidth}px` : "100%" }}
            draggable={false}
          />
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          {/* Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
              <path d="M8 6l-4 6 4 6" />
              <path d="M16 6l4 6-4 6" />
            </svg>
          </div>
        </div>

        {/* Date labels */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
            {formatDate(scanA.timestamp)}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 z-10">
          <span className="text-[10px] font-medium text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
            {formatDate(scanB.timestamp)}
          </span>
        </div>
      </div>

      <div className="flex justify-between px-1">
        <span className="text-[10px] text-muted">Before</span>
        <span className="text-[10px] text-muted">After</span>
      </div>
    </div>
  );
}

function deltaConfidenceLabel(scanA: ScanRecord, scanB: ScanRecord): { label: string; color: string } {
  const aConf = scanA.confidenceScore ?? 0;
  const bConf = scanB.confidenceScore ?? 0;
  const aCons = scanA.consistencyScore ?? 0;
  const bCons = scanB.consistencyScore ?? 0;
  if (aConf >= 75 && bConf >= 75 && aCons >= 70 && bCons >= 70) {
    return { label: "High confidence", color: "text-emerald-400" };
  }
  if (aConf >= 60 && bConf >= 60) {
    return { label: "Med confidence", color: "text-amber-400" };
  }
  return { label: "Low confidence", color: "text-muted" };
}

function RegionDeltaCard({ scanA, scanB }: { scanA: ScanRecord; scanB: ScanRecord }) {
  const regions: { label: string; prev: number | undefined; curr: number | undefined }[] = [
    { label: "Hip Band", prev: scanA.hipBandWidthIndex, curr: scanB.hipBandWidthIndex },
    { label: "Upper Thigh", prev: scanA.upperThighWidthIndex, curr: scanB.upperThighWidthIndex },
    { label: "Mid Thigh", prev: scanA.midThighWidthIndex, curr: scanB.midThighWidthIndex },
    { label: "Calf", prev: scanA.calfWidthIndex, curr: scanB.calfWidthIndex },
  ];

  const conf = deltaConfidenceLabel(scanA, scanB);

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-text">Region Changes</h3>
        <span className={`text-[10px] ${conf.color}`}>{conf.label}</span>
      </div>
      <div className="space-y-2">
        {regions.map((r) => {
          if (r.prev == null || r.curr == null) return null;
          const deltaPct = r.prev > 0 ? ((r.curr - r.prev) / r.prev) * 100 : 0;
          const sign = deltaPct > 0 ? "+" : "";
          const color = Math.abs(deltaPct) < 0.5 ? "text-text2" : deltaPct > 0 ? "text-emerald-400" : "text-red-400";
          return (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-[11px] text-muted">{r.label}</span>
              <span className={`text-xs font-medium ${color}`}>
                {sign}{deltaPct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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

    // Auto-select scans that have photos: B = most recent with photo, A = second most recent with photo
    const withPhotos = data.filter((s) => s.photoDataUrl);
    if (withPhotos.length >= 2) {
      setScanBId(withPhotos[0].id ?? null);
      setScanAId(withPhotos[1].id ?? null);
    } else if (data.length >= 2) {
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
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-text/[0.05] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5" />
            </svg>
          </div>
          <p className="text-sm text-text2 mb-1">Not enough photos</p>
          <p className="text-xs text-muted">
            Log at least 2 progress photos from the Scan tab to compare
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Scan pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1.5 block px-1">
            Before
          </label>
          <select
            value={scanAId ?? ""}
            onChange={(e) => setScanAId(Number(e.target.value))}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-text appearance-none cursor-pointer focus:outline-none focus:border-accent/50"
          >
            <option value="" disabled>
              Select photo
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
            After
          </label>
          <select
            value={scanBId ?? ""}
            onChange={(e) => setScanBId(Number(e.target.value))}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-text appearance-none cursor-pointer focus:outline-none focus:border-accent/50"
          >
            <option value="" disabled>
              Select photo
            </option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>
                {scanLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Photo comparison slider */}
      {scanA && scanB && <PhotoSlider scanA={scanA} scanB={scanB} />}

      {/* Region delta card (only if both scans have slice data) */}
      {scanA && scanB && scanA.isPhotoScan && scanB.isPhotoScan &&
       scanA.hipBandWidthIndex != null && scanB.hipBandWidthIndex != null && (
        <RegionDeltaCard scanA={scanA} scanB={scanB} />
      )}

      {/* Time gap info */}
      {scanA && scanB && (
        <div className="bg-surface rounded-2xl border border-border p-3">
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
        </div>
      )}

      {(!scanA || !scanB) && (
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-text2">Select two photos above to compare</p>
        </div>
      )}
    </div>
  );
}

function formatTimeGap(ms: number): string {
  const days = Math.floor(Math.abs(ms) / 86400000);
  if (days === 0) return "Same day";
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
