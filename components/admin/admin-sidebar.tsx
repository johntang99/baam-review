"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Briefcase,
  MapPin,
  LayoutGrid,
  Home,
  ExternalLink,
} from "lucide-react";

/**
 * Sidebar for /admin/*. Visual style intentionally distinct from
 * the customer dashboard sidebar so staff know when they're in
 * editorial mode — cream paper, ink text, gold active state instead
 * of the dark-green forest the dashboard uses.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
  /** Optional badge text — pulled from server data in the future. */
  badge?: string;
}

const CONTENT_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: Home },
  { href: "/admin/blog", label: "Blog posts", icon: FileText },
  { href: "/admin/case-studies", label: "Case studies", icon: Briefcase },
  { href: "/admin/cities", label: "City pages", icon: MapPin },
  { href: "/admin/marketing", label: "Marketing pages", icon: LayoutGrid },
];

const EXTERNAL_NAV: NavItem[] = [
  { href: "/", label: "Marketing site", icon: ExternalLink },
  { href: "/app", label: "Customer dashboard", icon: ExternalLink },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span className="admin-sidebar-brand-mark">B</span>
        <div>
          <div className="admin-sidebar-brand-name">BAAM Review</div>
          <div className="admin-sidebar-brand-sub">Content admin</div>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        <p className="admin-sidebar-section-label">Content</p>
        <ul>
          {CONTENT_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`admin-sidebar-link ${
                    active ? "is-active" : ""
                  }`}
                >
                  <Icon className="admin-sidebar-icon" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="admin-sidebar-badge">{item.badge}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="admin-sidebar-section-label">Other surfaces</p>
        <ul>
          {EXTERNAL_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} className="admin-sidebar-link">
                  <Icon className="admin-sidebar-icon" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        action="/api/auth/signout"
        method="post"
        className="admin-sidebar-signout"
      >
        <input type="hidden" name="next" value="/admin" />
        <button type="submit">Sign out</button>
      </form>

      <style>{ADMIN_SIDEBAR_CSS}</style>
    </aside>
  );
}

const ADMIN_SIDEBAR_CSS = `
.admin-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 240px;
  background: #F4EFE2;
  border-right: 1px solid #E6DECF;
  display: flex;
  flex-direction: column;
  padding: 22px 0 18px;
  font-family: 'Onest', sans-serif;
}
.admin-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 22px 22px;
  margin-bottom: 18px;
  border-bottom: 1px solid #E6DECF;
}
.admin-sidebar-brand-mark {
  width: 36px;
  height: 36px;
  background: #1c1c1c;
  color: #C9A961;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Fraunces', serif;
  font-size: 19px;
  font-weight: 500;
}
.admin-sidebar-brand-name {
  font-family: 'Fraunces', serif;
  font-size: 16px;
  font-weight: 500;
  color: #1c1c1c;
  line-height: 1;
}
.admin-sidebar-brand-sub {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.admin-sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px;
}
.admin-sidebar-nav ul {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.admin-sidebar-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #888;
  font-weight: 600;
  margin: 0 0 8px;
  padding-left: 10px;
}
.admin-sidebar-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 14px;
  color: #555;
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
}
.admin-sidebar-link:hover { background: rgba(28, 28, 28, 0.04); color: #1c1c1c; }
.admin-sidebar-link.is-active {
  background: #1c1c1c;
  color: #C9A961;
  font-weight: 500;
}
.admin-sidebar-link.is-active .admin-sidebar-icon { color: #C9A961; }
.admin-sidebar-icon {
  width: 16px;
  height: 16px;
  color: #888;
  flex-shrink: 0;
}
.admin-sidebar-link:hover .admin-sidebar-icon { color: #1c1c1c; }
.admin-sidebar-badge {
  margin-left: auto;
  background: #C9A961;
  color: #1c1c1c;
  font-size: 10.5px;
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 600;
}
.admin-sidebar-signout {
  padding: 12px 22px 0;
  border-top: 1px solid #E6DECF;
}
.admin-sidebar-signout button {
  background: none;
  border: 0;
  padding: 0;
  font-family: inherit;
  font-size: 13px;
  color: #888;
  cursor: pointer;
}
.admin-sidebar-signout button:hover { color: #1c1c1c; }
`;
