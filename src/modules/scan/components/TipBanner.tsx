"use client";

interface Props {
  tip?: string;
}

export default function TipBanner({ tip }: Props) {
  const displayTip = tip || "Stand in a well-lit area facing the camera";

  return (
    <div className="mx-5 px-4 py-2.5 bg-surface border border-border rounded-xl flex items-center gap-2.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span className="text-[11px] text-text2">{displayTip}</span>
    </div>
  );
}
