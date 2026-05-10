interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5 max-w-2xl">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[30px] leading-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="text-[14.5px] text-text-soft leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
