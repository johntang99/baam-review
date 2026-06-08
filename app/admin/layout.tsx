import type { Metadata } from "next";
import { requireBaamInternal } from "@/lib/admin/auth-guard";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = {
  title: "Content admin · BAAM Review",
  // Never index admin routes — robots.ts already disallows /admin
  // entirely, but a meta noindex provides defense in depth.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Layout for the marketing/SEO content admin at /admin/*.
 *
 * Auth: requireBaamInternal() redirects non-staff out before any child
 * renders. Every page nested under this layout inherits the check, so
 * page-level guards aren't needed.
 *
 * Visual style: intentionally distinct from the /app customer
 * dashboard so staff know when they're in editorial mode. Cream paper
 * backdrop, ink-on-gold accents, mono labels — matches the marketing
 * brand more than the dashboard.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBaamInternal();

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">{children}</main>
      <style>{ADMIN_LAYOUT_CSS}</style>
    </div>
  );
}

const ADMIN_LAYOUT_CSS = `
.admin-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
  background: #FAF7F2;
  font-family: 'Onest', sans-serif;
  color: #2a2a2a;
}
.admin-main {
  padding: 36px 48px 60px;
  overflow-x: hidden;
}
@media (max-width: 820px) {
  .admin-shell { grid-template-columns: 1fr; }
  .admin-main { padding: 24px 20px 48px; }
}
`;
