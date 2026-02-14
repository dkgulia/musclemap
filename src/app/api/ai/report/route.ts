import { NextResponse } from "next/server";
import OpenAI from "openai";

interface ScanData {
  timestamp: number;
  poseId: string;
  symmetryScore: number;
  scanType?: string;
  confidenceLabel?: string;
}

interface MeasurementData {
  timestamp: number;
  name: string;
  value: number;
  unit: string;
}

interface ReportRequest {
  scans: ScanData[];
  measurements: MeasurementData[];
  heightCm: number | null;
}

export async function POST(request: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DeepSeek API key not configured" },
      { status: 500 }
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });

  const body = (await request.json()) as ReportRequest;
  const { scans, measurements, heightCm } = body;

  // Send scans oldest-first so AI reads progression correctly
  const chronologicalScans = [...scans].sort((a, b) => a.timestamp - b.timestamp);

  // Build scan summary — focus on photo count and consistency, not skeleton ratios
  const scanSummary = chronologicalScans
    .slice(-10)
    .map((s) => {
      const date = new Date(s.timestamp).toLocaleDateString();
      const type = s.scanType === "CHECKIN" ? " [CHECKIN]" : "";
      const conf = s.confidenceLabel ? ` confidence=${s.confidenceLabel}` : "";
      const sym = s.symmetryScore > 0 ? `, Symmetry=${s.symmetryScore}%` : "";
      return `${date} ${s.poseId}${type}${conf}${sym}`;
    })
    .join("\n");

  // Group measurements by name with history (oldest-first)
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
- Photos marked [CHECKIN] passed strict validation gates and are the most reliable for tracking
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

    const content =
      completion.choices?.[0]?.message?.content || "Unable to generate report.";

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
