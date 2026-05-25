import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/sidebar";
import { getSelectedLocationId } from "@/lib/selected-location";
import {
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) || null;

  // Ops context — drives the per-role visibility filter below. Null for
  // customer logins (RLS scopes by account_id, no extra filter needed).
  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);

  // Locations for the sidebar switcher. RLS lets internal users see all
  // locations in the ops tenant, so we ALSO filter by visibleIds for
  // sales / account_manager. visibleIds is null for admin and customers
  // (= no extra filter, show everything RLS allows).
  let locationsQuery = supabase
    .from("locations")
    .select("id, display_name, address, brand_color, logo_url")
    .order("created_at", { ascending: false });
  if (visibleIds !== null) {
    if (visibleIds.length === 0) {
      // Empty filter would return everything in PostgREST; short-circuit.
      locationsQuery = locationsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      locationsQuery = locationsQuery.in("id", visibleIds);
    }
  }
  const { data: locations } = await locationsQuery;

  const selectedLocationId = await getSelectedLocationId();
  // Guard against a stale cookie pointing at a location the user no longer
  // owns: if the cookie value isn't in the fetched list, treat as null.
  const validSelectedId = locations?.some((l) => l.id === selectedLocationId)
    ? selectedLocationId
    : null;

  // Sidebar badge: active + pending (draft/sending/active) lists scoped
  // to whichever locations the user can see.
  let listsQuery = supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "sending", "active"]);
  if (visibleIds !== null) {
    if (visibleIds.length === 0) {
      listsQuery = listsQuery.in("location_id", [
        "00000000-0000-0000-0000-000000000000",
      ]);
    } else {
      listsQuery = listsQuery.in("location_id", visibleIds);
    }
  }
  const { count: listsBadge } = await listsQuery;

  return (
    <div className="grid min-h-screen grid-cols-[270px_1fr] bg-cream">
      <Sidebar
        fullName={fullName}
        email={user.email!}
        locations={locations ?? []}
        selectedLocationId={validSelectedId}
        listsBadge={listsBadge ?? 0}
        opsRole={internal?.opsRole ?? null}
        isBaamInternal={internal !== null}
      />
      <div className="flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
