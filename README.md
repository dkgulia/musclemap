# MuscleMap

Privacy-first physique tracking PWA. Pose-based body scanning with real-time measurements — **no images are ever saved**.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000/app/scan](http://localhost:3000/app/scan) to start scanning.

## HTTPS Note for Camera

Camera access (`getUserMedia`) requires a **secure context**:

- **localhost** works without HTTPS (Chrome, Firefox, Safari)
- **LAN/remote testing** requires HTTPS. Use one of:
  ```bash
  # Option 1: ngrok
  npx ngrok http 3000

  # Option 2: mkcert for local HTTPS
  mkcert localhost && npx next dev --experimental-https
  ```

## iOS Safari Permissions

- Camera permission is requested on first scan
- If denied, go to **Settings > Safari > Camera** and set to "Allow"
- PWA mode (Add to Home Screen) may require re-granting camera permission
- MediaPipe WASM loads from CDN — requires internet on first launch

## Mock Mode

Test without a camera or pose model:

```
http://localhost:3000/app/scan?mock=1
```

This generates synthetic landmarks that sway naturally, allowing you to test the full scoring pipeline without hardware.

## Architecture

```
src/
  modules/scan/
    models/
      types.ts          — Landmark, ScanRecord, PoseTemplate types
      poseTemplates.ts   — 4 pose templates with normalized coordinates
    services/
      cameraService.ts   — getUserMedia lifecycle
      poseService.ts     — MediaPipe PoseLandmarker (browser WASM+GPU)
      scoringService.ts  — Alignment, confidence, measurements, EMA
      brightnessService.ts — Tiny-canvas luma check
      mockLandmarks.ts   — Synthetic landmark generator for testing
    storage/
      scanStore.ts       — IndexedDB CRUD (addScan, listScans, deleteScan, clearAll)
    components/
      CameraLayer.tsx    — Live <video> with getUserMedia
      SkeletonCanvas.tsx — Canvas overlay drawing skeleton at 60fps
      GhostOverlay.tsx   — SVG silhouette overlay (~15% opacity)
      AlignmentRing.tsx  — Circular progress + confidence display
      CaptureBar.tsx     — Log Scan button with ready gating
      TipBanner.tsx      — Context-aware tip based on weakest score
      TemplateChips.tsx   — Pose template selector pills
```

## No Image Saved Guarantee

This app **never** persists pixel data:

1. **No `toDataURL()`, `toBlob()`, or `captureStream()`** — search the codebase; zero calls exist
2. **No upload** — no fetch/XHR sends image data anywhere
3. **Brightness check** uses a 32x18 in-memory canvas, reads pixels, computes average luma, and immediately calls `clearRect()` to discard
4. **IndexedDB stores only**: `{ timestamp, poseId, alignmentScore, confidenceScore, shoulderIndex, hipIndex, vTaperIndex, shoulderWidthPx, hipWidthPx, bodyHeightPx }`
5. **Camera stream** is stopped on component unmount

To verify:

```bash
# Search for any image-saving APIs in source
grep -r "toDataURL\|toBlob\|captureStream\|createObjectURL" src/
# Should return zero results
```

## Measurement Logic

All measurements use normalized MediaPipe Pose landmarks (0..1 → pixel coordinates):

| Metric | Formula |
|--------|---------|
| Shoulder Width | `dist(leftShoulder, rightShoulder)` in px |
| Hip Width | `dist(leftHip, rightHip)` in px |
| Body Height | `dist(nose, midpoint(ankles))` in px |
| Shoulder Index | `shoulderWidth / bodyHeight` |
| Hip Index | `hipWidth / bodyHeight` |
| V-Taper Index | `shoulderWidth / hipWidth` |

**Alignment score** (0-100): Weighted average of per-joint error between normalized pose and template, mapped through `100 - error * 350`.

**Confidence score** (0-100): Sum of four components:
- Landmarks visible (30 pts) — required joints with visibility > 0.5
- Brightness (20 pts) — average luma in ideal range 60-200
- Distance (20 pts) — body height ratio 55%-85% of frame
- Pose match (30 pts) — alignment score scaled

**EMA smoothing** (alpha=0.2) applied to both scores to reduce jitter.

## PWA

- `public/manifest.json` — app manifest
- `public/sw.js` — service worker (caches static assets, network-first for navigation)
- Installable on mobile via "Add to Home Screen"

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS v4
- MediaPipe Tasks Vision (Pose Landmarker)
- IndexedDB (raw API, no wrapper library)
- Framer Motion
