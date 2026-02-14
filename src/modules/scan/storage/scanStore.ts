/**
 * IndexedDB storage for scan records.
 * Stores numeric measurements + progress photo + timestamp + poseId.
 */

import type { ScanRecord } from "../models/types";
import { openDB, SCANS_STORE, PHOTO_BLOBS_STORE } from "@/modules/shared/db";

function normalizeScanRecord(raw: Record<string, unknown>): ScanRecord {
  const rec = raw as unknown as ScanRecord;
  return {
    ...rec,
    shoulderWidthCm: rec.shoulderWidthCm ?? 0,
    hipWidthCm: rec.hipWidthCm ?? 0,
    bodyHeightCm: rec.bodyHeightCm ?? 0,
    symmetryScore: rec.symmetryScore ?? 0,
    photoDataUrl: rec.photoDataUrl ?? "",
    // Photo scan fields (optional, default to undefined for live scans)
    isPhotoScan: rec.isPhotoScan,
    hipBandWidthIndex: rec.hipBandWidthIndex,
    upperThighWidthIndex: rec.upperThighWidthIndex,
    midThighWidthIndex: rec.midThighWidthIndex,
    calfWidthIndex: rec.calfWidthIndex,
    stanceWidthIndex: rec.stanceWidthIndex,
    hipTiltDeg: rec.hipTiltDeg,
    shoulderTiltDeg: rec.shoulderTiltDeg,
    segmentationQuality: rec.segmentationQuality,
    consistencyScore: rec.consistencyScore,
    photoBlobKey: rec.photoBlobKey,
    // Check-in system fields
    scanType: rec.scanType ?? "GALLERY",
    avgBrightness: rec.avgBrightness,
    stanceWidthPx: rec.stanceWidthPx,
    // V2 classification fields
    scanCategory: rec.scanCategory ?? "GALLERY",
    poseDirection: rec.poseDirection,
    trackedRegions: rec.trackedRegions,
    qualityScore: rec.qualityScore,
    lightingScore: rec.lightingScore,
    framingScore: rec.framingScore,
    poseMatchScore: rec.poseMatchScore,
  };
}

export async function addScan(record: Omit<ScanRecord, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCANS_STORE, "readwrite");
    const store = tx.objectStore(SCANS_STORE);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function listScans(
  poseId?: string,
  limit: number = 50
): Promise<ScanRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCANS_STORE, "readonly");
    const store = tx.objectStore(SCANS_STORE);
    const index = store.index("timestamp");
    const req = index.openCursor(null, "prev"); // newest first
    const results: ScanRecord[] = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        const record = normalizeScanRecord(cursor.value as Record<string, unknown>);
        if (!poseId || record.poseId === poseId) {
          results.push(record);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteScan(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCANS_STORE, "readwrite");
    const store = tx.objectStore(SCANS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCANS_STORE, "readwrite");
    const store = tx.objectStore(SCANS_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countScans(poseId?: string): Promise<number> {
  const scans = await listScans(poseId, 9999);
  return scans.length;
}

// ─── Check-in Queries ───────────────────────────────────────────

/** List only CHECKIN scans for a given poseId, newest first */
export async function listCheckinScans(
  poseId: string,
  limit: number = 50
): Promise<ScanRecord[]> {
  const all = await listScans(poseId, limit * 3);
  return all.filter((s) => s.scanType === "CHECKIN").slice(0, limit);
}

/** Get the most recent CHECKIN scan for a poseId */
export async function getLastCheckin(
  poseId: string
): Promise<ScanRecord | null> {
  const checkins = await listCheckinScans(poseId, 1);
  return checkins[0] ?? null;
}

// ─── V2 Category Queries ────────────────────────────────────────

/** List scans by V2 category for a given poseId, newest first */
export async function listByCategory(
  category: string,
  poseId?: string,
  limit: number = 50
): Promise<ScanRecord[]> {
  const all = await listScans(poseId, limit * 3);
  return all.filter((s) => s.scanCategory === category).slice(0, limit);
}

/** Get the most recent scan of a given category + poseId */
export async function getLastByCategory(
  category: string,
  poseId: string
): Promise<ScanRecord | null> {
  const results = await listByCategory(category, poseId, 1);
  return results[0] ?? null;
}

// ─── Photo Blob Storage ─────────────────────────────────────────

export async function savePhotoBlob(blob: Blob): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_BLOBS_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_BLOBS_STORE);
    const req = store.add({ blob });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPhotoBlob(id: number): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_BLOBS_STORE, "readonly");
    const store = tx.objectStore(PHOTO_BLOBS_STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result as { id: number; blob: Blob } | undefined;
      resolve(record?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhotoBlob(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_BLOBS_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_BLOBS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
