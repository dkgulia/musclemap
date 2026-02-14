"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { analyzePhoto, type PhotoScanResult } from "../services/photoScanService";
import { addScan, savePhotoBlob, listScans } from "../storage/scanStore";
import { isCheckinTemplate } from "../models/poseTemplates";
import { POSE_NAMES } from "../models/poseNames";
import { getConfidenceLabel } from "../models/types";
import type { ScanRecord, ScanType } from "../models/types";
import CheckinGateCard from "./CheckinGateCard";
import PhotoDebugOverlay from "./PhotoDebugOverlay";

function confidenceColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function fmtIdx(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

export default function PhotoUploadPanel() {
  const { selectedTemplateId, userHeightCm } = useApp();
  const searchParams = useSearchParams();
  const debug = searchParams.get("debug") === "1";

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PhotoScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savePhoto, setSavePhoto] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedType, setSavedType] = useState<ScanType | null>(null);
  const [previousScan, setPreviousScan] = useState<ScanRecord | null>(null);

  const isCheckin = isCheckinTemplate(selectedTemplateId);
  const gatesPassed = result?.checkinGates?.allPassed ?? false;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    setSaved(false);
    setSavedType(null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setSavedType(null);

    try {
      const scanType: ScanType | undefined = isCheckinTemplate(selectedTemplateId) ? "CHECKIN" : undefined;
      const res = await analyzePhoto(file, selectedTemplateId, { mirrored, scanType });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try a different photo.");
    } finally {
      setAnalyzing(false);
    }
  }, [file, selectedTemplateId, mirrored]);

  const doSave = useCallback(async (scanType: ScanType) => {
    if (!result || saved) return;

    const m = result.measurements;

    // Calibrate cm from world measurements
    let shoulderWidthCm = 0;
    let hipWidthCm = 0;
    let bodyHeightCm = 0;
    if (userHeightCm && m.bodyHeightM > 0.1) {
      const factor = (userHeightCm / 100) / m.bodyHeightM;
      shoulderWidthCm = m.shoulderWidthM * factor * 100;
      hipWidthCm = m.hipWidthM * factor * 100;
      bodyHeightCm = m.bodyHeightM * factor * 100;
    }

    // Save photo blob if toggled on
    let photoBlobKey: number | undefined;
    if (savePhoto) {
      const blob = await new Promise<Blob>((resolve) => {
        result.normalizedCanvas.toBlob(
          (b) => resolve(b!),
          "image/jpeg",
          0.75
        );
      });
      photoBlobKey = await savePhotoBlob(blob);
    }

    // Generate a small data URL for quick display
    const photoDataUrl = result.normalizedCanvas.toDataURL("image/jpeg", 0.6);

    await addScan({
      timestamp: Date.now(),
      poseId: selectedTemplateId,
      alignmentScore: Math.round(result.alignmentScore),
      confidenceScore: Math.round(result.confidenceScore),
      shoulderIndex: Math.round(m.shoulderIndex * 1000) / 1000,
      hipIndex: Math.round(m.hipIndex * 1000) / 1000,
      vTaperIndex: Math.round(m.vTaperIndex * 1000) / 1000,
      shoulderWidthPx: Math.round(m.shoulderWidthPx),
      hipWidthPx: Math.round(m.hipWidthPx),
      bodyHeightPx: Math.round(m.bodyHeightPx),
      shoulderWidthCm: Math.round(shoulderWidthCm * 10) / 10,
      hipWidthCm: Math.round(hipWidthCm * 10) / 10,
      bodyHeightCm: Math.round(bodyHeightCm * 10) / 10,
      symmetryScore: Math.round(result.symmetryData?.overallScore ?? 0),
      photoDataUrl,
      isPhotoScan: true,
      hipBandWidthIndex: result.sliceIndices?.hipBandWidthIndex,
      upperThighWidthIndex: result.sliceIndices?.upperThighWidthIndex,
      midThighWidthIndex: result.sliceIndices?.midThighWidthIndex,
      calfWidthIndex: result.sliceIndices?.calfWidthIndex,
      stanceWidthIndex: m.bodyHeightPx > 0 ? result.stanceWidthPx / m.bodyHeightPx : undefined,
      hipTiltDeg: result.hipTiltDeg,
      shoulderTiltDeg: result.shoulderTiltDeg,
      segmentationQuality: result.segmentationQuality,
      consistencyScore: result.consistencyScore,
      photoBlobKey,
      scanType,
      avgBrightness: result.avgBrightness,
      stanceWidthPx: result.stanceWidthPx,
    });

    // Fetch previous scan for context
    const recent = await listScans(selectedTemplateId, 2);
    setPreviousScan(recent.length >= 2 ? recent[1] : null);

    setSaved(true);
    setSavedType(scanType);
  }, [result, saved, savePhoto, selectedTemplateId, userHeightCm]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSaved(false);
    setSavedType(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const poseName = POSE_NAMES[selectedTemplateId] || selectedTemplateId;

  return (
    <div className="flex flex-col gap-3">
      {/* Upload area */}
      {!result && (
        <div className="mx-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border-2 border-dashed border-border bg-surface flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-muted transition-colors"
          >
            {preview ? (
              <img
                src={preview}
                alt="Selected photo"
                className="absolute inset-0 w-full h-full object-cover"
                style={mirrored ? { transform: "scaleX(-1)" } : undefined}
              />
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="text-xs text-muted">Tap to select a photo</p>
                <p className="text-[10px] text-muted/60">Full-body {poseName} pose works best</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Mirror toggle + Analyze button */}
      {file && !result && !analyzing && (
        <div className="mx-5 flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mirrored}
              onChange={(e) => setMirrored(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-accent"
            />
            <span className="text-xs text-text2">Mirror image (selfie mode)</span>
          </label>

          <button
            onClick={handleAnalyze}
            className="w-full py-3 rounded-xl bg-accent text-accent-fg text-sm font-medium transition-colors cursor-pointer"
          >
            Analyze Photo
          </button>
        </div>
      )}

      {/* Loading */}
      {analyzing && (
        <div className="mx-5 flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
          <p className="text-xs text-muted">Analyzing pose & body shape...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <p className="text-xs text-red-400 font-medium mb-2">{error}</p>
          <p className="text-[10px] text-muted mb-3">Tips for a better photo:</p>
          <ul className="text-[10px] text-text2 space-y-1 list-disc list-inside">
            <li>Stand in a well-lit area</li>
            <li>Show your full body (head to feet)</li>
            <li>Face the camera directly</li>
            <li>Avoid cluttered backgrounds</li>
          </ul>
          <button
            onClick={handleReset}
            className="mt-3 w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-text2 cursor-pointer"
          >
            Try Another Photo
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* Photo with confidence badge */}
          <div className="mx-5">
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-black">
              <canvas
                ref={(el) => {
                  if (el && result.normalizedCanvas) {
                    el.width = result.normalizedCanvas.width;
                    el.height = result.normalizedCanvas.height;
                    const ctx = el.getContext("2d");
                    if (ctx) ctx.drawImage(result.normalizedCanvas, 0, 0);
                  }
                }}
                className="w-full h-full object-cover"
              />

              {/* Debug overlay */}
              {debug && result.binaryMask && (
                <PhotoDebugOverlay
                  binaryMask={result.binaryMask}
                  maskWidth={result.maskWidth}
                  maskHeight={result.maskHeight}
                  canvasWidth={result.normalizedCanvas.width}
                  canvasHeight={result.normalizedCanvas.height}
                  sliceYPositions={result.sliceYPositions}
                  sliceIndices={result.sliceIndices}
                />
              )}

              {/* Confidence badge */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                <span className={`text-[11px] font-medium ${confidenceColor(result.confidenceScore)}`}>
                  {Math.round(result.confidenceScore)} — {getConfidenceLabel(result.confidenceScore)}
                </span>
              </div>

              {/* Consistency badge */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                <span className={`text-[11px] font-medium ${result.consistencyPasses ? "text-emerald-400" : "text-amber-400"}`}>
                  {result.consistencyScore < 100
                    ? (result.consistencyPasses ? "Consistent" : "Inconsistent")
                    : "First scan"
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="mx-5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-400">
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Check-in gate card */}
          {isCheckin && result.checkinGates && (
            <div className="mx-5">
              <CheckinGateCard gates={result.checkinGates} />
            </div>
          )}

          {/* Slice indices table */}
          {result.sliceIndices && (
            <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
              <h3 className="text-xs font-medium text-text mb-3">Body Width Indices</h3>
              <div className="space-y-2">
                {[
                  { label: "Hip Band", value: result.sliceIndices.hipBandWidthIndex, left: result.sliceIndices.hipBandLeftPx, right: result.sliceIndices.hipBandRightPx },
                  { label: "Upper Thigh", value: result.sliceIndices.upperThighWidthIndex, left: result.sliceIndices.upperThighLeftPx, right: result.sliceIndices.upperThighRightPx },
                  { label: "Mid Thigh", value: result.sliceIndices.midThighWidthIndex, left: result.sliceIndices.midThighLeftPx, right: result.sliceIndices.midThighRightPx },
                  { label: "Calf", value: result.sliceIndices.calfWidthIndex, left: result.sliceIndices.calfLeftPx, right: result.sliceIndices.calfRightPx },
                ].map((row) => {
                  const asymmetry = row.left + row.right > 0
                    ? Math.abs(row.left - row.right) / ((row.left + row.right) / 2) * 100
                    : 0;
                  return (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">{row.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text">{fmtIdx(row.value)}</span>
                        {asymmetry > 5 && (
                          <span className="text-[9px] text-amber-400">
                            {asymmetry.toFixed(0)}% asym
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confidence breakdown */}
          <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
            <h3 className="text-xs font-medium text-text mb-3">Confidence Breakdown</h3>
            <div className="space-y-1.5">
              {[
                { label: "Landmarks", value: result.confidenceBreakdown.landmarksVisible, max: 30 },
                { label: "Brightness", value: result.confidenceBreakdown.brightness, max: 20 },
                { label: "Distance", value: result.confidenceBreakdown.distance, max: 20 },
                { label: "Pose Match", value: result.confidenceBreakdown.poseMatch, max: 20 },
                { label: "Segmentation", value: result.confidenceBreakdown.segmentationQuality, max: 10 },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted w-20 shrink-0">{row.label}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(row.value / row.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text2 w-10 text-right">
                    {row.value.toFixed(0)}/{row.max}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Debug: raw gate JSON */}
          {debug && result.checkinGates && (
            <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
              <h3 className="text-xs font-medium text-text mb-2">Gate Debug</h3>
              <pre className="text-[9px] text-muted overflow-auto max-h-40">
                {JSON.stringify(result.checkinGates, null, 2)}
              </pre>
            </div>
          )}

          {/* Save controls */}
          {!saved ? (
            <div className="mx-5 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savePhoto}
                  onChange={(e) => setSavePhoto(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-accent"
                />
                <span className="text-xs text-text2">Save photo locally</span>
              </label>

              {isCheckin && gatesPassed ? (
                <>
                  <button
                    onClick={() => doSave("CHECKIN")}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    Save Check-in
                  </button>
                  <button
                    onClick={() => doSave("GALLERY")}
                    className="w-full py-2 rounded-xl bg-surface border border-border text-xs text-text2 cursor-pointer"
                  >
                    Save as Gallery Instead
                  </button>
                </>
              ) : isCheckin && !gatesPassed ? (
                <>
                  <button
                    disabled
                    className="w-full py-3 rounded-xl bg-surface border border-border text-sm font-medium text-muted cursor-not-allowed"
                  >
                    Save Check-in (gates failed)
                  </button>
                  <button
                    onClick={() => doSave("GALLERY")}
                    className="w-full py-3 rounded-xl bg-accent text-accent-fg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Save as Gallery Photo
                  </button>
                </>
              ) : (
                <button
                  onClick={() => doSave("GALLERY")}
                  className="w-full py-3 rounded-xl bg-accent text-accent-fg text-sm font-medium transition-colors cursor-pointer"
                >
                  Save Scan
                </button>
              )}

              <button
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-text2 cursor-pointer"
              >
                Discard & Try Another
              </button>
            </div>
          ) : (
            <div className="mx-5 bg-surface border border-accent/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span className="text-sm font-medium text-text">
                  {poseName} saved{savedType === "CHECKIN" ? " as Check-in" : " as Gallery"}
                </span>
              </div>
              {previousScan && (
                <p className="text-[11px] text-muted">
                  Compare with your previous scan in the Compare tab
                </p>
              )}
              <button
                onClick={handleReset}
                className="mt-3 w-full py-2.5 rounded-xl bg-accent text-accent-fg text-xs font-medium cursor-pointer"
              >
                Analyze Another Photo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
