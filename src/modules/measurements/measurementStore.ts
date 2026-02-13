/**
 * IndexedDB storage for manual body measurements (tape measurements).
 * Flexible schema: each entry is { name, value, unit }.
 * Users can track any body part they want.
 */

import { openDB, MEASUREMENTS_STORE } from "@/modules/shared/db";

export interface MeasurementEntry {
  id?: number;
  timestamp: number;
  name: string;   // user-defined: "Chest", "Left Bicep", "Neck", etc.
  value: number;  // measurement value
  unit: string;   // "cm" or "in"
}

export async function addMeasurement(
  entry: Omit<MeasurementEntry, "id">
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEASUREMENTS_STORE, "readwrite");
    const store = tx.objectStore(MEASUREMENTS_STORE);
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function listMeasurements(
  limit: number = 200
): Promise<MeasurementEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEASUREMENTS_STORE, "readonly");
    const store = tx.objectStore(MEASUREMENTS_STORE);
    const index = store.index("timestamp");
    const req = index.openCursor(null, "prev");
    const results: MeasurementEntry[] = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as MeasurementEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get all entries for a specific measurement name, newest first */
export async function getHistory(
  name: string,
  limit: number = 50
): Promise<MeasurementEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEASUREMENTS_STORE, "readonly");
    const store = tx.objectStore(MEASUREMENTS_STORE);
    const index = store.index("timestamp");
    const req = index.openCursor(null, "prev");
    const results: MeasurementEntry[] = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        const entry = cursor.value as MeasurementEntry;
        if (entry.name === name) {
          results.push(entry);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get the most recent entry for each unique measurement name */
export async function getLatestByName(): Promise<Map<string, MeasurementEntry>> {
  const all = await listMeasurements(500);
  const map = new Map<string, MeasurementEntry>();
  // all is sorted newest first, so first occurrence per name is the latest
  for (const entry of all) {
    if (!map.has(entry.name)) {
      map.set(entry.name, entry);
    }
  }
  return map;
}

/** Get all unique measurement names the user has ever logged */
export async function getUniqueNames(): Promise<string[]> {
  const map = await getLatestByName();
  return Array.from(map.keys());
}

/** Get the second-most-recent entry for a name (for computing delta) */
export async function getPreviousEntry(
  name: string
): Promise<MeasurementEntry | null> {
  const history = await getHistory(name, 2);
  return history.length >= 2 ? history[1] : null;
}
