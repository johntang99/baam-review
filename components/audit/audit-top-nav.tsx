import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/** Unified top nav for every page under /audit/*. Server component —
 *  auto-detects auth state, renders the right user cluster.
 *  Pass `active` to highlight the current section. */
export type AuditNavActive =
  | "audit-list"
  | "audit-new"
  | "audit-service"
  | "review"
  | null;

interface AuditTopNavProps {
  active?: AuditNavActive;
}

const MENU: Array<{ key: Exclude<AuditNavActive, null>; href: string; label: string }> = [
  { key: "audit-list", href: "/audit/list", label: "My audits" },
  { key: "audit-new", href: "/audit/new", label: "New audit" },
  { key: "audit-service", href: "/audit/service", label: "Service" },
  { key: "review", href: "/", label: "Review" },
];

export async function AuditTopNav({ active = null }: AuditTopNavProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const loggedIn = !!user;

  const userInitial = user?.email?.[0]?.toUpperCase() ?? "•";
  const userName = firstNameOrEmail(user?.email ?? "");

  return (
    <nav className="audit-nav-v2">
      <div className="audit-nav-v2-inner">
        <Link href="/audit" className="audit-nav-v2-logo">
          <span className="audit-nav-v2-logo-mark">B</span>
          BAAM Review Audit
        </Link>

        <div className="audit-nav-v2-links">
          {MENU.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={active === item.key ? "active" : undefined}
            >
              {item.label}
            </Link>
          ))}

          <span className="audit-nav-v2-divider"></span>

          {loggedIn ? (
            <>
              <span className="audit-nav-v2-user-pill">
                <span className="audit-nav-v2-user-avatar">{userInitial}</span>
                {userName}
              </span>
              <form action="/api/auth/signout" method="post">
                <input type="hidden" name="next" value="/audit" />
                <button type="submit" className="audit-nav-v2-signout">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login?next=/audit/list">Sign in</Link>
              <Link
                href="/signup?next=/audit/new"
                className="audit-nav-v2-cta"
              >
                Get free audit →
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function firstNameOrEmail(email: string): string {
  if (!email) return "you";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}
