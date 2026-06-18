import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { enqueueReviewRequest } from "@/lib/integrations/enqueue";
import {
  resolveLocationByInboundAddress,
  extractContactFromEmail,
} from "@/lib/integrations/inbound-email";
import { verifyResendSignature } from "@/lib/integrations/svix-verify";

/**
 * Email-in bridge (Item 1). Accepts a forwarded confirmation email from the
 * inbound provider and queues the customer.
 *
 * Auth — either:
 *   • Resend inbound: Svix signature (svix-* / webhook-* headers) verified with
 *     RESEND_INBOUND_SIGNING_SECRET, OR
 *   • Generic providers (SendGrid Inbound Parse, Cloudflare Worker, etc.):
 *     shared INBOUND_EMAIL_SECRET via `x-inbound-secret` header or `?secret=`.
 *
 * Payload — tolerant of both Resend's nested `{ data: { from,to,subject,text } }`
 * and flat `{ from,to,subject,text }` (SendGrid/Mailgun field names too). The
 * location is resolved from the `to` address (r-<token>@domain).
 *
 * Always 200s on handled-but-skipped so providers don't retry.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // AI extraction

export async function POST(request: NextRequest) {
  const raw = await request.text();

  // ── Auth ────────────────────────────────────────────────────────────────
  const resendSecret = process.env.RESEND_INBOUND_SIGNING_SECRET;
  const hasSvix =
    request.headers.get("svix-signature") ??
    request.headers.get("webhook-signature");
  let authed = false;
  if (resendSecret && hasSvix) {
    authed = verifyResendSignature(raw, request.headers, resendSecret);
  } else {
    const shared = process.env.INBOUND_EMAIL_SECRET;
    const presented =
      request.headers.get("x-inbound-secret") ??
      request.nextUrl.searchParams.get("secret");
    authed = !!shared && presented === shared;
  }
  if (!authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ── Parse body (JSON or form) ────────────────────────────────────────────
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  let parsed: Record<string, unknown> = {};
  if (ct.includes("application/json") || raw.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* leave empty */
    }
  } else {
    parsed = Object.fromEntries(new URLSearchParams(raw));
  }

  // Resend nests the email under `data`; generic providers are flat.
  const d = parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : parsed;
  const pick = (k: string) => d[k] ?? parsed[k];

  const to = addressString(pick("to") ?? pick("recipient") ?? pick("envelope_to"));
  const from = emailString(pick("from") ?? pick("sender"));
  const subject = textOf(pick("subject"));
  const text = textOf(
    pick("text") ?? pick("html") ?? pick("body-plain") ?? pick("body"),
  );
  const messageId =
    textOf(pick("message_id") ?? pick("message-id")) ??
    request.headers.get("svix-id");

  // ── Resolve location → extract contact → enqueue ─────────────────────────
  const locationId = await resolveLocationByInboundAddress(to);
  if (!locationId) {
    return NextResponse.json({ ok: true, status: "no_location" });
  }

  const contact = await extractContactFromEmail({ from, subject, text });
  if (!contact.email && !contact.phone) {
    return NextResponse.json({ ok: true, status: "no_contact" });
  }

  const externalId =
    "email-" +
    createHash("sha256")
      .update(messageId || `${from}|${subject}|${contact.email}|${contact.phone}`)
      .digest("hex")
      .slice(0, 24);

  const result = await enqueueReviewRequest({
    location: locationId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    service: contact.service,
    externalId,
  });

  if (result.status === "queued") {
    return NextResponse.json(
      { ok: true, status: "queued", id: result.listCustomerId },
      { status: 201 },
    );
  }
  return NextResponse.json({ ok: true, status: "skipped", reason: result.reason });
}

// ── helpers: tolerate string | {email|address|name} | array shapes ──────────
function addressString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(addressString).filter(Boolean).join(",") || null;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (typeof o.email === "string" && o.email) || (typeof o.address === "string" && o.address) || null;
  }
  return null;
}
function emailString(v: unknown): string | null {
  return addressString(v);
}
function textOf(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
