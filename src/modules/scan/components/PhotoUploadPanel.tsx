"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { analyzeUploadedPhoto } from "../services/photoAnalyzeService";
import { buildCoachPayload, generateCoachReport } from "../services/coachReportService";
import { addScan, savePhotoBlob, listScans } from "../storage/scanStore";
import { POSE_NAMES } from "../models/poseNames";
import type { PhotoAnalysis, ScanCategory } from "../models/types";
import PhotoResultSheet from "./PhotoResultSheet";

export default function PhotoUploadPanel() {
  const { selectedTemplateId, userHeightCm } = useApp();
  const searchParams = useSearchParams();
  const debug = searchParams.get("debug") === "1";

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedCategory, setSavedCategory] = useState<ScanCategory | null>(null);
  const [coachReport, setCoachReport] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  const poseName = POSE_NAMES[selectedTemplateId] || selectedTemplateId;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setAnalysis(null);
    setError(null);
    setSaved(false);
    setSavedCategory(null);
    setCoachReport(null);
    if (f) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setSaved(false);
    setSavedCategory(null);
    setCoachReport(null);

    try {
      const result = await analyzeUploadedPhoto(file, selectedTemplateId, userHeightCm);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try a different photo.");
    } finally {
      setAnalyzing(false);
    }
  }, [file, selectedTemplateId, userHeightCm]);

  const handleSave = useCallback(async (savePhoto: boolean) => {
    if (!analysis || saved) return;

    const { classification, measurements, symmetryData, canvas, avgBrightness } = analysis;
    const cat = classification.category;

    // Calibrate cm from world measurements
    let shoulderWidthCm = 0;
    let hipWidthCm = 0;
    let bodyHeightCm = 0;
    if (measurements && userHeightCm && measurements.bodyHeightM > 0.1) {
      const factor = (userHeightCm / 100) / measurements.bodyHeightM;
      shoulderWidthCm = measurements.shoulderWidthM * factor * 100;
      hipWidthCm = measurements.hipWidthM * factor * 100;
      bodyHeightCm = measurements.bodyHeightM * factor * 100;
    }

    // Save photo blob if toggled
    let photoBlobKey: number | undefined;
    if (savePhoto) {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.75);
      });
      photoBlobKey = await savePhotoBlob(blob);
    }

    const photoDataUrl = canvas.toDataURL("image/jpeg", 0.6);

    // Map V2 category to V1 scanType for backward compat
    const scanType = cat === "GALLERY" ? "GALLERY" as const : "CHECKIN" as const;

    await addScan({
      timestamp: Date.now(),
      poseId: selectedTemplateId,
      alignmentScore: Math.round(classification.scores.poseMatch),
      confidenceScore: Math.round(classification.scores.quality),
      shoulderIndex: measurements ? Math.round(measurements.shoulderIndex * 1000) / 1000 : 0,
      hipIndex: measurements ? Math.round(measurements.hipIndex * 1000) / 1000 : 0,
      vTaperIndex: measurements ? Math.round(measurements.vTaperIndex * 1000) / 1000 : 0,
      shoulderWidthPx: measurements ? Math.round(measurements.shoulderWidthPx) : 0,
      hipWidthPx: measurements ? Math.round(measurements.hipWidthPx) : 0,
      bodyHeightPx: measurements ? Math.round(measurements.bodyHeightPx) : 0,
      shoulderWidthCm: Math.round(shoulderWidthCm * 10) / 10,
      hipWidthCm: Math.round(hipWidthCm * 10) / 10,
      bodyHeightCm: Math.round(bodyHeightCm * 10) / 10,
      symmetryScore: Math.round(symmetryData?.overallScore ?? 0),
      photoDataUrl,
      isPhotoScan: true,
      photoBlobKey,
      scanType,
      avgBrightness,
      // V2 fields
      scanCategory: cat,
      poseDirection: classification.poseDirection,
      trackedRegions: classification.trackedRegions,
      qualityScore: Math.round(classification.scores.quality),
      lightingScore: Math.round(classification.scores.lighting),
      framingScore: Math.round(classification.scores.framing),
      poseMatchScore: Math.round(classification.scores.poseMatch),
    });

    setSaved(true);
    setSavedCategory(cat);
  }, [analysis, saved, selectedTemplateId, userHeightCm]);

  const handleRequestCoach = useCallback(async () => {
    if (!analysis || coachLoading) return;
    setCoachLoading(true);
    try {
      // Get previous scan for time gap
      const recent = await listScans(selectedTemplateId, 2);
      const prevTimestamp = recent.length >= 2 ? recent[1].timestamp : undefined;

      const payload = buildCoachPayload({
        category: analysis.classification.category,
        poseDirection: analysis.classification.poseDirection,
        trackedRegions: analysis.classification.trackedRegions,
        scores: analysis.classification.scores,
        tips: analysis.classification.tips,
        shoulderIndex: analysis.measurements?.shoulderIndex,
        hipIndex: analysis.measurements?.hipIndex,
        vTaperIndex: analysis.measurements?.vTaperIndex,
        symmetryScore: analysis.symmetryData?.overallScore,
        prevTimestamp,
      });
      const report = await generateCoachReport(payload);
      setCoachReport(report);
    } catch (err) {
      setCoachReport(`Coach unavailable: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setCoachLoading(false);
    }
  }, [analysis, coachLoading, selectedTemplateId]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setAnalysis(null);
    setError(null);
    setSaved(false);
    setSavedCategory(null);
    setCoachReport(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Upload area */}
      {!analysis && (
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
              />
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="text-xs text-muted">Tap to select a photo</p>
                <p className="text-[10px] text-muted/60">Any pose works — {poseName} recommended</p>
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

      {/* Analyze button */}
      {file && !analysis && !analyzing && (
        <div className="mx-5">
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

      {/* Results — V2 Result Sheet */}
      {analysis && (
        <PhotoResultSheet
          classification={analysis.classification}
          measurements={analysis.measurements}
          symmetryData={analysis.symmetryData}
          canvas={analysis.canvas}
          avgBrightness={analysis.avgBrightness}
          coachLoading={coachLoading}
          coachReport={coachReport}
          onRequestCoach={handleRequestCoach}
          onSave={handleSave}
          onRetake={handleReset}
          saved={saved}
          savedCategory={savedCategory}
        />
      )}

      {/* Debug panel */}
      {debug && analysis && (
        <div className="mx-5 bg-surface border border-border rounded-2xl p-4">
          <h3 className="text-xs font-medium text-text mb-2">Debug: Classification</h3>
          <pre className="text-[9px] text-muted overflow-auto max-h-60">
            {JSON.stringify({
              category: analysis.classification.category,
              poseDirection: analysis.classification.poseDirection,
              scores: analysis.classification.scores,
              trackedRegions: analysis.classification.trackedRegions,
              tips: analysis.classification.tips,
              avgBrightness: analysis.avgBrightness,
              measurements: analysis.measurements ? {
                shoulderIndex: analysis.measurements.shoulderIndex,
                hipIndex: analysis.measurements.hipIndex,
                vTaperIndex: analysis.measurements.vTaperIndex,
              } : null,
              symmetry: analysis.symmetryData?.overallScore ?? null,
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
