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
import { addScan, listScans, getLastCheckin } from "@/modules/scan/storage/scanStore";
import { isCheckinTemplate } from "@/modules/scan/models/poseTemplates";
import { runCheckinGates } from "@/modules/scan/services/checkinGatingService";
import { classifyPhoto } from "@/modules/scan/services/photoClassifierService";
import { measureBrightnessFromCanvas } from "@/modules/scan/services/brightnessService";
import { LM } from "@/modules/scan/models/types";
import type { Landmark, WorldLandmark, ScoreBreakdown, SymmetryData, ScanRecord, ScanType, ScanCategory } from "@/modules/scan/models/types";
import ScanInsight from "@/modules/trends/components/ScanInsight";
import PhotoUploadPanel from "@/modules/scan/components/PhotoUploadPanel";

const POSE_DETECT_INTERVAL = 80; // ~12fps
const READY_HOLD_MS = 1500;
const CAPTURE_BUFFER_SIZE = 25; // ~2 seconds of samples

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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
  const [scanMode, setScanMode] = useState<"live" | "upload">("live");

  const cameraRef = useRef<CameraLayerHandle>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [, setConfidenceScore] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [tip, setTip] = useState("Stand in a well-lit area facing the camera");
  const [videoSize, setVideoSize] = useState({ w: 720, h: 960 });
  const [bodyVis, setBodyVis] = useState<"full" | "upper" | "partial" | "none">("none");
  const [justLogged, setJustLogged] = useState(false);
  const [canRescan, setCanRescan] = useState(false);
  const [symmetryData, setSymmetryData] = useState<SymmetryData | null>(null);
  const [capturedData, setCapturedData] = useState<{
    photoDataUrl: string; symmetryScore: number | null; alignmentScore: number;
  } | null>(null);
  const [previousScan, setPreviousScan] = useState<ScanRecord | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);

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
  const latestLandmarksRef = useRef<Landmark[] | null>(null);
  const captureBuffer = useRef<{ si: number; hi: number; vt: number; swm: number; hwm: number; bhm: number }[]>([]);
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
    captureBuffer.current = [];
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

      // Push to capture buffer for median-based capture
      captureBuffer.current.push({
        si: smoothedShoulderIdx.current,
        hi: smoothedHipIdx.current,
        vt: smoothedVTaper.current,
        swm: smoothedShoulderWM.current,
        hwm: smoothedHipWM.current,
        bhm: smoothedBodyHM.current,
      });
      if (captureBuffer.current.length > CAPTURE_BUFFER_SIZE) {
        captureBuffer.current.shift();
      }
    }

    // Symmetry analysis from world landmarks
    if (detectedWorldLandmarks.length >= 33) {
      setSymmetryData(computeSymmetry(detectedWorldLandmarks));
    } else {
      setSymmetryData(null);
    }

    // Ready check (relaxed thresholds for easier capture)
    const nowReady =
      smoothedAlignment.current >= 60 && smoothedConfidence.current >= 50;

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
    latestLandmarksRef.current = detectedLandmarks;
    setTip(generateTip(breakdownRef.current));
  }, [selectedTemplateId, mockMode, modelReady, userHeightCm]);

  // Start detection loop (only in live mode)
  useEffect(() => {
    if (!modelReady || scanMode !== "live") {
      if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);
      poseIntervalRef.current = null;
      return;
    }
    if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);
    poseIntervalRef.current = setInterval(runDetection, POSE_DETECT_INTERVAL);
    return () => {
      if (poseIntervalRef.current) clearInterval(poseIntervalRef.current);
    };
  }, [modelReady, runDetection, scanMode]);

  const handleCapture = useCallback(async () => {
    const template = getTemplate(selectedTemplateId);
    if (!template || !latestMeasurements.current) return;
    if (justLogged) return; // prevent double-fire

    const buf = captureBuffer.current;
    const m = latestMeasurements.current;

    // Use median of buffer for stable values (falls back to current smoothed if buffer too small)
    const medSI = buf.length >= 5 ? median(buf.map(b => b.si)) : smoothedShoulderIdx.current;
    const medHI = buf.length >= 5 ? median(buf.map(b => b.hi)) : smoothedHipIdx.current;
    const medVT = buf.length >= 5 ? median(buf.map(b => b.vt)) : smoothedVTaper.current;
    const medSWM = buf.length >= 5 ? median(buf.map(b => b.swm)) : smoothedShoulderWM.current;
    const medHWM = buf.length >= 5 ? median(buf.map(b => b.hwm)) : smoothedHipWM.current;
    const medBHM = buf.length >= 5 ? median(buf.map(b => b.bhm)) : smoothedBodyHM.current;

    // Compute calibrated cm from median world measurements
    let shoulderWidthCm = 0;
    let hipWidthCm = 0;
    let bodyHeightCm = 0;
    if (userHeightCm && medBHM > 0.1) {
      const factor = (userHeightCm / 100) / medBHM;
      shoulderWidthCm = medSWM * factor * 100;
      hipWidthCm = medHWM * factor * 100;
      bodyHeightCm = medBHM * factor * 100;
    }

    // Capture progress photo from video frame
    let photoDataUrl = "";
    const video = cameraRef.current?.videoEl;
    if (video && video.readyState >= 2 && !mockMode) {
      const offscreen = document.createElement("canvas");
      offscreen.width = video.videoWidth;
      offscreen.height = video.videoHeight;
      const octx = offscreen.getContext("2d");
      if (octx) {
        // Mirror to match what user sees on screen
        octx.translate(offscreen.width, 0);
        octx.scale(-1, 1);
        octx.drawImage(video, 0, 0);
        photoDataUrl = offscreen.toDataURL("image/jpeg", 0.75);
      }
    }

    // V2 classification: classify the captured frame
    const lm = latestLandmarksRef.current;
    const vw = mockMode ? 720 : (video?.videoWidth ?? 720);
    const vh = mockMode ? 960 : (video?.videoHeight ?? 960);

    let scanCategory: ScanCategory = "GALLERY";
    let scanType: ScanType = "GALLERY";
    let avgBrightness = 128;
    let qualityScore = 0;
    let lightingScore = 0;
    let framingScore = 0;
    let poseMatchScore = 0;
    let poseDirection: "FRONT" | "BACK" | "UNKNOWN" = "UNKNOWN";
    let trackedRegions: string[] = [];

    if (lm) {
      // Measure brightness from the captured frame canvas
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = vw;
      captureCanvas.height = vh;
      const cCtx = captureCanvas.getContext("2d");
      if (cCtx && video && !mockMode) {
        cCtx.translate(captureCanvas.width, 0);
        cCtx.scale(-1, 1);
        cCtx.drawImage(video, 0, 0);
      }
      avgBrightness = cCtx ? measureBrightnessFromCanvas(captureCanvas) : 128;

      const classification = classifyPhoto(lm, vw, vh, avgBrightness, smoothedAlignment.current);
      scanCategory = classification.category;
      poseDirection = classification.poseDirection;
      trackedRegions = classification.trackedRegions;
      qualityScore = classification.scores.quality;
      lightingScore = classification.scores.lighting;
      framingScore = classification.scores.framing;
      poseMatchScore = classification.scores.poseMatch;

      // Map V2 category to V1 scanType for backward compat
      scanType = scanCategory === "GALLERY" ? "GALLERY" : "CHECKIN";
    }

    // V1 check-in gating for check-in templates (additional gate check)
    if (isCheckinTemplate(selectedTemplateId) && lm) {
      const lAnkle = lm[LM.LEFT_ANKLE];
      const rAnkle = lm[LM.RIGHT_ANKLE];
      let stanceWidthPx = 0;
      if (lAnkle && rAnkle && lAnkle.visibility > 0.2 && rAnkle.visibility > 0.2) {
        const adx = (lAnkle.x - rAnkle.x) * vw;
        const ady = (lAnkle.y - rAnkle.y) * vh;
        stanceWidthPx = Math.sqrt(adx * adx + ady * ady);
      }

      const lHip = lm[LM.LEFT_HIP];
      const rHip = lm[LM.RIGHT_HIP];
      let hipTiltDeg = 0;
      if (lHip && rHip && lHip.visibility > 0.2 && rHip.visibility > 0.2) {
        const hdx = (rHip.x - lHip.x) * vw;
        const hdy = (rHip.y - lHip.y) * vh;
        hipTiltDeg = (Math.atan2(hdy, hdx) * 180) / Math.PI;
      }

      const prevCheckin = await getLastCheckin(selectedTemplateId);
      const gates = runCheckinGates(
        lm, vw, vh, selectedTemplateId,
        m.bodyHeightPx, stanceWidthPx, hipTiltDeg,
        prevCheckin
      );

      if (!gates.allPassed) {
        scanType = "GALLERY";
        scanCategory = "GALLERY";
        const reasons: string[] = [];
        if (!gates.gateA.passed) reasons.push(`missing: ${gates.gateA.missingJoints.join(", ")}`);
        if (!gates.gateB.passed) reasons.push(gates.gateB.reason);
        if (!gates.gateC.passed) reasons.push("pose inconsistent with previous check-in");
        if (gates.gateD.sameDayBlock) reasons.push("already checked in today");
        setGateMessage(`Saved as Gallery — ${reasons.join("; ")}`);
        setTimeout(() => setGateMessage(null), 6000);
      } else {
        setGateMessage(null);
      }
    }

    await addScan({
      timestamp: Date.now(),
      poseId: selectedTemplateId,
      alignmentScore: Math.round(smoothedAlignment.current),
      confidenceScore: Math.round(smoothedConfidence.current),
      shoulderIndex: Math.round(medSI * 1000) / 1000,
      hipIndex: Math.round(medHI * 1000) / 1000,
      vTaperIndex: Math.round(medVT * 1000) / 1000,
      shoulderWidthPx: Math.round(m.shoulderWidthPx),
      hipWidthPx: Math.round(m.hipWidthPx),
      bodyHeightPx: Math.round(m.bodyHeightPx),
      shoulderWidthCm: Math.round(shoulderWidthCm * 10) / 10,
      hipWidthCm: Math.round(hipWidthCm * 10) / 10,
      bodyHeightCm: Math.round(bodyHeightCm * 10) / 10,
      symmetryScore: Math.round(symmetryData?.overallScore ?? 0),
      photoDataUrl,
      scanType,
      avgBrightness,
      // V2 classification fields
      scanCategory,
      poseDirection,
      trackedRegions,
      qualityScore: Math.round(qualityScore),
      lightingScore: Math.round(lightingScore),
      framingScore: Math.round(framingScore),
      poseMatchScore: Math.round(poseMatchScore),
    });

    // Store captured values for ScanInsight display
    setCapturedData({
      photoDataUrl,
      symmetryScore: symmetryData ? Math.round(symmetryData.overallScore) : null,
      alignmentScore: Math.round(smoothedAlignment.current),
    });

    // Fetch previous scan for delta comparison (the one before current)
    const recentScans = await listScans(selectedTemplateId, 2);
    // recentScans[0] is the one we just added, [1] is the previous
    setPreviousScan(recentScans.length >= 2 ? recentScans[1] : null);

    hasCapturedThisSession.current = true;
    setJustLogged(true);
    setTimeout(() => {
      setJustLogged(false);
      setCanRescan(true);
    }, 5000); // Show insight for 5 seconds instead of 3
  }, [selectedTemplateId, justLogged, userHeightCm, symmetryData, mockMode]);

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

  return (
    <div className="flex flex-col gap-3 pt-1 pb-4">
      <TemplateChips />

      {/* Tab bar: Live Scan / Upload Photo */}
      <div className="flex gap-1 mx-5 p-1 bg-text/[0.05] rounded-xl">
        <button
          onClick={() => setScanMode("live")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            scanMode === "live"
              ? "bg-accent text-accent-fg"
              : "text-text2 hover:text-text"
          }`}
        >
          Live Scan
        </button>
        <button
          onClick={() => setScanMode("upload")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            scanMode === "upload"
              ? "bg-accent text-accent-fg"
              : "text-text2 hover:text-text"
          }`}
        >
          Upload Photo
        </button>
      </div>

      {scanMode === "live" ? (
        <>
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
                    {justLogged ? "Captured!" : isReady ? "Ready!" : displayAlignment >= 45 ? "Almost there..." : "Match the pose"}
                  </p>
                  <p className="text-[9px] text-white/50">
                    {isReady ? "Hold still" : "Align with the ghost"}
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

          {/* Tip / toast / rescan / manual capture */}
          {/* Gate failure message */}
          {gateMessage && (
            <div className="mx-5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[11px] text-amber-400">{gateMessage}</p>
            </div>
          )}

          {justLogged && capturedData ? (
            <ScanInsight
              poseId={selectedTemplateId}
              photoDataUrl={capturedData.photoDataUrl}
              symmetryScore={capturedData.symmetryScore}
              alignmentScore={capturedData.alignmentScore}
              previousScan={previousScan}
            />
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
            <>
              <TipBanner tip={tip} />
              {bodyVis !== "none" && !justLogged && !canRescan && landmarks && (
                <div className="mx-5">
                  <button
                    onClick={handleCapture}
                    className="w-full py-3 rounded-xl bg-accent text-accent-fg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Capture Now
                  </button>
                </div>
              )}
            </>
          )}

          {mode === "pro" && (
            <div className="px-5">
              <button className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-muted hover:text-text2 transition-colors cursor-pointer">
                Export Scan Data
              </button>
            </div>
          )}
        </>
      ) : (
        <PhotoUploadPanel />
      )}
    </div>
  );
}
