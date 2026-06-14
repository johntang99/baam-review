import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  normalizeEmail,
  normalizePhone,
  normalizeLanguage,
} from "@/lib/lists/normalize";

/**
 * Phase 1 of the Integrations & Contact Intake SOP — the single "queue
 * feeder" every intake door (webhook, Zapier/n8n, native connector) calls.
 *
 * It appends one inbound customer contact to the location's rolling
 * `source = 'integration'` list as a pending `list_customers` row, so it
 * surfaces in the normal Bulk Review Requests flow (/app/lists): staff
 * generate AI variations and "Send in Gmail" one-by-one for email; SMS can be
 * auto-sent later. This function deliberately does NOT send anything — the
 * human-sent Gmail step is the deliverability moat.
 *
 * Runs with the service-role client because Phase 2's webhook is
 * unauthenticated (it authenticates via a per-location API key, not a user
 * session). Keep this returning only safe, non-enumerating results.
 *
 * See docs/operations/INTEGRATIONS_AND_INTAKE_SOP.md.
 */

const DEDUPE_WINDOW_DAYS = 60;

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD — the rolling
 *  integration list's window key. */
function weekKeyOf(d: Date): string {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = (x.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

/** Human label for the list name, e.g. "Jun 9". */
function weekLabel(weekKey: string): string {
  const [y, m, day] = weekKey.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${day}, ${y}`;
}

export interface EnqueueInput {
  /** BAAM location slug or uuid (which business this contact belongs to). */
  location: string;
  name?: string | null;
  /** At least one of email / phone is required. */
  email?: string | null;
  phone?: string | null;
  /** "en" | "zh" | "es" (or aliases); falls back to the list default. */
  language?: string | null;
  /** Optional, flows into the AI prompt as context (e.g. "Acupuncture"). */
  service?: string | null;
  /** ISO timestamp of the transaction/visit; used as the customer's visit_date. */
  transactedAt?: string | null;
  /** Idempotency key (e.g. POS transaction id). Re-sending is a no-op. */
  externalId?: string | null;
}

export type EnqueueResult =
  | { status: "queued"; listId: string; listCustomerId: string }
  | {
      status: "skipped";
      reason: "location_not_found" | "no_contact" | "opted_out" | "duplicate";
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function enqueueReviewRequest(
  input: EnqueueInput,
): Promise<EnqueueResult> {
  const svc = createServiceClient();

  // ── Resolve the location (by uuid or slug) ──────────────────────────────
  const locQuery = svc
    .from("locations")
    .select("id, default_language")
    .limit(1);
  const { data: loc } = UUID_RE.test(input.location)
    ? await locQuery.eq("id", input.location).maybeSingle()
    : await locQuery.eq("slug", input.location).maybeSingle();
  if (!loc) return { status: "skipped", reason: "location_not_found" };

  // ── Normalize contact ───────────────────────────────────────────────────
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return { status: "skipped", reason: "no_contact" };

  // Email is the deliverability channel (one-by-one Gmail → Primary inbox), so
  // prefer it when present; SMS only when that's all we have.
  const channel: "email" | "sms" = email ? "email" : "sms";
  const language =
    normalizeLanguage(input.language) ??
    (loc.default_language as "en" | "zh" | "es" | null) ??
    "en";

  // ── Opt-out suppression (per location, by normalized contact) ───────────
  const contacts = [email, phone].filter((c): c is string => !!c);
  const { data: optRows } = await svc
    .from("opt_outs")
    .select("contact")
    .eq("location_id", loc.id)
    .in("contact", contacts);
  if ((optRows ?? []).length > 0) {
    return { status: "skipped", reason: "opted_out" };
  }

  // ── Idempotency on external_id (POS retry / duplicate event) ────────────
  if (input.externalId) {
    const { data: existing } = await svc
      .from("list_customers")
      .select("id")
      .eq("location_id", loc.id)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (existing) return { status: "skipped", reason: "duplicate" };
  }

  // ── 60-day dedupe: don't re-ask the same person as transactions stream in.
  const since = new Date(
    Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const dupeOr = contacts
    .map((c) => `email.eq.${c},phone.eq.${c}`)
    .join(",");
  const { data: recent } = await svc
    .from("list_customers")
    .select("id")
    .eq("location_id", loc.id)
    .gte("created_at", since)
    .neq("status", "excluded")
    .or(dupeOr)
    .limit(1);
  if ((recent ?? []).length > 0) {
    return { status: "skipped", reason: "duplicate" };
  }

  // ── Find-or-create THIS WEEK's rolling integration list for the location ─
  const listId = await getOrCreateIntegrationList(svc, loc.id, language);

  // ── Append the pending customer ─────────────────────────────────────────
  const visitDate = parseVisitDate(input.transactedAt);
  const { data: inserted, error: insErr } = await svc
    .from("list_customers")
    .insert({
      list_id: listId,
      location_id: loc.id,
      name: input.name?.trim() || "(no name)",
      email,
      phone,
      language,
      channel,
      visit_date: visitDate,
      notes: input.service?.trim() || null,
      status: "pending",
      selected: true,
      external_id: input.externalId ?? null,
    })
    .select("id")
    .single();

  // A concurrent insert with the same external_id loses the unique race —
  // treat that as the duplicate it is.
  if (insErr) {
    if (insErr.code === "23505") return { status: "skipped", reason: "duplicate" };
    throw new Error(`enqueueReviewRequest insert failed: ${insErr.message}`);
  }

  // Keep the denormalized counter honest (best-effort).
  await bumpCustomerCount(svc, listId);

  return { status: "queued", listId, listCustomerId: inserted.id };
}

/** Returns the location's integration list id, creating it if needed. The
 *  partial unique index (one integration list per location) makes the
 *  create idempotent under concurrency. */
async function getOrCreateIntegrationList(
  svc: ReturnType<typeof createServiceClient>,
  locationId: string,
  language: "en" | "zh" | "es",
): Promise<string> {
  const wk = weekKeyOf(new Date());
  const { data: existing } = await svc
    .from("lists")
    .select("id, status")
    .eq("location_id", locationId)
    .eq("source", "integration")
    .eq("window_key", wk)
    .maybeSingle();
  if (existing) {
    // Within the same week, keep the list live so a newly-fed contact after a
    // staff "mark complete" doesn't get stranded in a completed list.
    if (existing.status !== "active") {
      await svc
        .from("lists")
        .update({ status: "active", completed_at: null })
        .eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await svc
    .from("lists")
    .insert({
      location_id: locationId,
      name: `Incoming · week of ${weekLabel(wk)}`,
      default_language: language,
      status: "active",
      source: "integration",
      window_key: wk,
      customer_count: 0,
    })
    .select("id")
    .single();

  if (error) {
    // Lost the create race — another request made this week's list first.
    const { data: again } = await svc
      .from("lists")
      .select("id")
      .eq("location_id", locationId)
      .eq("source", "integration")
      .eq("window_key", wk)
      .maybeSingle();
    if (again) return again.id;
    throw new Error(`integration list create failed: ${error.message}`);
  }
  return created.id;
}

async function bumpCustomerCount(
  svc: ReturnType<typeof createServiceClient>,
  listId: string,
): Promise<void> {
  const { count } = await svc
    .from("list_customers")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);
  if (count != null) {
    await svc.from("lists").update({ customer_count: count }).eq("id", listId);
  }
}

/** Accept an ISO timestamp or date; return a YYYY-MM-DD string or null. */
function parseVisitDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const m = ts.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
