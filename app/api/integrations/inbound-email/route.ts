import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { enqueueReviewRequest } from "@/lib/integrations/enqueue";
import {
  resolveLocationByInboundAddress,
  extractContactFromEmail,
} from "@/lib/integrations/inbound-email";
import { verifyResendSignature } from "@/lib/integrations/svix-verify";

/**
 * Email-in bridge. Accepts a forwarded confirmation email from the inbound
 * provider and queues the customer. Supports:
 *   • SendGrid Inbound Parse — multipart/form-data (to/from/subject/text/html);
 *     auth via shared INBOUND_EMAIL_SECRET (`?secret=` or x-inbound-secret).
 *   • Mailgun / Cloudflare worker — form or JSON + shared secret.
 *   • Resend inbound — JSON, Svix-signed (RESEND_INBOUND_SIGNING_SECRET).
 *     NOTE: Resend's email.received webhook is metadata-only (no body), so it
 *     can't feed the parser — use SendGrid for receiving.
 *
 * Location is resolved from the `to` address (r-<token>@domain). Always 200s on
 * a handled-but-skipped email so providers don't retry.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // AI extraction

export async function POST(request: NextRequest) {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  const isMultipart = ct.includes("multipart/form-data");

  // ── Read + parse the body (SendGrid = multipart; others = JSON/urlencoded) ─
  let raw = "";
  let parsed: Record<string, unknown> = {};
  if (isMultipart) {
    const fd = await request.formData();
    parsed = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
    );
  } else {
    raw = await request.text();
    if (ct.includes("application/json") || raw.trim().startsWith("{")) {
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        /* leave empty */
      }
    } else {
      parsed = Object.fromEntries(new URLSearchParams(raw));
    }
  }

  // ── Auth: Resend signs (Svix) JSON; everyone else uses the shared secret ──
  const resendSecret = process.env.RESEND_INBOUND_SIGNING_SECRET;
  const hasSvix =
    request.headers.get("svix-signature") ??
    request.headers.get("webhook-signature");
  let authed = false;
  if (!isMultipart && resendSecret && hasSvix) {
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

  // ── Extract fields (tolerant of Resend's nested `data` + flat providers) ──
  const d =
    parsed.data && typeof parsed.data === "object"
      ? (parsed.data as Record<string, unknown>)
      : parsed;
  const pick = (k: string) => d[k] ?? parsed[k];

  const to = addressString(pick("to") ?? pick("recipient") ?? pick("envelope_to"));
  const from = emailString(pick("from") ?? pick("sender"));
  const subject = textOf(pick("subject"));
  // textOf each candidate so an empty "" falls through (HTML-only emails).
  const text =
    textOf(pick("text")) ??
    textOf(pick("html")) ??
    textOf(pick("body-plain")) ??
    textOf(pick("body"));
  const messageId =
    textOf(pick("message_id") ?? pick("message-id")) ??
    request.headers.get("svix-id");

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
