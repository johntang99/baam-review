import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInternalContext } from "@/lib/auth/staff";
import type { InternalUserContext } from "@/lib/auth/staff";

/**
 * Gate for the /admin/* surface. Verifies the visitor is BAAM-internal
 * staff (account.is_baam_internal = true) and returns their internal
 * context. Redirects to /login or /app otherwise.
 *
 * Why a dedicated helper rather than middleware: middleware can't await
 * Supabase queries cheaply, and we want one auth code path the admin
 * layout + API routes both call. Layout invokes this once and trusts
 * it across the subtree; API routes call it on every mutation.
 */
export async function requireBaamInternal(): Promise<InternalUserContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const internal = await getInternalContext(supabase, user.id);
  if (!internal) {
    // Authed but not staff — bounce to their normal dashboard.
    redirect("/app");
  }

  return internal;
}

/**
 * API-flavored guard. Returns `{ ok: false, status }` instead of
 * redirecting, so routes can return JSON 401/403 to the client.
 */
export async function requireBaamInternalApi(): Promise<
  | { ok: true; internal: InternalUserContext; userId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const internal = await getInternalContext(supabase, user.id);
  if (!internal) {
    return { ok: false, status: 403, error: "forbidden_not_internal" };
  }

  return { ok: true, internal, userId: user.id };
}
