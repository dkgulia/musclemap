"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import TemplateChips from "@/modules/scan/components/TemplateChips";
import RecentScansList from "@/modules/trends/components/RecentScansList";
import GrowthInsights from "@/modules/trends/components/GrowthInsights";
import AIReport from "@/modules/trends/components/AIReport";
import { listScans, clearAll } from "@/modules/scan/storage/scanStore";
import type { ScanRecord } from "@/modules/scan/models/types";
import Modal from "@/components/Modal";

export default function TrendsPage() {
  const { selectedTemplateId, userHeightCm } = useApp();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);

  const loadScans = useCallback(async () => {
    setLoading(true);
    const data = await listScans(selectedTemplateId, 50);
    setScans(data);
    setLoading(false);
  }, [selectedTemplateId]);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleClearAll = async () => {
    await clearAll();
    setScans([]);
    setShowClearModal(false);
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TemplateChips />

      <div className="px-5 flex flex-col gap-4">
        {/* Growth insights summary — based on check-in scans only */}
        {!loading && (
          <>
            <GrowthInsights scans={scans.filter(s => s.scanType === "CHECKIN")} poseId={selectedTemplateId} />
            {scans.some(s => s.scanType === "CHECKIN") && (
              <p className="text-[10px] text-muted -mt-2 px-1">Based on check-in scans only</p>
            )}
          </>
        )}

        {/* Photo grid */}
        {loading ? (
          <div className="bg-surface border border-border rounded-2xl px-4 py-8 text-center">
            <div className="w-5 h-5 border-2 border-border border-t-muted rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted">Loading...</p>
          </div>
        ) : (
          <RecentScansList scans={scans.slice(0, 30)} onDelete={loadScans} />
        )}

        {/* AI Report */}
        {!loading && (
          <AIReport scans={scans} heightCm={userHeightCm} />
        )}

        {/* Actions */}
        {scans.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            className="w-full py-2.5 rounded-xl bg-surface border border-border text-xs text-muted hover:text-red-400 hover:border-red-400/30 transition-colors cursor-pointer"
          >
            Clear All Data
          </button>
        )}
      </div>

      <Modal open={showClearModal} onClose={() => setShowClearModal(false)}>
        <div className="text-center">
          <h3 className="text-base font-semibold text-text mb-2">Clear All Data?</h3>
          <p className="text-sm text-text2 mb-6">
            This will permanently delete all photos and scan data from this device. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowClearModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm text-text2 hover:text-text transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
            >
              Delete All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
