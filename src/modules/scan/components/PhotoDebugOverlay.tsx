"use client";

import { useEffect, useRef } from "react";
import type { SliceIndices } from "../models/types";

interface Props {
  binaryMask: Uint8Array | null;
  maskWidth: number;
  maskHeight: number;
  sliceYPositions: {
    hipY: number;
    upperThighY: number;
    midThighY: number;
    calfY: number;
  } | null;
  canvasWidth: number;
  canvasHeight: number;
  sliceIndices?: SliceIndices | null;
}

const SLICE_COLORS = [
  "#FF6B6B", // hip — red
  "#FFD93D", // upper thigh — yellow
  "#6BCB77", // mid thigh — green
  "#4D96FF", // calf — blue
];

const SLICE_LABELS = ["Hip", "Upper Thigh", "Mid Thigh", "Calf"];

export default function PhotoDebugOverlay({
  binaryMask,
  maskWidth,
  maskHeight,
  sliceYPositions,
  canvasWidth,
  canvasHeight,
  sliceIndices,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw mask outline
    if (binaryMask && maskWidth > 0 && maskHeight > 0) {
      const scaleX = canvasWidth / maskWidth;
      const scaleY = canvasHeight / maskHeight;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;

      // Sample every few rows for performance
      const step = Math.max(1, Math.floor(maskHeight / 100));
      for (let y = 0; y < maskHeight; y += step) {
        const rowStart = y * maskWidth;
        let leftEdge = -1;
        let rightEdge = -1;

        for (let x = 0; x < maskWidth; x++) {
          if (binaryMask[rowStart + x] === 1) {
            leftEdge = x;
            break;
          }
        }
        for (let x = maskWidth - 1; x >= 0; x--) {
          if (binaryMask[rowStart + x] === 1) {
            rightEdge = x;
            break;
          }
        }

        if (leftEdge >= 0 && rightEdge >= 0) {
          // Draw edge dots
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(leftEdge * scaleX, y * scaleY, 2, 2);
          ctx.fillRect(rightEdge * scaleX, y * scaleY, 2, 2);
        }
      }
    }

    // Draw slice lines
    if (sliceYPositions) {
      const yPositions = [
        sliceYPositions.hipY,
        sliceYPositions.upperThighY,
        sliceYPositions.midThighY,
        sliceYPositions.calfY,
      ];

      // Width index values for each slice
      const widthValues = sliceIndices
        ? [
            sliceIndices.hipBandWidthIndex,
            sliceIndices.upperThighWidthIndex,
            sliceIndices.midThighWidthIndex,
            sliceIndices.calfWidthIndex,
          ]
        : null;

      yPositions.forEach((y, i) => {
        ctx.strokeStyle = SLICE_COLORS[i];
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label + width percentage
        ctx.fillStyle = SLICE_COLORS[i];
        ctx.font = "11px system-ui, sans-serif";
        const label = widthValues
          ? `${SLICE_LABELS[i]} ${(widthValues[i] * 100).toFixed(1)}%`
          : SLICE_LABELS[i];
        ctx.fillText(label, 6, y - 4);
      });
    }
  }, [binaryMask, maskWidth, maskHeight, sliceYPositions, canvasWidth, canvasHeight, sliceIndices]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
