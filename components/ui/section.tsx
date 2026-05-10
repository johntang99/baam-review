import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  children,
  className,
}: SectionProps) {
  return (
    <section
      className={cn(
        "grid gap-6 border-t border-border-base py-8 first:border-t-0 first:pt-0 sm:grid-cols-[260px_1fr]",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="font-display text-[18px] text-ink">{title}</h2>
        {description && (
          <p className="text-[13px] text-text-soft leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[12.5px] font-medium tracking-tight text-text-soft"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-text-muted">{hint}</p>}
    </div>
  );
}
