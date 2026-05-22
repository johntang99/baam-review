import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared layout for the four legal pages. Keeps Privacy / Terms / DPA /
 * Compliance visually consistent and links them in a sub-nav so users can
 * jump between them without going back to the marketing site.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-cream text-text">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="font-display text-[20px] font-medium tracking-tight text-ink"
        >
          BAAM Review
        </Link>
        <Link
          href="/"
          className="text-[13px] text-text-soft hover:text-ink"
        >
          ← Back to homepage
        </Link>
      </header>

      <div className="mx-auto max-w-[760px] px-6 pb-24 pt-2">
        <nav className="flex flex-wrap gap-1 border-b border-border-base pb-3">
          <LegalNavLink href="/legal/privacy">Privacy</LegalNavLink>
          <LegalNavLink href="/legal/terms">Terms</LegalNavLink>
          <LegalNavLink href="/legal/dpa">DPA</LegalNavLink>
          <LegalNavLink href="/legal/compliance">Compliance</LegalNavLink>
        </nav>

        <article className="prose-legal mt-10">{children}</article>

        <footer className="mt-16 border-t border-border-base pt-6 text-[12px] text-text-muted">
          <p>
            Questions? Email{" "}
            <a
              href="mailto:support@baamplatform.com"
              className="text-forest hover:underline"
            >
              support@baamplatform.com
            </a>
            .
          </p>
          <p className="mt-1">
            BAAM Review is operated by BAAM Platform Inc., a New York
            corporation. 90 North St, Middletown, NY 10940.
          </p>
        </footer>
      </div>

      {/* Page-local prose styles. Inline so the legal pages remain readable
          even when JS / Tailwind utilities fail. */}
      <style>{`
        .prose-legal { font-size: 14.5px; line-height: 1.7; color: #3D3530; }
        .prose-legal h1 { font-family: 'Cormorant Garamond', serif; font-size: 36px; line-height: 1.15; letter-spacing: -0.01em; color: #2A2520; margin-bottom: 6px; }
        .prose-legal h2 { font-family: 'Cormorant Garamond', serif; font-size: 24px; line-height: 1.25; color: #2A2520; margin-top: 36px; margin-bottom: 10px; }
        .prose-legal h3 { font-weight: 600; font-size: 16px; color: #2A2520; margin-top: 24px; margin-bottom: 6px; }
        .prose-legal p { margin-bottom: 14px; }
        .prose-legal ul, .prose-legal ol { margin: 12px 0 18px 22px; }
        .prose-legal li { margin-bottom: 6px; }
        .prose-legal a { color: #1F4D3F; text-decoration: underline; text-underline-offset: 2px; }
        .prose-legal a:hover { color: #143329; }
        .prose-legal strong { color: #2A2520; font-weight: 600; }
        .prose-legal code { background: #EFE7D4; padding: 1.5px 6px; border-radius: 3px; font-size: 13px; }
        .prose-legal .effective { color: #8B7F73; font-size: 12.5px; margin-bottom: 28px; }
        .prose-legal .lede { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 17px; line-height: 1.55; color: #6B5F55; margin-bottom: 24px; }
        .prose-legal table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 14px 0; }
        .prose-legal th, .prose-legal td { border: 1px solid #E5D9C5; padding: 8px 10px; text-align: left; vertical-align: top; }
        .prose-legal th { background: #EFE7D4; font-weight: 600; color: #2A2520; }
      `}</style>
    </main>
  );
}

function LegalNavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-soft hover:bg-paper hover:text-ink"
    >
      {children}
    </Link>
  );
}
