import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/sidebar";
import { getSelectedLocationId } from "@/lib/selected-location";

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

  // Locations + currently-selected for the switcher.
  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name, address, brand_color, logo_url")
    .order("created_at", { ascending: false });

  const selectedLocationId = await getSelectedLocationId();
  // Guard against a stale cookie pointing at a location the user no longer
  // owns: if the cookie value isn't in the fetched list, treat as null.
  const validSelectedId = locations?.some((l) => l.id === selectedLocationId)
    ? selectedLocationId
    : null;

  // Sidebar badge: active + pending (draft/sending/active) lists. RLS scopes
  // this to the account automatically. head:true keeps it a count-only query.
  const { count: listsBadge } = await supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "sending", "active"]);

  return (
    <div className="grid min-h-screen grid-cols-[270px_1fr] bg-cream">
      <Sidebar
        fullName={fullName}
        email={user.email!}
        locations={locations ?? []}
        selectedLocationId={validSelectedId}
        listsBadge={listsBadge ?? 0}
      />
      <div className="flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
