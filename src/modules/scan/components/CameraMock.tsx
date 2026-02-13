"use client";

export default function CameraMock() {
  return (
    <div className="relative w-full aspect-[3/4] sm:aspect-[9/16] max-h-[65vh] bg-surface2 rounded-2xl border border-border overflow-hidden">
      {/* Real camera background image */}
      <img
        src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500&q=80&fit=crop"
        alt="Pose reference"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-transparent to-bg/60" />

      {/* Scan grid overlay */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.08]">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, var(--muted) 39px, var(--muted) 40px)`,
          backgroundSize: "100% 40px",
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 39px, var(--muted) 39px, var(--muted) 40px)`,
          backgroundSize: "40px 100%",
        }} />
      </div>

      {/* Animated scan line */}
      <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none">
        <div className="scan-grid-anim absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-accent/[0.08] to-transparent" />
      </div>

      {/* Skeleton mock points */}
      <div className="absolute inset-0 flex items-center justify-center opacity-60">
        <svg width="140" height="280" viewBox="0 0 140 280" fill="none">
          {[
            [70, 28], [70, 68], [70, 110], [70, 160],
            [38, 82], [102, 82], [20, 130], [120, 130],
            [10, 170], [130, 170], [45, 200], [95, 200],
            [40, 240], [100, 240], [38, 272], [102, 272],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="4" fill="var(--accent)" fillOpacity="0.7" />
          ))}
          {[
            [[70,28],[70,68]], [[70,68],[38,82]], [[70,68],[102,82]],
            [[38,82],[20,130]], [[102,82],[120,130]],
            [[20,130],[10,170]], [[120,130],[130,170]],
            [[70,68],[70,110]], [[70,110],[70,160]],
            [[70,160],[45,200]], [[70,160],[95,200]],
            [[45,200],[40,240]], [[95,200],[100,240]],
            [[40,240],[38,272]], [[100,240],[102,272]],
          ].map(([[x1,y1],[x2,y2]], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          ))}
        </svg>
      </div>

      {/* Corner markers */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-accent/40 rounded-tl" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-accent/40 rounded-tr" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-accent/40 rounded-bl" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-accent/40 rounded-br" />

      {/* "LIVE" badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-bg/40 backdrop-blur-sm rounded-full px-3 py-1 border border-border/50">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-medium text-text/70 uppercase tracking-wider">Live</span>
      </div>
    </div>
  );
}
