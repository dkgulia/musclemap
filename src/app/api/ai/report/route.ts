import { NextResponse } from "next/server";
import OpenAI from "openai";

interface ScanData {
  timestamp: number;
  poseId: string;
  vTaperIndex: number;
  shoulderIndex: number;
  hipIndex: number;
  shoulderWidthCm: number;
  hipWidthCm: number;
  symmetryScore: number;
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

  // Build context for the AI
  const scanSummary = scans
    .slice(0, 10)
    .map((s) => {
      const date = new Date(s.timestamp).toLocaleDateString();
      return `${date} ${s.poseId}: V-Taper=${s.vTaperIndex.toFixed(2)}, Shoulder=${s.shoulderIndex.toFixed(3)}, Symmetry=${s.symmetryScore}%${s.shoulderWidthCm > 0 ? `, ShoulderCm=${s.shoulderWidthCm}` : ""}`;
    })
    .join("\n");

  // Group measurements by name with history
  const measMap = new Map<string, MeasurementData[]>();
  for (const m of measurements) {
    const arr = measMap.get(m.name) || [];
    arr.push(m);
    measMap.set(m.name, arr);
  }
  const measSummary = Array.from(measMap.entries())
    .map(([name, entries]) => {
      const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      const prev = sorted.length > 1 ? sorted[1] : null;
      const delta = prev ? (latest.value - prev.value).toFixed(1) : "first";
      return `${name}: ${latest.value}${latest.unit} (change: ${delta})`;
    })
    .join("\n");

  const systemPrompt = `You are a bodybuilding coach analyzing a user's physique tracking data.

Rules:
- Keep response under 150 words
- Use direct, motivational gym-bro language
- Analyze trends (improving, declining, stable)
- Compare left/right symmetry if data shows imbalance
- Note the most impressive improvement
- Give 2-3 specific actionable tips
- If tape measurements exist, incorporate them
- If no tape measurements, note that tracking tape measurements would help
- Reference V-Taper grades: <1.2 Developing, 1.2-1.4 Average, 1.4-1.6 Good, 1.6-1.8 Great, >1.8 Elite
- Do NOT use markdown formatting, just plain text with line breaks`;

  const userPrompt = `Analyze this lifter's progress:

Height: ${heightCm ? `${heightCm}cm` : "not set"}

POSE SCANS (newest first):
${scanSummary || "No scans yet"}

TAPE MEASUREMENTS:
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
