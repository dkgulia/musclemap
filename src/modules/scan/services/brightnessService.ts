/**
 * Brightness check: samples a small canvas to compute average luma.
 * The canvas is 32x18 to minimize work. Pixels are discarded immediately.
 * NO image data is stored or exported.
 */

const SAMPLE_W = 32;
const SAMPLE_H = 18;

let offCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let offCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function getOffscreenCtx() {
  if (offCtx) return offCtx;
  try {
    offCanvas = new OffscreenCanvas(SAMPLE_W, SAMPLE_H);
    offCtx = offCanvas.getContext("2d")!;
  } catch {
    // Fallback for browsers without OffscreenCanvas
    offCanvas = document.createElement("canvas");
    offCanvas.width = SAMPLE_W;
    offCanvas.height = SAMPLE_H;
    offCtx = offCanvas.getContext("2d")!;
  }
  return offCtx;
}

/**
 * Returns average brightness 0..255 from a video frame.
 * Reads pixels from a tiny in-memory canvas and discards them immediately.
 */
export function measureBrightness(video: HTMLVideoElement): number {
  const ctx = getOffscreenCtx();
  if (!ctx) return 128; // fallback mid-brightness

  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const imageData = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const data = imageData.data;

  let totalLuma = 0;
  const pixelCount = SAMPLE_W * SAMPLE_H;
  for (let i = 0; i < data.length; i += 4) {
    // ITU-R BT.601 luma
    totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Immediately discard
  ctx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);

  return totalLuma / pixelCount;
}

/**
 * Returns average brightness 0..255 from a canvas (for photo uploads).
 * Same luma formula as video, but reads from canvas instead of video element.
 */
export function measureBrightnessFromCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas
): number {
  const ctx = getOffscreenCtx();
  if (!ctx) return 128;

  ctx.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H);
  const imageData = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const data = imageData.data;

  let totalLuma = 0;
  const pixelCount = SAMPLE_W * SAMPLE_H;
  for (let i = 0; i < data.length; i += 4) {
    totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  ctx.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
  return totalLuma / pixelCount;
}

/**
 * Convert brightness 0..255 to a score component 0..20.
 * Ideal range: 60..200. Below 40 or above 230 heavily penalized.
 */
export function brightnessScore(avgLuma: number): number {
  if (avgLuma >= 60 && avgLuma <= 200) return 20;
  if (avgLuma < 30) return 4;
  if (avgLuma > 240) return 8;
  if (avgLuma < 60) return 4 + ((avgLuma - 30) / 30) * 16;
  // avgLuma > 200
  return 20 - ((avgLuma - 200) / 40) * 12;
}
