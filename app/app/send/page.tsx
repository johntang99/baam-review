import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTwilioConfigured } from "@/lib/messaging/twilio";
import { PageHeader } from "@/components/admin/page-header";
import { SendForm } from "./send-form";

export const metadata = {
  title: "Send request — BAAM Review",
};

export default async function SendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/send");

  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name, default_language, supported_languages")
    .order("created_at", { ascending: false });

  const smsEnabled = isTwilioConfigured();

  return (
    <main className="px-10 py-10 space-y-8">
      <PageHeader
        eyebrow="Send"
        title="Send a review request"
        description="One customer at a time. They'll receive a link to a 60-second review flow."
      />
      <SendForm locations={locations ?? []} smsEnabled={smsEnabled} />
    </main>
  );
}
