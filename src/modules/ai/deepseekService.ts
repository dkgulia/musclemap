/**
 * Client-side service for generating AI progress reports via DeepSeek R1.
 * Calls the /api/ai/report server-side route.
 */

import type { ScanRecord } from "@/modules/scan/models/types";
import { getConfidenceLabel } from "@/modules/scan/models/types";
import type { MeasurementEntry } from "@/modules/measurements/measurementStore";

export async function generateProgressReport(
  scans: ScanRecord[],
  measurements: MeasurementEntry[],
  heightCm: number | null
): Promise<string> {
  const response = await fetch("/api/ai/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scans: scans.slice(0, 10).map((s) => ({
        timestamp: s.timestamp,
        poseId: s.poseId,
        symmetryScore: s.symmetryScore,
        scanType: s.scanType ?? "GALLERY",
        confidenceLabel: getConfidenceLabel(s.confidenceScore ?? 0),
        scanCategory: s.scanCategory ?? "GALLERY",
      })),
      measurements: measurements.slice(0, 30).map((m) => ({
        timestamp: m.timestamp,
        name: m.name,
        value: m.value,
        unit: m.unit,
      })),
      heightCm,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.report as string;
}
