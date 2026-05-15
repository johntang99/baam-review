"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  validateRow,
  type Lang,
  type RawRow,
} from "@/lib/lists/normalize";

export interface CreateListInput {
  name: string;
  locationId: string;
  defaultLanguage: Lang;
  rows: RawRow[];
  // "draft" → back to /app/lists ; "review" → /app/lists/[id]/review
  destination: "draft" | "review";
}

export interface CreateListResult {
  ok: boolean;
  error?: string;
}

export async function createList(
  input: CreateListInput,
): Promise<CreateListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/lists/new");

  if (!input.locationId) {
    return { ok: false, error: "Pick a source client (location)." };
  }
  if (input.rows.length === 0) {
    return { ok: false, error: "Import at least one customer." };
  }

  // Resolve the public.users row id for created_by (matches the
  // review_requests.created_by convention — public.users, not auth.users).
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  // Opt-out suppression list for this location.
  const { data: optRows } = await supabase
    .from("opt_outs")
    .select("contact")
    .eq("location_id", input.locationId);
  const optedOut = new Set((optRows ?? []).map((o) => o.contact));

  const validated = input.rows.map((r) =>
    validateRow(r, input.defaultLanguage, optedOut),
  );
  const readyCount = validated.filter((v) => !v.excludedReason).length;
  const excludedCount = validated.length - readyCount;

  // 1) Create the list (draft).
  const { data: list, error: listErr } = await supabase
    .from("lists")
    .insert({
      location_id: input.locationId,
      name: input.name.trim() || "Untitled list",
      default_language: input.defaultLanguage,
      status: "draft",
      customer_count: validated.length,
      created_by: profile?.id ?? null,
    })
    .select("id")
    .single();

  if (listErr || !list) {
    return { ok: false, error: listErr?.message ?? "Couldn't create list." };
  }

  // 2) Insert every row. Excluded rows are still stored (selected=false)
  //    for record-keeping per §5.
  const customerRows = validated.map((v) => ({
    list_id: list.id,
    location_id: input.locationId,
    name: v.name,
    email: v.email,
    phone: v.phone,
    language: v.language,
    channel: v.channel,
    visit_date: v.visitDate,
    notes: v.notes || null,
    status: v.excludedReason ? ("excluded" as const) : ("pending" as const),
    selected: !v.excludedReason,
    excluded_reason: v.excludedReason,
  }));

  const { error: custErr } = await supabase
    .from("list_customers")
    .insert(customerRows);

  if (custErr) {
    // Roll back the list so we don't leave an empty shell.
    await supabase.from("lists").delete().eq("id", list.id);
    return { ok: false, error: custErr.message };
  }

  revalidatePath("/app/lists");

  // Flash summary surfaced via query param (the codebase has no toast lib;
  // reconciled from the plan's sonner toast to an inline flash banner).
  const flash = encodeURIComponent(
    `List created · ${readyCount} ready${
      excludedCount > 0 ? ` · ${excludedCount} auto-excluded` : ""
    }`,
  );

  if (input.destination === "review") {
    redirect(`/app/lists/${list.id}/review?flash=${flash}`);
  }
  redirect(`/app/lists?flash=${flash}`);
}

// ---- Pre-send (PG8) inline edits ----

export async function updateListCustomer(
  customerId: string,
  patch: {
    selected?: boolean;
    channel?: "email" | "sms";
    notes?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("list_customers")
    .update(patch)
    .eq("id", customerId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveListAsDraft(listId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("lists")
    .update({ status: "draft" })
    .eq("id", listId)
    .eq("status", "draft");

  revalidatePath("/app/lists");
  redirect("/app/lists?flash=" + encodeURIComponent("Draft saved"));
}
