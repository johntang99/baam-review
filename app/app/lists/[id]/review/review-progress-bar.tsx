import { Check } from "lucide-react";

interface ReviewProgressBarProps {
  /** Which step is currently active. 1 → on the lists overview, the user
   *  hasn't started a list yet. 2 → reviewing content / generating variants.
   *  3 → send flow underway. */
  current: 1 | 2 | 3;
  /** When true, step 3 is also complete (every selected, non-excluded row is
   *  sent). The whole bar then reads as finished. */
  allDone?: boolean;
}

const STEPS = [
  { n: 1, label: "Import customer list" },
  { n: 2, label: "Generate variations" },
  { n: 3, label: "Send one by one" },
] as const;

export function ReviewProgressBar({ current, allDone }: ReviewProgressBarProps) {
  return (
    <ol className="flex items-start gap-0 mb-6 select-none">
      {STEPS.map((s, i) => {
        const isDone =
          s.n < current || (allDone && s.n === 3) || (s.n < 3 && current === 3);
        const isCurrent = !isDone && s.n === current;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={s.n} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-0">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-semibold ${
                  isDone
                    ? "bg-forest text-cream"
                    : isCurrent
                      ? "bg-ink text-cream"
                      : "bg-cream-deep text-text-muted border border-border-base"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span
                className={`mt-2 text-[11.5px] leading-tight text-center max-w-[140px] ${
                  isCurrent
                    ? "font-medium text-ink"
                    : isDone
                      ? "text-text-soft"
                      : "text-text-muted"
                }`}
              >
                {s.label}
              </span>
              {isCurrent && (
                <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-forest font-semibold">
                  You are here
                </span>
              )}
            </div>
            {!isLast && (
              <div
                aria-hidden
                className={`flex-1 h-px mt-3.5 mx-2 ${
                  isDone ? "bg-forest" : "bg-border-base"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
