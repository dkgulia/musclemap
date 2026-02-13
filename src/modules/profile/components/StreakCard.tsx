import Card from "@/components/Card";

const days = ["M", "T", "W", "T", "F", "S", "S"];
const active = [true, true, true, false, true, true, false];

export default function StreakCard() {
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wider">Current Streak</p>
          <p className="text-3xl font-semibold text-text mt-1">5 days</p>
        </div>
        <span className="text-2xl">&#128293;</span>
      </div>
      <div className="flex gap-2 justify-between">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                active[i]
                  ? "bg-accent text-accent-fg"
                  : "bg-text/[0.04] text-muted"
              }`}
            >
              {active[i] ? "\u2713" : ""}
            </div>
            <span className="text-[10px] text-muted">{day}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
