import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/** Unified top nav for every page under the audit product. Server
 *  component — auto-detects auth state, renders the right cluster
 *  accordingly. Pass `active` to highlight the current section. */
export type AuditNavActive =
  | "audit"
  | "audits"
  | "audit-new"
  | "about"
  | "methodology"
  | null;

interface AuditTopNavProps {
  active?: AuditNavActive;
  /** Override the brand mark's link target. Defaults to /audit when
   *  logged-out and /audits when logged-in. */
  brandHref?: string;
}

export async function AuditTopNav({ active = null, brandHref }: AuditTopNavProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const loggedIn = !!user;

  const resolvedBrandHref = brandHref ?? (loggedIn ? "/audits" : "/audit");

  return (
    <nav className="audit-nav">
      <div className="audit-nav-inner">
        <Link href={resolvedBrandHref} className="audit-nav-brand">
          <span className="audit-nav-brand-mark">BAAM · REVIEW AUDIT</span>
          <span className="audit-nav-brand-sub">the reputation audit</span>
        </Link>

        <div className="audit-nav-right">
        {loggedIn ? (
          <>
            <Link
              href="/audits"
              className={`audit-nav-link${active === "audits" ? " active" : ""}`}
            >
              My audits
            </Link>
            <Link
              href="/audit/new"
              className={`audit-nav-link${active === "audit-new" ? " active" : ""}`}
            >
              New audit
            </Link>
            <Link
              href="/about"
              className={`audit-nav-link${active === "about" ? " active" : ""}`}
            >
              About
            </Link>
            <Link href="/app" className="audit-nav-link-secondary">
              Review platform
            </Link>
            <div className="audit-nav-user">
              <span className="audit-nav-user-email">{user.email}</span>
              <Link href="/logout" className="audit-nav-logout">
                Log out
              </Link>
            </div>
          </>
        ) : (
          <>
            <Link
              href="/audit"
              className={`audit-nav-link${active === "audit" ? " active" : ""}`}
            >
              Home
            </Link>
            <Link
              href="/about"
              className={`audit-nav-link${active === "about" ? " active" : ""}`}
            >
              About
            </Link>
            <a
              href="https://www.baamreview.com/review-value.html"
              target="_blank"
              rel="noopener noreferrer"
              className="audit-nav-link"
            >
              Methodology
            </a>
            <Link href="/" className="audit-nav-link-secondary">
              Review platform
            </Link>
            <Link href="/login?next=/audits" className="audit-nav-link">
              Log in
            </Link>
            <Link href="/signup?next=/audit/new" className="audit-nav-cta">
              Get free audit
            </Link>
          </>
        )}
        </div>
      </div>
    </nav>
  );
}
