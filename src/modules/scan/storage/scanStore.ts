/**
 * IndexedDB storage for scan records.
 * Stores ONLY numeric measurements + timestamp + poseId.
 * NO images, NO pixels, NO blobs.
 */

import type { ScanRecord } from "../models/types";
import { openDB, SCANS_STORE } from "@/modules/shared/db";

function normalizeScanRecord(raw: Record<string, unknown>): ScanRecord {
  const rec = raw as unknown as ScanRecord;
  return {
    ...rec,
    shoulderWidthCm: rec.shoulderWidthCm ?? 0,
    hipWidthCm: rec.hipWidthCm ?? 0,
    bodyHeightCm: rec.bodyHeightCm ?? 0,
    symmetryScore: rec.symmetryScore ?? 0,
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
