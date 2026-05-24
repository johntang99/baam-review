import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isUserBaamInternal } from "@/lib/auth/staff";
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

  const internal = await isUserBaamInternal(supabase, user.id);
  if (!internal) redirect("/app");

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
        .order("created_at", { ascending: true })
    : { data: [] };

  // Email lives on auth.users — pull it via the admin API and map back.
  const { data: authList } = await service.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  const emailById = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  return (
    <main className="px-10 py-10 space-y-6">
      <PageHeader
        eyebrow="BAAM Operations"
        title="Staff access"
        description="Everyone inside the BAAM Operations tenant. Invite new staff by email (they get a magic-link signup), or promote an existing customer account that already signed up."
      />

      <StaffManager
        currentUserId={user.id}
        staff={(staffUsers ?? []).map((u) => ({
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
