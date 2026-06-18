import "server-only";
import { randomBytes } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Email-in bridge helpers. A business forwards its order/booking confirmation
 * emails to a per-location address; we parse the customer's contact out of the
 * email and enqueue it. The cheapest, most universal door — no integration on
 * the business's side beyond a forwarding rule.
 *
 * See docs/operations/INTEGRATION_BRIDGES_PLAN.md (Item 1).
 */

const EXTRACT_MODEL = "claude-haiku-4-5-20251001"; // cheap; pennies per email

export function inboundEmailDomain(): string {
  return process.env.INBOUND_EMAIL_DOMAIN || "inbound.baamreview.com";
}

/** The forward-to address for a location, given its token. */
export function inboundAddressFor(token: string): string {
  return `r-${token}@${inboundEmailDomain()}`;
}

/** Get (or lazily create) a location's inbound token. */
export async function ensureInboundToken(locationId: string): Promise<string> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("locations")
    .select("inbound_email_token")
    .eq("id", locationId)
    .maybeSingle<{ inbound_email_token: string | null }>();
  if (data?.inbound_email_token) return data.inbound_email_token;

  const token = randomBytes(6).toString("hex"); // 12 hex chars
  await svc
    .from("locations")
    .update({ inbound_email_token: token })
    .eq("id", locationId);
  return token;
}

/** Resolve the location id from a `to` address like r-<token>@domain. */
export async function resolveLocationByInboundAddress(
  toAddress: string | null | undefined,
): Promise<string | null> {
  if (!toAddress) return null;
  const m = toAddress.toLowerCase().match(/r-([a-z0-9]+)@/);
  if (!m) return null;
  const token = m[1];
  const svc = createServiceClient();
  const { data } = await svc
    .from("locations")
    .select("id")
    .eq("inbound_email_token", token)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export interface ExtractedContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  service: string | null;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
// Role/business addresses that are never the customer.
const NON_CUSTOMER =
  /no-?reply|do-?not-?reply|notification|mailer|postmaster|support@|service@|billing@|admin@|hello@|info@|team@|accounts?@|store\+|@.*shopifyemail|@.*squareup|@.*calendly|@baamplatform\.com|@baamreview\.com|baamplatform@|baamreview@/i;

/** Pull the bare address out of "Name <email>" / "<email>" / "email". */
function bareAddr(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

/** An email we must NOT treat as the customer: a role/business address, our own
 *  infra, or the FORWARDER/sender (a business forwarding its own confirmation —
 *  the customer is in the body, never the From). */
function isBusinessLike(email: string | null, from: string | null | undefined): boolean {
  if (!email) return true;
  const e = email.toLowerCase();
  if (NON_CUSTOMER.test(e)) return true;
  const fromAddr = bareAddr(from);
  if (fromAddr && e === fromAddr) return true; // the forwarder/sender
  return false;
}

/**
 * Pull the CUSTOMER's contact out of a forwarded confirmation email. Tries
 * Claude Haiku first (handles arbitrary templates + distinguishes the customer
 * from the business), falls back to regex if AI is unavailable.
 */
export async function extractContactFromEmail(input: {
  from?: string | null;
  subject?: string | null;
  text?: string | null;
}): Promise<ExtractedContact> {
  const ai = await extractWithAI(input).catch(() => null);
  if (ai) {
    // AI ran — trust its judgment (it returns nulls for non-customer emails).
    // Never accept the forwarder/business as the "customer".
    if (isBusinessLike(ai.email, input.from)) ai.email = null;
    return ai;
  }
  // Only when AI is unavailable (no key) / errored: best-effort regex.
  return extractWithRegex(input);
}

async function extractWithAI(input: {
  from?: string | null;
  subject?: string | null;
  text?: string | null;
}): Promise<ExtractedContact | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  const body = (input.text ?? "").slice(0, 6000);
  const resp = await client.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 300,
    system:
      "Extract a CUSTOMER's contact ONLY from a genuine order/booking/appointment/" +
      "purchase confirmation. The customer is the buyer/patient/recipient — NEVER " +
      "the business, store, sender/forwarder, support, no-reply, or an internal/" +
      "onboarding/marketing/notification email. If this is NOT a customer " +
      "transaction confirmation, or you cannot clearly identify the customer, " +
      "return ALL null. Return ONLY minified JSON: " +
      '{"name":string|null,"email":string|null,"phone":string|null,"service":string|null}. ' +
      "service = the product/appointment name if present.",
    messages: [
      {
        role: "user",
        content: `From: ${input.from ?? ""}\nSubject: ${input.subject ?? ""}\n\n${body}`,
      },
    ],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  try {
    const p = JSON.parse(json[0]) as Partial<ExtractedContact>;
    return {
      name: p.name?.trim() || null,
      email: p.email?.trim().toLowerCase() || null,
      phone: p.phone?.trim() || null,
      service: p.service?.trim() || null,
    };
  } catch {
    return null;
  }
}

function extractWithRegex(input: {
  from?: string | null;
  subject?: string | null;
  text?: string | null;
}): ExtractedContact {
  const hay = `${input.subject ?? ""}\n${input.text ?? ""}`;
  const emails = (hay.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase());
  // First address that is NOT a business/role/forwarder address. If all of them
  // are business-like (e.g. a non-customer notification), return none — do NOT
  // fall back to the sender.
  const email = emails.find((e) => !isBusinessLike(e, input.from)) ?? null;
  const phoneRaw = hay.match(PHONE_RE)?.[0] ?? null;
  const phone = phoneRaw && phoneRaw.replace(/\D/g, "").length >= 10 ? phoneRaw : null;
  return { name: null, email, phone, service: input.subject?.trim() || null };
}
