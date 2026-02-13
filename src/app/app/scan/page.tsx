"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import TemplateChips from "@/modules/scan/components/TemplateChips";
import CameraLayer, { type CameraLayerHandle } from "@/modules/scan/components/CameraLayer";
import SkeletonCanvas from "@/modules/scan/components/SkeletonCanvas";
import GhostOverlay from "@/modules/scan/components/GhostOverlay";
import TipBanner from "@/modules/scan/components/TipBanner";
import { initPose, detectPose, destroyPose } from "@/modules/scan/services/poseService";
import {
  computeAlignment,
  computeConfidence,
  computeMeasurements,
  computeSymmetry,
  generateTip,
  getBodyVisibility,
  ema,
} from "@/modules/scan/services/scoringService";
import { getTemplate } from "@/modules/scan/models/poseTemplates";
import { generateMockLandmarks } from "@/modules/scan/services/mockLandmarks";
import { addScan } from "@/modules/scan/storage/scanStore";
import type { Landmark, WorldLandmark, ScoreBreakdown, SymmetryData } from "@/modules/scan/models/types";

const POSE_DETECT_INTERVAL = 80; // ~12fps
const READY_HOLD_MS = 1000;

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-border border-t-muted rounded-full animate-spin" /></div>}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const { mode, selectedTemplateId, userHeightCm } = useApp();
  const searchParams = useSearchParams();
  const mockMode = searchParams.get("mock") === "1";

  const cameraRef = useRef<CameraLayerHandle>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [tip, setTip] = useState("Stand in a well-lit area facing the camera");
  const [videoSize, setVideoSize] = useState({ w: 720, h: 960 });
  const [bodyVis, setBodyVis] = useState<"full" | "upper" | "partial" | "none">("none");
  const [justLogged, setJustLogged] = useState(false);
  const [canRescan, setCanRescan] = useState(false);
  const [symmetryData, setSymmetryData] = useState<SymmetryData | null>(null);

  const smoothedAlignment = useRef(0);
  const smoothedConfidence = useRef(0);
  const smoothedShoulderIdx = useRef(0);
  const smoothedHipIdx = useRef(0);
  const smoothedVTaper = useRef(0);
  const smoothedShoulderWM = useRef(0);
  const smoothedHipWM = useRef(0);
  const smoothedBodyHM = useRef(0);
  const readySince = useRef<number | null>(null);
  const hasCapturedThisSession = useRef(false);
  const breakdownRef = useRef<ScoreBreakdown>({
    landmarksVisible: 0,
    brightness: 0,
    distance: 0,
    poseMatch: 0,
  });
  const latestMeasurements = useRef<ReturnType<typeof computeMeasurements>>(null);
  const frameCount = useRef(0);
  const poseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load model
  useEffect(() => {
    if (mockMode) {
      setModelReady(true);
      return;
    }
    let cancelled = false;
    setModelLoading(true);
    initPose()
      .then(() => {
        if (!cancelled) {
          setModelReady(true);
          setModelLoading(false);
        }
      })
      .catch((err) => {
        console.error("Pose model init failed:", err);
        setModelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mockMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyPose();
      if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);
    };
  }, []);

  // Reset smoothed measurements + capture flag on template switch
  useEffect(() => {
    smoothedShoulderIdx.current = 0;
    smoothedHipIdx.current = 0;
    smoothedVTaper.current = 0;
    smoothedShoulderWM.current = 0;
    smoothedHipWM.current = 0;
    smoothedBodyHM.current = 0;
    hasCapturedThisSession.current = false;
    setCanRescan(false);
  }, [selectedTemplateId]);

  const runDetection = useCallback(() => {
    const template = getTemplate(selectedTemplateId);
    if (!template) return;

    let detectedLandmarks: Landmark[] | null = null;
    let detectedWorldLandmarks: WorldLandmark[] = [];

    if (mockMode) {
      frameCount.current++;
      const result = generateMockLandmarks(selectedTemplateId, frameCount.current);
      detectedLandmarks = result.landmarks;
      detectedWorldLandmarks = result.worldLandmarks;
    } else {
      const video = cameraRef.current?.videoEl;
      if (!video || !modelReady || video.readyState < 2) return;
      const result = detectPose(video, performance.now());
      if (result) {
        detectedLandmarks = result.landmarks;
        detectedWorldLandmarks = result.worldLandmarks;
      }
    }

    if (!detectedLandmarks) {
      smoothedAlignment.current = ema(smoothedAlignment.current, 0);
      smoothedConfidence.current = ema(smoothedConfidence.current, 0);
      setAlignmentScore(smoothedAlignment.current);
      setConfidenceScore(smoothedConfidence.current);
      setIsReady(false);
      readySince.current = null;
      setTip("No pose detected — stand in frame");
      setLandmarks(null);
      setBodyVis("none");
      setSymmetryData(null);
      return;
    }

    // Body visibility
    const vis = getBodyVisibility(detectedLandmarks);
    setBodyVis(vis);

    const video = cameraRef.current?.videoEl;
    const vw = mockMode ? 720 : (video?.videoWidth ?? 720);
    const vh = mockMode ? 960 : (video?.videoHeight ?? 960);
    setVideoSize({ w: vw, h: vh });

    // Compute scores
    const rawAlignment = computeAlignment(detectedLandmarks, template, vw, vh);
    smoothedAlignment.current = ema(smoothedAlignment.current, rawAlignment);

    if (!mockMode && video) {
      const { total, breakdown } = computeConfidence(
        detectedLandmarks,
        template,
        smoothedAlignment.current,
        video,
        vw,
        vh
      );
      smoothedConfidence.current = ema(smoothedConfidence.current, total);
      breakdownRef.current = breakdown;
    } else {
      smoothedConfidence.current = ema(smoothedConfidence.current, 85);
      breakdownRef.current = { landmarksVisible: 28, brightness: 18, distance: 18, poseMatch: 21 };
    }

    // Measurements (now with world landmarks + calibration)
    latestMeasurements.current = computeMeasurements(
      detectedLandmarks, vw, vh,
      detectedWorldLandmarks,
      userHeightCm
    );

    // Smooth measurements with EMA to reduce frame-to-frame jitter
    if (latestMeasurements.current) {
      const m = latestMeasurements.current;
      smoothedShoulderIdx.current = ema(smoothedShoulderIdx.current, m.shoulderIndex);
      smoothedHipIdx.current = ema(smoothedHipIdx.current, m.hipIndex);
      smoothedVTaper.current = ema(smoothedVTaper.current, m.vTaperIndex);
      smoothedShoulderWM.current = ema(smoothedShoulderWM.current, m.shoulderWidthM);
      smoothedHipWM.current = ema(smoothedHipWM.current, m.hipWidthM);
      smoothedBodyHM.current = ema(smoothedBodyHM.current, m.bodyHeightM);
    }

    // Symmetry analysis from world landmarks
    if (detectedWorldLandmarks.length >= 33) {
      setSymmetryData(computeSymmetry(detectedWorldLandmarks));
    } else {
      setSymmetryData(null);
    }

    // Ready check
    const nowReady =
      smoothedAlignment.current >= 80 && smoothedConfidence.current >= 70;

    if (nowReady) {
      if (!readySince.current) readySince.current = Date.now();
      if (Date.now() - readySince.current >= READY_HOLD_MS) {
        setIsReady(true);
      }
    } else {
      readySince.current = null;
      setIsReady(false);
    }

    setAlignmentScore(smoothedAlignment.current);
    setConfidenceScore(smoothedConfidence.current);
    setLandmarks(detectedLandmarks);
    setTip(generateTip(breakdownRef.current));
  }, [selectedTemplateId, mockMode, modelReady, userHeightCm]);

  // Start detection loop
  useEffect(() => {
    if (!modelReady) return;
    if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);
    poseIntervalRef.current = setInterval(runDetection, POSE_DETECT_INTERVAL);
    return () => {
      if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);
    };
  }, [modelReady, runDetection]);

  const handleCapture = useCallback(async () => {
    const template = getTemplate(selectedTemplateId);
    if (!template || !latestMeasurements.current) return;
    if (justLogged) return; // prevent double-fire

    // Use smoothed measurement values for stable results
    const m = latestMeasurements.current;

    // Compute calibrated cm from smoothed world measurements
    let shoulderWidthCm = 0;
    let hipWidthCm = 0;
    let bodyHeightCm = 0;
    if (userHeightCm && smoothedBodyHM.current > 0.1) {
      const factor = (userHeightCm / 100) / smoothedBodyHM.current;
      shoulderWidthCm = smoothedShoulderWM.current * factor * 100;
      hipWidthCm = smoothedHipWM.current * factor * 100;
      bodyHeightCm = smoothedBodyHM.current * factor * 100;
    }

    await addScan({
      timestamp: Date.now(),
      poseId: selectedTemplateId,
      alignmentScore: Math.round(smoothedAlignment.current),
      confidenceScore: Math.round(smoothedConfidence.current),
      shoulderIndex: Math.round(smoothedShoulderIdx.current * 1000) / 1000,
      hipIndex: Math.round(smoothedHipIdx.current * 1000) / 1000,
      vTaperIndex: Math.round(smoothedVTaper.current * 1000) / 1000,
      shoulderWidthPx: Math.round(m.shoulderWidthPx),
      hipWidthPx: Math.round(m.hipWidthPx),
      bodyHeightPx: Math.round(m.bodyHeightPx),
      shoulderWidthCm: Math.round(shoulderWidthCm * 10) / 10,
      hipWidthCm: Math.round(hipWidthCm * 10) / 10,
      bodyHeightCm: Math.round(bodyHeightCm * 10) / 10,
    });

    hasCapturedThisSession.current = true;
    setJustLogged(true);
    setTimeout(() => {
      setJustLogged(false);
      setCanRescan(true);
    }, 3000);
  }, [selectedTemplateId, justLogged, userHeightCm]);

  // Auto-capture: fire ONCE when isReady first becomes true, then stop
  const prevReady = useRef(false);
  useEffect(() => {
    if (isReady && !prevReady.current && !hasCapturedThisSession.current) {
      handleCapture();
    }
    prevReady.current = isReady;
  }, [isReady, handleCapture]);

  const handleRescan = useCallback(() => {
    hasCapturedThisSession.current = false;
    setCanRescan(false);
  }, []);

  const displayAlignment = Math.round(alignmentScore);
  const displayConfidence = Math.round(confidenceScore);

  return (
    <div className="flex flex-col gap-3 pt-1 pb-4">
      <TemplateChips />

      {/* Camera + overlays + inline score */}
      <div className="px-5">
        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-black">
          <CameraLayer ref={cameraRef} mockMode={mockMode} />
          <GhostOverlay poseId={selectedTemplateId} bodyVisibility={bodyVis} />
          <SkeletonCanvas
            landmarks={landmarks}
            videoWidth={videoSize.w}
            videoHeight={videoSize.h}
            isReady={isReady}
            symmetryData={symmetryData}
          />

          {/* Score overlay — bottom-left glassmorphic pill */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-xl px-3 py-2">
            {/* Alignment mini-ring */}
            <div className="relative w-9 h-9 flex-shrink-0">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15"
                  fill="none"
                  stroke={isReady ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 15}
                  strokeDashoffset={2 * Math.PI * 15 * (1 - displayAlignment / 100)}
                  transform="rotate(-90 18 18)"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
                {displayAlignment}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-medium text-white/90">
                {justLogged ? "Captured!" : isReady ? "Ready" : "Aligning"}
              </p>
              <p className="text-[9px] text-white/50">
                Conf {displayConfidence}%
              </p>
            </div>
          </div>

          {/* Model loading */}
          {modelLoading && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              <span className="text-[10px] text-white/80">Loading model...</span>
            </div>
          )}
        </div>
      </div>

      {/* Tip / toast / rescan */}
      {justLogged ? (
        <div className="mx-5 px-4 py-2.5 bg-accent/10 border border-accent/20 rounded-xl flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-[11px] text-accent font-medium">Scan logged</span>
        </div>
      ) : canRescan ? (
        <div className="mx-5 flex items-center gap-2">
          <button
            onClick={handleRescan}
            className="flex-1 py-2.5 rounded-xl bg-accent text-accent-fg text-xs font-medium transition-colors cursor-pointer"
          >
            Scan Again
          </button>
          <p className="text-[10px] text-muted shrink-0">or switch pose above</p>
        </div>
      ) : (
        <TipBanner tip={tip} />
      )}

      {mode === "pro" && (
        <div className="px-5">
          <button className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-muted hover:text-text2 transition-colors cursor-pointer">
            Export Scan Data
          </button>
        </div>
      )}
    </div>
  );
}
