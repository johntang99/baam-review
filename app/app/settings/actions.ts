"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SenderUpdateResult {
  ok: boolean;
  error?: string;
}

export async function updateSenderSettings(
  formData: FormData,
): Promise<SenderUpdateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, error: "No account for current user." };
  }

  const senderEmailRaw = formData.get("sender_email");
  const senderNameRaw = formData.get("sender_name");

  const senderEmail =
    typeof senderEmailRaw === "string" && senderEmailRaw.trim() !== ""
      ? senderEmailRaw.trim().toLowerCase()
      : null;
  const senderName =
    typeof senderNameRaw === "string" && senderNameRaw.trim() !== ""
      ? senderNameRaw.trim()
      : null;

  if (senderEmail && !isEmail(senderEmail)) {
    return { ok: false, error: "That doesn't look like a valid email address." };
  }

  // If email changed, reset verification so the BAAM Studio admin re-verifies.
  const { data: current } = await supabase
    .from("accounts")
    .select("sender_email")
    .eq("id", profile.account_id)
    .maybeSingle();

  const changed = current?.sender_email !== senderEmail;

  const { error } = await supabase
    .from("accounts")
    .update({
      sender_email: senderEmail,
      sender_name: senderName,
      ...(changed ? { sender_verified_at: null } : {}),
    })
    .eq("id", profile.account_id);

  if (error) {
    return { ok: false, error: `Save failed: ${error.message}` };
  }

  revalidatePath("/app/settings");
  return { ok: true };
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
