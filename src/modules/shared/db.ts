/**
 * Shared IndexedDB opener for the musclemap database.
 * Both scanStore and measurementStore import from here
 * to avoid version conflicts.
 */

const DB_NAME = "musclemap";
const DB_VERSION = 4;

export const SCANS_STORE = "scans";
export const MEASUREMENTS_STORE = "measurements";
export const PHOTO_BLOBS_STORE = "photoBlobs";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

      if (oldVersion < 1) {
        const scanStore = db.createObjectStore(SCANS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        scanStore.createIndex("poseId", "poseId", { unique: false });
        scanStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // v2: No structural changes (cm fields normalized on read)

      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(MEASUREMENTS_STORE)) {
          const measStore = db.createObjectStore(MEASUREMENTS_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          measStore.createIndex("name", "name", { unique: false });
          measStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      }

      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(PHOTO_BLOBS_STORE)) {
          db.createObjectStore(PHOTO_BLOBS_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  return dbPromise;
}
