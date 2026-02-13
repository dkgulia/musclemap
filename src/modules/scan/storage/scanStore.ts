/**
 * IndexedDB storage for scan records.
 * Stores ONLY numeric measurements + timestamp + poseId.
 * NO images, NO pixels, NO blobs.
 */

import type { ScanRecord } from "../models/types";

const DB_NAME = "musclemap";
const DB_VERSION = 2;
const STORE_NAME = "scans";

function normalizeScanRecord(raw: Record<string, unknown>): ScanRecord {
  const rec = raw as unknown as ScanRecord;
  return {
    ...rec,
    shoulderWidthCm: rec.shoulderWidthCm ?? 0,
    hipWidthCm: rec.hipWidthCm ?? 0,
    bodyHeightCm: rec.bodyHeightCm ?? 0,
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("poseId", "poseId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      // v1 → v2: No structural changes needed.
      // New cm fields are just additional properties on value objects.
      // Old records are normalized on read via normalizeScanRecord().
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addScan(record: Omit<ScanRecord, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
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
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
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
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countScans(poseId?: string): Promise<number> {
  const scans = await listScans(poseId, 9999);
  return scans.length;
}
