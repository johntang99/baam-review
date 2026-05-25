"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext } from "@/lib/auth/staff";
import type { OpsRole } from "@/lib/database.types";

interface ActionResult {
  ok: boolean;
  error?: string;
}

const ALLOWED_OPS_ROLES: ReadonlyArray<OpsRole> = [
  "admin",
  "sales",
  "account_manager",
];

/**
 * Guard used by every action here: only existing internal users may
 * invite, promote, demote, or change roles. Returns the userId on
 * success, throws on failure (so the calling action surfaces a generic
 * error to the form).
 */
async function requireInternalUser(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/admin/staff");
  // Admin only — staff invitation/promotion/role changes are admin actions.
  // Legacy NULL ops_role users (founding accounts) get admin treatment so
  // we don't lock ourselves out before roles are assigned.
  const internal = await getInternalContext(supabase, user.id);
  if (
    !internal ||
    (internal.opsRole !== "admin" && internal.opsRole !== null)
  ) {
    throw new Error("Only BAAM admins can manage staff access");
  }
  return user.id;
}

async function getOpsAccountId(
  service: ReturnType<typeof createServiceClient>,
): Promise<string | null> {
  const { data: opsAccount } = await service
    .from("accounts")
    .select("id")
    .eq("is_baam_internal", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return opsAccount?.id ?? null;
}

/**
 * Invite a brand-new staff member into the BAAM Operations tenant.
 *
 * Uses Supabase Admin API to create the auth user (which fires off a
 * magic-link email to set their password). The handle_new_user trigger
 * auto-creates a personal account + user row on signup, so we then patch
 * the user to point at the ops tenant and drop the auto-created account.
 *
 * If the email already exists, moves the existing user into the ops
 * tenant instead — same effect as `promoteByEmail`, no new invite email.
 */
export async function inviteStaff(formData: FormData): Promise<ActionResult> {
  await requireInternalUser();

  const rawEmail = formData.get("email");
  const rawFullName = formData.get("full_name");
  const rawRole = formData.get("ops_role");
  if (typeof rawEmail !== "string") {
    return { ok: false, error: "Email is required" };
  }
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address" };
  }
  const fullName =
    typeof rawFullName === "string" && rawFullName.trim()
      ? rawFullName.trim()
      : null;
  const role: OpsRole | null =
    typeof rawRole === "string" &&
    ALLOWED_OPS_ROLES.includes(rawRole as OpsRole)
      ? (rawRole as OpsRole)
      : null;

  const service = createServiceClient();
  const opsAccountId = await getOpsAccountId(service);
  if (!opsAccountId) {
    return {
      ok: false,
      error: "No BAAM Operations tenant found. Run migration 0032 first.",
    };
  }

  // Origin for any email links (invite / recovery).
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "review.baamplatform.com";
  const origin = `${proto}://${host}`;
  // After the user clicks the email link, /auth/callback exchanges the
  // code for a session and forwards them to /reset-password to choose a
  // password. /reset-password is the existing recovery page — it works
  // identically for an invitee who has no password yet.
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  // Existing user → move into ops tenant. If they don't have a password
  // set yet (never confirmed), send a recovery email so they can finish
  // setup. Otherwise no email — they already know how to log in.
  const existing = await findAuthUserByEmail(service, email);
  if (existing) {
    const moved = await moveUserIntoOpsTenant(
      service,
      existing.id,
      opsAccountId,
      role,
    );
    if (!moved.ok) return moved;

    if (!existing.confirmedAt) {
      const { error: recoveryErr } =
        await service.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
      // Don't fail the whole action if the email fails to enqueue — the
      // staff row is already correct. Admin can resend via Forgot
      // password if needed.
      if (recoveryErr) {
        console.error(
          "[inviteStaff] generateLink(recovery) failed",
          recoveryErr,
        );
      }
    }
    return { ok: true };
  }

  // Brand new — send invite email.
  const { data: invited, error: inviteErr } =
    await service.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo,
    });
  if (inviteErr || !invited?.user) {
    return {
      ok: false,
      error: `Invite failed: ${inviteErr?.message ?? "no user returned"}`,
    };
  }

  return await moveUserIntoOpsTenant(
    service,
    invited.user.id,
    opsAccountId,
    role,
  );
}

/**
 * Promote an existing (already-signed-up) account into the BAAM
 * Operations tenant. Identical end state to inviting them, no email
 * sent. Form on /app/admin/staff calls this when staff has already used
 * /signup themselves and just needs the bump.
 */
export async function promoteByEmail(
  formData: FormData,
): Promise<ActionResult> {
  await requireInternalUser();

  const rawEmail = formData.get("email");
  if (typeof rawEmail !== "string") {
    return { ok: false, error: "Email is required" };
  }
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address" };
  }

  const service = createServiceClient();
  const opsAccountId = await getOpsAccountId(service);
  if (!opsAccountId) {
    return { ok: false, error: "No BAAM Operations tenant found." };
  }

  const existing = await findAuthUserByEmail(service, email);
  if (!existing) {
    return {
      ok: false,
      error: `No account found for ${email}. Use Invite instead to send them a magic link.`,
    };
  }

  return await moveUserIntoOpsTenant(service, existing.id, opsAccountId, null);
}

