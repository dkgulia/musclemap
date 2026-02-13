"use client";

import { useState, useEffect } from "react";

interface Props {
  poseId: string;
  bodyVisibility: "full" | "upper" | "partial" | "none";
}

/**
 * Renders a ghost silhouette over the camera preview.
 * Adapts based on how much of the body is visible:
 * - "full": show full ghost at 15% opacity
 * - "upper": show ghost clipped to upper body
 * - "partial"/"none": show corner guide markers only (no confusing full-body outline)
 */
export default function GhostOverlay({ poseId, bodyVisibility }: Props) {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    const path = `/poses/${poseId}.svg`;
    fetch(path)
      .then((r) => r.text())
      .then((text) => setSvgContent(text))
      .catch(() => setSvgContent(null));
  }, [poseId]);

  // If only partial body or nothing — show corner guides instead of ghost
  if (bodyVisibility === "partial" || bodyVisibility === "none") {
    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner guide markers */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-text/20 rounded-tl-lg" />
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-text/20 rounded-tr-lg" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-text/20 rounded-bl-lg" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-text/20 rounded-br-lg" />
      </div>
    );
  }

  if (!svgContent) return null;

  // Upper body only: clip to top 55% of the ghost
  const clipStyle = bodyVisibility === "upper"
    ? { clipPath: "inset(0 0 45% 0)" }
    : undefined;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ transform: "scaleX(-1)" }}
    >
      <div
        className="w-[60%] h-[85%] text-text"
        style={clipStyle}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
