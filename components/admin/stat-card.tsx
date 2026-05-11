interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border-base bg-paper p-4">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-muted">
        {label}
      </p>
      <p className="font-display text-[28px] text-ink leading-none mt-1">
        {value}
      </p>
      {sub && (
        <p className="text-[12px] text-text-soft mt-1.5">
          {sub}
        </p>
      )}
    </div>
  );
}
