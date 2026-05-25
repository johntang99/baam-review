import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext } from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import { ShieldCheck } from "lucide-react";
import { StaffManager } from "./staff-manager";

export const metadata = { title: "Staff access — BAAM Review" };
export const dynamic = "force-dynamic";

/**
 * Staff-only page for managing who has BAAM internal access.
 *
 * After migration 0032 every staff member is a `users` row inside the
 * single BAAM Operations tenant (the one accounts row with
 * is_baam_internal=true). This page lists those users with their ops_role
 * and lets admins invite new ones or promote existing customer accounts.
 */
export default async function StaffAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/admin/staff");

  // Admin only. Sales and account_manager do not manage other staff.
  // Legacy users with NULL ops_role are treated as admin for backward
  // compatibility (they're effectively the founding accounts).
  const internal = await getInternalContext(supabase, user.id);
  const allowed =
    internal !== null &&
    (internal.opsRole === "admin" || internal.opsRole === null);
  if (!allowed) redirect("/app");

  const service = createServiceClient();

  // Resolve the single ops tenant id and list every user inside it. RLS
  // doesn't scope by ops_role, so the join is straightforward.
  const { data: opsAccount } = await service
    .from("accounts")
    .select("id")
    .eq("is_baam_internal", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: staffUsers } = opsAccount
    ? await service
        .from("users")
        .select("id, full_name, ops_role, created_at, account_id")
        .eq("account_id", opsAccount.id)
    : { data: [] };

  // Email lives on auth.users — pull it via the admin API and map back.
  const { data: authList } = await service.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  const emailById = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  // Sort rules:
  //   1) role bucket order: admin → sales → account_manager → no role
  //   2) within a bucket: alphabetical by display name (falls back to email)
  // We sort in JS rather than SQL because Postgres can't express the
  // explicit role enum order without a CASE expression, and the staff
  // list is small enough that client-side sort is cheap.
  const ROLE_ORDER = {
    admin: 0,
    sales: 1,
    account_manager: 2,
  };
  const sortedStaff = [...(staffUsers ?? [])].sort((a, b) => {
    const ra = a.ops_role ? ROLE_ORDER[a.ops_role] ?? 3 : 3;
    const rb = b.ops_role ? ROLE_ORDER[b.ops_role] ?? 3 : 3;
    if (ra !== rb) return ra - rb;
    const nameA = (a.full_name || emailById.get(a.id) || "").toLocaleLowerCase();
    const nameB = (b.full_name || emailById.get(b.id) || "").toLocaleLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="BAAM Operations"
        title="Staff access"
        description="Everyone inside the BAAM Operations tenant. Invite new staff by email (they get a magic-link signup), or promote an existing customer account that already signed up."
      />

      <StaffManager
        currentUserId={user.id}
        staff={sortedStaff.map((u) => ({
          user_id: u.id,
          full_name: u.full_name,
          email: emailById.get(u.id) ?? "(unknown)",
          ops_role: u.ops_role,
          created_at: u.created_at,
        }))}
      />

      <section className="max-w-3xl rounded-2xl border border-dashed border-border-base bg-paper/60 p-5 text-[13px] text-text-soft">
        <p className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-forest mt-0.5 flex-shrink-0" />
          <span>
            <strong className="text-ink">Roles control visibility:</strong>{" "}
            <em>Admin</em> sees every location. <em>Sales</em> sees what they
            personally connected. <em>Account manager</em> sees only
            locations a sales added them to. Set <em>No role</em> to keep
            their access at "internal" without filtering.
          </span>
        </p>
      </section>
    </main>
  );
}