/**
 * Demote an internal staff user back to a regular (customer-shaped)
 * account. Creates a fresh personal account for them and points their
 * user row at it, so they're no longer in the BAAM Operations tenant.
 * Self-protection: cannot demote yourself.
 */
export async function demoteStaffUser(
  formData: FormData,
): Promise<ActionResult> {
  const currentUserId = await requireInternalUser();

  const userId = formData.get("user_id");
  if (typeof userId !== "string" || !userId) {
    return { ok: false, error: "Missing user_id" };
  }
  if (userId === currentUserId) {
    return {
      ok: false,
      error:
        "You can't demote your own user. Ask another internal user to do it.",
    };
  }

  const service = createServiceClient();

  // Pull the auth-side email/name so the new personal account is
  // recognisable in the dashboard (and matches the existing /signup
  // trigger's naming convention).
  const { data: authUser } = await service.auth.admin.getUserById(userId);
  if (!authUser?.user) {
    return { ok: false, error: "Auth user not found" };
  }
  const email = authUser.user.email ?? "";
  const name =
    (authUser.user.user_metadata?.full_name as string | undefined) ||
    email.split("@")[0] ||
    "Demoted user";

  // Mint a fresh personal account, point the user there, clear ops_role.
  const { data: newAccount, error: insertErr } = await service
    .from("accounts")
    .insert({ name, primary_email: email })
    .select("id")
    .single();
  if (insertErr || !newAccount) {
    return {
      ok: false,
      error: `Could not create personal account: ${insertErr?.message ?? "unknown"}`,
    };
  }

  const { error: updateErr } = await service
    .from("users")
    .update({ account_id: newAccount.id, ops_role: null })
    .eq("id", userId);
  if (updateErr) {
    return { ok: false, error: `Demote failed: ${updateErr.message}` };
  }

  revalidatePath("/app/admin/staff");
  return { ok: true };
}

/**
 * Set the ops_role for a single user (admin / sales / account_manager).
 * Operates per-user, not per-account, since one account holds many users
 * with different roles in the shared-tenant model.
 */
export async function setOpsRole(formData: FormData): Promise<ActionResult> {
  await requireInternalUser();

  const userId = formData.get("user_id");
  const role = formData.get("ops_role");
  if (typeof userId !== "string" || !userId) {
    return { ok: false, error: "Missing user_id" };
  }
  if (
    role !== null &&
    role !== "" &&
    (typeof role !== "string" || !ALLOWED_OPS_ROLES.includes(role as OpsRole))
  ) {
    return { ok: false, error: "Invalid role" };
  }
  const value =
    role && typeof role === "string" && role !== ""
      ? (role as OpsRole)
      : null;

  const service = createServiceClient();
  const { error } = await service
    .from("users")
    .update({ ops_role: value })
    .eq("id", userId);
  if (error) {
    return { ok: false, error: `Update failed: ${error.message}` };
  }

  revalidatePath("/app/admin/staff");
  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────────────── */

async function findAuthUserByEmail(
  service: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<{ id: string; confirmedAt: string | null } | null> {
  // Supabase admin SDK doesn't expose a get-by-email; list is paginated.
  // For a small staff team this is fine; if the auth.users table balloons,
  // switch to a service-role SELECT on auth.users.
  const { data } = await service.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  const match = (data?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email,
  );
  if (!match) return null;
  // `confirmed_at` is set the moment they verify their email (clicking
  // the invite/recovery link counts). If null, they've never finished
  // setup and have no password yet.
  return {
    id: match.id,
    confirmedAt: match.confirmed_at ?? null,
  };
}

/**
 * Move (or initialise) a user into the BAAM Operations tenant. Reassigns
 * their public.users.account_id, sets their ops_role, and cleans up the
 * personal account they no longer use (if any). Idempotent — running on a
 * user already in the ops tenant just updates their role.
 */
async function moveUserIntoOpsTenant(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  opsAccountId: string,
  role: OpsRole | null,
): Promise<ActionResult> {
  const { data: userRow } = await service
    .from("users")
    .select("id, account_id, ops_role")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) {
    return {
      ok: false,
      error: "Auth user exists but has no public.users row — odd state.",
    };
  }
  const oldAccountId = userRow.account_id;

  const update: { account_id: string; ops_role?: OpsRole | null } = {
    account_id: opsAccountId,
  };
  if (role !== null) update.ops_role = role;

  const { error: userErr } = await service
    .from("users")
    .update(update)
    .eq("id", userId);
  if (userErr) {
    return { ok: false, error: `Move failed: ${userErr.message}` };
  }

  if (oldAccountId !== opsAccountId) {
    await service.from("accounts").delete().eq("id", oldAccountId);
  }

  revalidatePath("/app/admin/staff");
  return { ok: true };
}
