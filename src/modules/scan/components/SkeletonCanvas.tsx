"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Landmark, SymmetryData } from "../models/types";
import { SKELETON_CONNECTIONS, LM } from "../models/types";

interface Props {
  landmarks: Landmark[] | null;
  videoWidth: number;
  videoHeight: number;
  isReady: boolean;
  symmetryData?: SymmetryData | null;
}

/**
 * Draws skeleton overlay on a <canvas> positioned over the camera.
 * Uses requestAnimationFrame — no React re-renders per frame.
 * Canvas is mirrored to match the video mirror.
 */
export default function SkeletonCanvas({
  landmarks,
  videoWidth,
  videoHeight,
  isReady,
  symmetryData,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef(landmarks);
  const readyRef = useRef(isReady);
  const symmetryRef = useRef(symmetryData);
  const rafRef = useRef<number>(0);

  landmarksRef.current = landmarks;
  readyRef.current = isReady;
  symmetryRef.current = symmetryData;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const lm = landmarksRef.current;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!lm) return;

    // Mirror transform to match video
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    const color = readyRef.current
      ? "rgba(245, 245, 247, 0.9)"
      : "rgba(245, 245, 247, 0.5)";
    const jointColor = readyRef.current
      ? "rgba(245, 245, 247, 1)"
      : "rgba(245, 245, 247, 0.7)";

    // Draw connections
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    for (const [a, b] of SKELETON_CONNECTIONS) {
      const la = lm[a];
      const lb = lm[b];
      if (!la || !lb || la.visibility < 0.3 || lb.visibility < 0.3) continue;

      ctx.beginPath();
      ctx.moveTo(la.x * w, la.y * h);
      ctx.lineTo(lb.x * w, lb.y * h);
      ctx.stroke();
    }

    // Draw joints
    const jointIndices = [
      LM.NOSE,
      LM.LEFT_SHOULDER,
      LM.RIGHT_SHOULDER,
      LM.LEFT_ELBOW,
      LM.RIGHT_ELBOW,
      LM.LEFT_WRIST,
      LM.RIGHT_WRIST,
      LM.LEFT_HIP,
      LM.RIGHT_HIP,
      LM.LEFT_KNEE,
      LM.RIGHT_KNEE,
      LM.LEFT_ANKLE,
      LM.RIGHT_ANKLE,
    ];

    for (const idx of jointIndices) {
      const l = lm[idx];
      if (!l || l.visibility < 0.3) continue;

      ctx.beginPath();
      ctx.arc(l.x * w, l.y * h, 4, 0, Math.PI * 2);
      ctx.fillStyle = jointColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Symmetry heatmap glow
    const sym = symmetryRef.current;
    if (sym) {
      const colorMap = {
        balanced: "rgba(34, 197, 94, 0.6)",
        moderate: "rgba(234, 179, 8, 0.6)",
        imbalanced: "rgba(239, 68, 68, 0.6)",
      };
      const radiusMap = { balanced: 8, moderate: 12, imbalanced: 16 };

      for (const pair of sym.pairs) {
        const glowColor = colorMap[pair.status];
        const glowRadius = radiusMap[pair.status];

        for (const idx of [pair.leftIndex, pair.rightIndex]) {
          const l = lm[idx];
          if (!l || l.visibility < 0.3) continue;

          const gx = l.x * w;
          const gy = l.y * h;
          const gradient = ctx.createRadialGradient(gx, gy, 2, gx, gy, glowRadius);
          gradient.addColorStop(0, glowColor);
          gradient.addColorStop(1, "rgba(0,0,0,0)");

          ctx.beginPath();
          ctx.arc(gx, gy, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }
    }

    ctx.restore();

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      width={videoWidth}
      height={videoHeight}
    />
  );
}
