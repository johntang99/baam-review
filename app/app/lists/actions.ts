"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendReviewRequest } from "@/app/app/send/actions";
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

export interface SendListResult {
  ok: boolean;
  sent: number;
  failed: number;
  errors?: string[];
  error?: string;
}

/**
 * Session 14 · Phase Gate 1 — batch send.
 *
 * Plan §4.1 says "single transaction; rollback if any individual send fails."
 * Reconciliation: a sent email/SMS is an irreversible side-effect — it cannot
 * be transactionally rolled back. Implemented as best-effort per-customer:
 * each success flips that customer to 'sent' + logs a list_event; failures
 * stay 'pending' and are collected. This is exactly the partial-success model
 * §4.8 is designed around. The only hard abort is the can't-send-twice guard
 * (list must be 'draft').
 *
 * Sends are synchronous and sequential via the existing v1 sendReviewRequest
 * (no queue/edge-function exists despite §5's assumption). v1's per-send
 * velocity guard still applies, so very large batches may see some customers
 * velocity-flagged/blocked — surfaced in the failure count, not swallowed.
 */
export async function sendList(listId: string): Promise<SendListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: list } = await supabase
    .from("lists")
    .select("id, status, location_id")
    .eq("id", listId)
    .maybeSingle();
  if (!list) return { ok: false, sent: 0, failed: 0, error: "List not found." };
  if (list.status !== "draft") {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: `List is already ${list.status} — can't send again.`,
    };
  }

  const { data: customers } = await supabase
    .from("list_customers")
    .select("id, name, email, phone, language, channel")
    .eq("list_id", listId)
    .eq("selected", true)
    .is("excluded_reason", null);

  const targets = customers ?? [];
  if (targets.length === 0) {
    return { ok: false, sent: 0, failed: 0, error: "No customers to send to." };
  }

  // Mark in-flight so a double-click can't re-enter (status guard above).
  await supabase.from("lists").update({ status: "sending" }).eq("id", listId);

  let sent = 0;
  const errors: string[] = [];

  for (const c of targets) {
    const fd = new FormData();
    fd.set("location_id", list.location_id);
    fd.set("recipient_name", c.name);
    fd.set("channel", c.channel);
    fd.set("language", c.language);
    if (c.email) fd.set("recipient_email", c.email);
    if (c.phone) fd.set("recipient_phone", c.phone);

    let res;
    try {
      res = await sendReviewRequest(fd);
    } catch (e) {
      res = {
        ok: false,
        error: e instanceof Error ? e.message : "Send threw",
      };
    }

    if (res.ok && "requestId" in res && res.requestId) {
      await supabase
        .from("list_customers")
        .update({
          status: "sent",
          touches: 1,
          send_request_id: res.requestId,
        })
        .eq("id", c.id);
      await supabase.from("list_events").insert({
        list_customer_id: c.id,
        list_id: listId,
        location_id: list.location_id,
        event_type: "sent",
        metadata: { channel: c.channel, touch_number: 1 },
      });
      sent += 1;
    } else {
      errors.push(`${c.name}: ${res.error ?? "send failed"}`);
    }
  }

  const failed = targets.length - sent;

  if (sent === 0) {
    // Nothing went out — revert to draft so the user can retry.
    await supabase.from("lists").update({ status: "draft" }).eq("id", listId);
    return {
      ok: false,
      sent: 0,
      failed,
      errors,
      error: "No sends succeeded — list left as draft.",
    };
  }

  await supabase
    .from("lists")
    .update({
      status: "active",
      sent_at: new Date().toISOString(),
      customer_count: sent,
    })
    .eq("id", listId);

  revalidatePath("/app/lists");
  revalidatePath(`/app/lists/${listId}`);

  return {
    ok: true,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export interface ResendResult {
  ok: boolean;
  resent: number;
  failed: number;
  errors?: string[];
  error?: string;
}

/**
 * Session 14 · Phase Gate 6 — second-touch resend.
 *
 * Re-validates eligibility server-side (never trusts the client's id list):
 * active funnel status, selected, not excluded, touches < max_touches, and
 * last send/resent > 5 days ago. Best-effort per customer (same irreversible-
 * email reconciliation as sendList — see PG1). Each success bumps touches,
 * repoints send_request_id, resets status to 'sent' so webhook events track
 * the second touch, and logs a 'resent' list_event with the new touch number.
 */
export async function resendToCustomers(
  listId: string,
  customerIds: string[],
): Promise<ResendResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (customerIds.length === 0) {
    return { ok: false, resent: 0, failed: 0, error: "No customers selected." };
  }

  const { data: list } = await supabase
    .from("lists")
    .select("id, status, location_id, max_touches")
    .eq("id", listId)
    .maybeSingle();
  if (!list) {
    return { ok: false, resent: 0, failed: 0, error: "List not found." };
  }

  const { data: candidates } = await supabase
    .from("list_customers")
    .select(
      "id, name, email, phone, language, channel, status, touches, selected, excluded_reason",
    )
    .eq("list_id", listId)
    .in("id", customerIds);

  // Most-recent send/resent per candidate → enforce the 5-day threshold.
  const { data: sendEvents } = await supabase
    .from("list_events")
    .select("list_customer_id, occurred_at")
    .eq("list_id", listId)
    .in("event_type", ["sent", "resent"]);
  const lastSend = new Map<string, number>();
  for (const e of sendEvents ?? []) {
    const t = new Date(e.occurred_at).getTime();
    if (t > (lastSend.get(e.list_customer_id) ?? 0))
      lastSend.set(e.list_customer_id, t);
  }

  const now = Date.now();
  const eligible = (candidates ?? []).filter((c) => {
    if (!c.selected || c.excluded_reason) return false;
    if (!["sent", "delivered", "opened", "clicked"].includes(c.status))
      return false;
    if (c.touches >= list.max_touches) return false;
    const ls = lastSend.get(c.id);
    return !!ls && now - ls >= FIVE_DAYS_MS;
  });

  if (eligible.length === 0) {
    return {
      ok: false,
      resent: 0,
      failed: 0,
      error: "None of the selected customers are eligible for resend.",
    };
  }

  let resent = 0;
  const errors: string[] = [];

  for (const c of eligible) {
    const fd = new FormData();
    fd.set("location_id", list.location_id);
    fd.set("recipient_name", c.name);
    fd.set("channel", c.channel);
    fd.set("language", c.language);
    if (c.email) fd.set("recipient_email", c.email);
    if (c.phone) fd.set("recipient_phone", c.phone);

    let res;
    try {
      res = await sendReviewRequest(fd);
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : "threw" };
    }

    if (res.ok && "requestId" in res && res.requestId) {
      const nextTouch = c.touches + 1;
      await supabase
        .from("list_customers")
        .update({
          status: "sent",
          touches: nextTouch,
          send_request_id: res.requestId,
        })
        .eq("id", c.id);
      await supabase.from("list_events").insert({
        list_customer_id: c.id,
        list_id: listId,
        location_id: list.location_id,
        event_type: "resent",
        metadata: { channel: c.channel, touch_number: nextTouch },
      });
      resent += 1;
    } else {
      errors.push(`${c.name}: ${res.error ?? "resend failed"}`);
    }
  }

  revalidatePath(`/app/lists/${listId}`);
  revalidatePath("/app/lists");

  return {
    ok: resent > 0,
    resent,
    failed: eligible.length - resent,
    errors: errors.length > 0 ? errors : undefined,
    error: resent === 0 ? "No resends succeeded." : undefined,
  };
}

export async function markListComplete(listId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("lists")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", listId)
    .in("status", ["active", "sending"]);

  revalidatePath("/app/lists");
  revalidatePath(`/app/lists/${listId}`);
  redirect(
    `/app/lists/${listId}?flash=` + encodeURIComponent("List marked complete"),
  );
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
