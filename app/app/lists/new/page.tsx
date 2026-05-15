import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLocationId } from "@/lib/selected-location";
import { NewListForm } from "./new-list-form";

export const metadata = {
  title: "New list — BAAM Review",
};

export const dynamic = "force-dynamic";

export default async function NewListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/lists/new");

  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name, default_language")
    .order("display_name", { ascending: true });

  const selectedLocationId = await getSelectedLocationId();

  // Computed server-side so SSR and the client's initial render agree
  // (no hydration mismatch on the default list name).
  const defaultName = `Week of ${new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })} · Patients`;

  return (
    <NewListForm
      locations={(locations ?? []).map((l) => ({
        id: l.id,
        name: l.display_name,
        defaultLanguage: l.default_language,
      }))}
      selectedLocationId={selectedLocationId}
      defaultName={defaultName}
    />
  );
}
