"use client";

interface Props {
  alignmentScore: number;
  confidenceScore: number;
  isReady: boolean;
}

export default function AlignmentRing({ alignmentScore, confidenceScore, isReady }: Props) {
  const circumference = 2 * Math.PI * 42;
  const progress = (alignmentScore / 100) * circumference;
  const displayAlignment = Math.round(alignmentScore);
  const displayConfidence = Math.round(confidenceScore);

  return (
    <div className="flex items-center gap-4 px-5">
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg width="56" height="56" viewBox="0 0 96 96">
          <circle
            cx="48" cy="48" r="42"
            fill="none"
            stroke="var(--border)"
            strokeWidth="5"
          />
          <circle
            cx="48" cy="48" r="42"
            fill="none"
            stroke={isReady ? "var(--accent)" : "var(--muted)"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text">
          {displayAlignment}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isReady ? "text-text" : "text-text2"}`}>
          {isReady ? "Ready to capture" : "Align your pose"}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${displayAlignment}%`,
                backgroundColor: isReady ? "var(--accent)" : "var(--muted)",
              }}
            />
          </div>
          <span className="text-[10px] text-muted font-medium">{displayAlignment}/100</span>
        </div>
        <p className="text-[10px] text-muted mt-1">
          Confidence: {displayConfidence}%
        </p>
      </div>
    </div>
  );
}
