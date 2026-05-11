import { pctFormat, type FunnelStep } from "@/lib/analytics/aggregate";

interface FunnelProps {
  steps: FunnelStep[];
  topCount: number;
}

const TONES = ["bg-forest", "bg-forest-light", "bg-sage", "bg-sage-soft"];

export function Funnel({ steps, topCount }: FunnelProps) {
  const max = Math.max(topCount, 1);

  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = (s.count / max) * 100;
        const tone = TONES[Math.min(i, TONES.length - 1)];
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span className="w-24 flex-shrink-0 text-[11.5px] font-medium uppercase tracking-[0.12em] text-text-soft">
              {s.label}
            </span>
            <div className="flex-1 h-7 rounded-md bg-cream-deep/60 relative overflow-hidden">
              <div
                className={`h-full ${tone} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-y-0 left-3 flex items-center text-[13px] font-medium text-cream mix-blend-difference">
                {s.count.toLocaleString()}
              </span>
            </div>
            <span className="w-16 text-right text-[11.5px] text-text-muted tabular-nums">
              {i === 0 ? "—" : pctFormat(s.conversion)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
