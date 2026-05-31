import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProcessingClient } from "./processing-client";

export const metadata = { title: "Generating your audit · BAAM Review" };
export const dynamic = "force-dynamic";

export default async function AuditProcessingPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect(`/login?next=/audit/${id}/processing`);
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("id,status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string }>();

  if (audit?.status === "complete") {
    redirect(`/audit/${id}`);
  }

  return (
    <main className="min-h-screen bg-cream">
      <ProcessingClient auditId={id} />
    </main>
  );
}
