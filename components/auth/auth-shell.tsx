import Link from "next/link";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 justify-center"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold text-ink font-semibold text-sm">
            B
          </span>
          <span className="font-display text-lg text-ink">BAAM Review</span>
        </Link>

        <div className="rounded-2xl border border-border-base bg-paper p-7 shadow-sm">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="font-display text-2xl text-ink">{title}</h1>
            {subtitle && (
              <p className="text-sm text-text-soft">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
