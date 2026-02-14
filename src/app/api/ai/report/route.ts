import { NextResponse } from "next/server";
import OpenAI from "openai";

// ─── V1 Progress Report types ────────────────────────────────────

interface ScanData {
  timestamp: number;
  poseId: string;
  symmetryScore: number;
  scanType?: string;
  confidenceLabel?: string;
  scanCategory?: string;
}

interface MeasurementData {
  timestamp: number;
  name: string;
  value: number;
  unit: string;
}

interface ProgressReportRequest {
  scans: ScanData[];
  measurements: MeasurementData[];
  heightCm: number | null;
}

// ─── V2 Coach Report types ───────────────────────────────────────

interface CoachPayload {
  category: string;
  poseDirection: string;
  timeGapDays: number | null;
  trackedRegions: string[];
  scores: { quality: number; lighting: number; framing: number; poseMatch: number };
  metrics: {
    shoulderIndex?: number;
    hipIndex?: number;
    vTaperIndex?: number;
    symmetryScore?: number;
  };
  tips: string[];
  confidence: string;
}

interface CoachReportRequest {
  coachPayload: CoachPayload;
}

// ─── Shared ──────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

// ─── Route handler ───────────────────────────────────────────────

export async function POST(request: Request) {
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { error: "DeepSeek API key not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();

  // Detect request type: coachPayload → V2 coach report, scans → V1 progress report
  if (body.coachPayload) {
    return handleCoachReport(client, body as CoachReportRequest);
  }
  return handleProgressReport(client, body as ProgressReportRequest);
}

// ─── V2 Coach Report ─────────────────────────────────────────────

async function handleCoachReport(client: OpenAI, body: CoachReportRequest) {
  const p = body.coachPayload;

  const systemPrompt = `You are a concise bodybuilding coach reviewing a single progress photo analysis.
You receive computed metrics — no image data. Give actionable feedback in plain text (no markdown).

Rules:
- Keep response under 120 words
- Direct, motivational gym-bro language
- Comment on the scan quality and what it can track (${p.trackedRegions.join(", ") || "limited regions"})
- If confidence is "${p.confidence}", adjust tone: High = assertive advice, Medium = cautious, Low = suggest retaking
- If time gap is ${p.timeGapDays === null ? "unknown (first scan)" : `${p.timeGapDays} days`}, comment on tracking frequency
- Category "${p.category}" means: CHECKIN_FULL = full body standing, CHECKIN_SELFIE = upper body, GALLERY = casual
- Give 2-3 specific training tips based on the category and metrics
- Do NOT reference raw numbers or index values directly
- Do NOT use markdown formatting`;

  const userPrompt = `Photo analysis results:
Category: ${p.category}
Direction: ${p.poseDirection}
Confidence: ${p.confidence}
Quality: ${p.scores.quality}/100, Lighting: ${p.scores.lighting}/100, Framing: ${p.scores.framing}/100, Pose: ${p.scores.poseMatch}/100
Tracked regions: ${p.trackedRegions.join(", ") || "None"}
Time since last scan: ${p.timeGapDays === null ? "First scan" : `${p.timeGapDays} days`}
Symmetry: ${p.metrics.symmetryScore != null ? `${Math.round(p.metrics.symmetryScore)}%` : "Not measured"}
Tips from analysis: ${p.tips.join("; ") || "None"}

Give a brief coach report.`;

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
    });

    const content = completion.choices?.[0]?.message?.content || "Unable to generate report.";
    return NextResponse.json({ report: content });
  } catch (err) {
    console.error("DeepSeek API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `DeepSeek API error: ${message}` },
      { status: 502 }
    );
  }
}

// ─── V1 Progress Report ─────────────────────────────────────────

async function handleProgressReport(client: OpenAI, body: ProgressReportRequest) {
  const { scans, measurements, heightCm } = body;

  const chronologicalScans = [...scans].sort((a, b) => a.timestamp - b.timestamp);

  const scanSummary = chronologicalScans
    .slice(-10)
    .map((s) => {
      const date = new Date(s.timestamp).toLocaleDateString();
      const cat = s.scanCategory && s.scanCategory !== "GALLERY" ? ` [${s.scanCategory}]` : "";
      const type = !cat && s.scanType === "CHECKIN" ? " [CHECKIN]" : "";
      const conf = s.confidenceLabel ? ` confidence=${s.confidenceLabel}` : "";
      const sym = s.symmetryScore > 0 ? `, Symmetry=${s.symmetryScore}%` : "";
      return `${date} ${s.poseId}${cat}${type}${conf}${sym}`;
    })
    .join("\n");

  const measMap = new Map<string, MeasurementData[]>();
  for (const m of measurements) {
    const arr = measMap.get(m.name) || [];
    arr.push(m);
    measMap.set(m.name, arr);
  }
  const measSummary = Array.from(measMap.entries())
    .map(([name, entries]) => {
      const sorted = entries.sort((a, b) => a.timestamp - b.timestamp);
      const latest = sorted[sorted.length - 1];
      const oldest = sorted[0];
      if (sorted.length > 1) {
        const change = (latest.value - oldest.value).toFixed(1);
        const sign = Number(change) >= 0 ? "+" : "";
        return `${name}: ${oldest.value}${oldest.unit} → ${latest.value}${latest.unit} (${sign}${change} over ${sorted.length} entries)`;
      }
      return `${name}: ${latest.value}${latest.unit} (1 entry)`;
    })
    .join("\n");

  const totalPhotos = scans.length;
  const poseTypes = [...new Set(scans.map((s) => s.poseId))].length;

  const systemPrompt = `You are a bodybuilding coach analyzing a user's progress tracking data.

This app captures progress PHOTOS in consistent poses (using a ghost overlay for repeatable framing).
The user tracks their physique visually through photos and optionally logs tape measurements.

Rules:
- Keep response under 150 words
- Use direct, motivational gym-bro language
- Focus primarily on TAPE MEASUREMENTS if available — these are real body measurements the user logged manually
- If tape measurements show trends, analyze them (growing arms, shrinking waist, etc.)
- If NO tape measurements exist, strongly encourage the user to start logging them ("Grab a tape measure and log your arms, chest, waist — that's where the real data is")
- Comment on photo consistency and tracking habit (${totalPhotos} photos across ${poseTypes} pose type(s))
- Photos marked [CHECKIN_FULL] are full-body standing check-ins (most reliable)
- Photos marked [CHECKIN_SELFIE] are upper-body selfie check-ins (good for upper body tracking)
- When data quality is "Low", note that measurements may be less accurate
- Symmetry scores are from pose analysis — only mention if notably imbalanced (<75%)
- Give 2-3 specific actionable training or nutrition tips
- Do NOT reference V-Taper, Shoulder Index, or Hip Index — these are not shown to the user
- Do NOT use markdown formatting, just plain text with line breaks`;

  const userPrompt = `Analyze this lifter's progress:

Height: ${heightCm ? `${heightCm}cm` : "not set"}

PROGRESS PHOTOS (oldest to newest):
${scanSummary || "No photos yet"}

Total: ${totalPhotos} progress photos

TAPE MEASUREMENTS (oldest to newest):
${measSummary || "No tape measurements logged yet"}

Give a brief progress report with actionable tips.`;

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
    });

    const content = completion.choices?.[0]?.message?.content || "Unable to generate report.";
    return NextResponse.json({ report: content });
  } catch (err) {
    console.error("DeepSeek API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `DeepSeek API error: ${message}` },
      { status: 502 }
    );
  }
}
