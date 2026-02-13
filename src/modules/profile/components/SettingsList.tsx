"use client";

import { useState } from "react";
import Card from "@/components/Card";
import Modal from "@/components/Modal";

export default function SettingsList() {
  const [reminders, setReminders] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <>
      <div className="space-y-2">
        {/* Reminders */}
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text">Scan Reminders</p>
            <p className="text-[11px] text-muted mt-0.5">Get notified to scan</p>
          </div>
          <button
            onClick={() => setReminders(!reminders)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              reminders ? "bg-text/20" : "bg-text/[0.06]"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                reminders ? "left-[22px] bg-accent" : "left-0.5 bg-text/30"
              }`}
            />
          </button>
        </Card>

        {/* Privacy */}
        <Card>
          <p className="text-sm text-text mb-1">Privacy</p>
          <p className="text-[11px] text-muted mb-3">All data is stored locally on your device.</p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full py-2.5 rounded-xl bg-text/[0.04] border border-border text-sm text-text2 hover:text-text transition-colors cursor-pointer"
          >
            Delete All Scans
          </button>
        </Card>

        {/* Links */}
        <Card className="flex items-center justify-between">
          <span className="text-sm text-text2">Terms of Service</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </Card>
        <Card className="flex items-center justify-between">
          <span className="text-sm text-text2">Privacy Policy</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </Card>
      </div>

      {/* Delete confirmation modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <h3 className="text-lg font-semibold text-text mb-2">Delete All Scans?</h3>
        <p className="text-sm text-text2 mb-6">
          This will permanently remove all scan data from your device. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteModal(false)}
            className="flex-1 py-2.5 rounded-xl bg-text/[0.04] border border-border text-sm text-text2 hover:text-text transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowDeleteModal(false)}
            className="flex-1 py-2.5 rounded-xl bg-accent text-accent-fg text-sm font-medium hover:opacity-90 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}
