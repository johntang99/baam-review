import { pctFormat, type CountedRow } from "@/lib/analytics/aggregate";

interface BreakdownProps {
  title: string;
  rows: CountedRow[];
  emptyMessage?: string;
}

export function Breakdown({ title, rows, emptyMessage }: BreakdownProps) {
  return (
    <div className="rounded-xl border border-border-base bg-paper p-5">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-muted mb-3">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-text-muted italic">
          {emptyMessage ?? "No data yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] text-text truncate">
                  {row.label}
                </span>
                <span className="text-[12px] text-text-muted tabular-nums whitespace-nowrap">
                  {row.count.toLocaleString()} · {pctFormat(row.share)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-cream-deep/60 overflow-hidden">
                <div
                  className="h-full bg-forest"
                  style={{ width: `${row.share * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
