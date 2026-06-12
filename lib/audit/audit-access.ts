import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getInternalContext } from "@/lib/auth/staff";

export interface AuditViewer {
  /** Signed-in user id, or null for anonymous visitors. */
  viewerId: string | null;
  /** True only for ops_role = 'admin' (sees every audit). */
  isAdmin: boolean;
}

/** Resolve the current viewer from an RLS-bound (cookie) client. */
export async function resolveAuditViewer(
  supabase: SupabaseClient<Database>,
): Promise<AuditViewer> {
  const { data } = await supabase.auth.getUser();
  const viewerId = data.user?.id ?? null;
  if (!viewerId) return { viewerId: null, isAdmin: false };
  const internal = await getInternalContext(supabase, viewerId);
  return { viewerId, isAdmin: internal?.opsRole === "admin" };
}

/**
 * Authorization for opening a single audit (detail page, embed, PDF/HTML
 * download). The audit row is fetched with the service client (RLS bypassed)
 * and access is decided here:
 *
 *   • is_public  → openable by anyone holding the link. Sharing exists for
 *                  the audited business's CLIENTS, who have no account.
 *   • admin      → sees every audit.
 *   • owner      → sees their own audit (public or not).
 *
 * Every other audit is invisible to every other platform user — a shared
 * audit is, for users, exactly as private as any other. Discovery (the
 * /audit/list "My audits" page) is owner/admin-scoped separately, so a
 * shared audit is reachable by others ONLY through its explicit link.
 */
export function canViewAudit(
  row: { is_public: boolean | null; user_id: string | null },
  viewer: AuditViewer,
): boolean {
  if (row.is_public) return true;
  if (viewer.isAdmin) return true;
  return !!viewer.viewerId && row.user_id === viewer.viewerId;
}
