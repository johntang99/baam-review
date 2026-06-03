"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markRequestReviewActivated(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) redirect("/app");

  // Idempotent: skip if already set so we don't overwrite the original
  // activation timestamp (used for analytics on time-to-activation).
  const { data: account } = await supabase
    .from("accounts")
    .select("onboarding_request_activated_at")
    .eq("id", profile.account_id)
    .maybeSingle();

  if (!account?.onboarding_request_activated_at) {
    await supabase
      .from("accounts")
      .update({ onboarding_request_activated_at: new Date().toISOString() })
      .eq("id", profile.account_id);
  }

  revalidatePath("/app");
  redirect("/app/send");
}
