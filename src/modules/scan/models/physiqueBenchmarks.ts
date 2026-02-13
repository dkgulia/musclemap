/** Bodybuilding reference grades for scan metrics */

export interface Grade {
  min: number;
  max: number;
  label: string;
  color: string;
}

export const V_TAPER_GRADES: Grade[] = [
  { min: 0, max: 1.2, label: "Developing", color: "text-muted" },
  { min: 1.2, max: 1.4, label: "Average", color: "text-text2" },
  { min: 1.4, max: 1.6, label: "Good", color: "text-emerald-400" },
  { min: 1.6, max: 1.8, label: "Great", color: "text-emerald-500" },
  { min: 1.8, max: 9, label: "Elite", color: "text-amber-400" },
];

export const SHOULDER_RATIO_GRADES: Grade[] = [
  { min: 0, max: 0.24, label: "Narrow", color: "text-muted" },
  { min: 0.24, max: 0.27, label: "Average", color: "text-text2" },
  { min: 0.27, max: 0.3, label: "Broad", color: "text-emerald-400" },
  { min: 0.3, max: 0.34, label: "Wide", color: "text-emerald-500" },
  { min: 0.34, max: 9, label: "Elite", color: "text-amber-400" },
];

export const SYMMETRY_GRADES: Grade[] = [
  { min: 90, max: 101, label: "Balanced", color: "text-emerald-400" },
  { min: 75, max: 90, label: "Moderate", color: "text-amber-400" },
  { min: 0, max: 75, label: "Imbalanced", color: "text-red-400" },
];

export function getGrade(value: number, grades: Grade[]): Grade {
  return grades.find((g) => value >= g.min && value < g.max) ?? grades[0];
}

const POSE_INSIGHTS: Record<string, (vt: Grade, sym: Grade) => string> = {
  "front-biceps": (vt, sym) => {
    if (vt.label === "Elite") return "Monster V-taper — competition ready";
    if (vt.label === "Great") return "V-taper is looking wide — keep it up";
    if (sym.label === "Imbalanced") return "Focus on evening out both sides";
    return "Shoulders widening — keep pushing";
  },
  "back-lats": (vt, sym) => {
    if (vt.label === "Elite") return "Lats are spreading like wings";
    if (vt.label === "Great") return "Back width is impressive — keep pulling";
    if (sym.label === "Imbalanced") return "One side is pulling ahead — add unilateral work";
    return "Back is developing — rows and pulldowns";
  },
  "side-glute": (_vt, sym) => {
    if (sym.label === "Balanced") return "Great side profile — proportions on point";
    if (sym.label === "Imbalanced") return "Check hip alignment — stretch and mobilize";
    return "Side pose improving — keep working glutes";
  },
  "back-glute": (_vt, sym) => {
    if (sym.label === "Balanced") return "Glutes and hamstrings looking balanced";
    if (sym.label === "Imbalanced") return "Posterior imbalance — add single-leg work";
    return "Posterior chain developing — hip thrusts and RDLs";
  },
};

export function getPoseInsight(
  poseId: string,
  vTaperValue: number,
  symmetryScore: number | null
): string {
  const vtGrade = getGrade(vTaperValue, V_TAPER_GRADES);
  const symGrade = symmetryScore != null
    ? getGrade(symmetryScore, SYMMETRY_GRADES)
    : { label: "Unknown", color: "text-muted", min: 0, max: 0 };

  const fn = POSE_INSIGHTS[poseId];
  if (fn) return fn(vtGrade, symGrade);
  return "Keep hitting your poses consistently";
}
