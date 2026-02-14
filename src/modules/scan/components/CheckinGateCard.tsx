"use client";

import type { CheckinGateResult } from "../models/types";

interface Props {
  gates: CheckinGateResult;
}

function GateRow({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`text-sm mt-0.5 shrink-0 ${passed ? "text-emerald-400" : "text-red-400"}`}>
        {passed ? "\u2713" : "\u2717"}
      </span>
      <div className="min-w-0">
        <span className={`text-xs font-medium ${passed ? "text-text" : "text-red-400"}`}>
          {label}
        </span>
        {detail && (
          <p className="text-[10px] text-muted mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

export default function CheckinGateCard({ gates }: Props) {
  // Gate A detail
  const gateADetail = !gates.gateA.passed
    ? `Missing: ${gates.gateA.missingJoints.join(", ")}`
    : undefined;

  // Gate B detail
  const gateBDetail = !gates.gateB.passed ? gates.gateB.reason : undefined;

  // Gate C detail
  let gateCDetail: string | undefined;
  if (!gates.gateC.passed) {
    const issues: string[] = [];
    if (!gates.gateC.details.scaleMatch) issues.push("distance from camera");
    if (!gates.gateC.details.stanceMatch) issues.push("foot placement");
    if (!gates.gateC.details.hipTiltMatch) issues.push("hip alignment");
    gateCDetail = issues.length > 0 ? `Adjust: ${issues.join(", ")}` : "Inconsistent";
  }

  // Gate D detail
  const gateDLabel = "Time gap";
  const gateDPassed = !gates.gateD.sameDayBlock;
  let gateDDetail: string | undefined;
  if (gates.gateD.sameDayBlock) {
    gateDDetail = "Already checked in today";
  } else if (gates.gateD.warning && gates.gateD.daysSinceLastCheckin !== null) {
    gateDDetail = `${gates.gateD.daysSinceLastCheckin}d since last check-in (7d recommended)`;
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-text">Check-in Gates</h3>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
          gates.allPassed
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }`}>
          {gates.allPassed ? "All Passed" : "Failed"}
        </span>
      </div>
      <div className="space-y-2.5">
        <GateRow label="Joints visible" passed={gates.gateA.passed} detail={gateADetail} />
        <GateRow label="Standing upright" passed={gates.gateB.passed} detail={gateBDetail} />
        <GateRow label="Consistency" passed={gates.gateC.passed} detail={gateCDetail} />
        <GateRow label={gateDLabel} passed={gateDPassed} detail={gateDDetail} />
      </div>
    </div>
  );
}
