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
// Addresses that are never the customer.
const NON_CUSTOMER = /no-?reply|do-?not-?reply|notification|mailer|postmaster|support|store\+|@.*shopifyemail|@.*squareup|@.*calendly/i;

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
  if (ai && (ai.email || ai.phone)) return ai;
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
      "You extract the CUSTOMER's contact details from a forwarded order/booking " +
      "confirmation email. The customer is the buyer/patient — NOT the business, " +
      "store, support, or no-reply address. Return ONLY minified JSON: " +
      '{"name":string|null,"email":string|null,"phone":string|null,"service":string|null}. ' +
      "service = the product/appointment name if present. Use null when unsure.",
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
  // Prefer an email that isn't an obvious business/no-reply address.
  const email =
    emails.find((e) => !NON_CUSTOMER.test(e)) ?? emails[0] ?? null;
  const phoneRaw = hay.match(PHONE_RE)?.[0] ?? null;
  const phone = phoneRaw && phoneRaw.replace(/\D/g, "").length >= 10 ? phoneRaw : null;
  return { name: null, email, phone, service: input.subject?.trim() || null };
}
