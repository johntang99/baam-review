import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { enqueueReviewRequest } from "@/lib/integrations/enqueue";
import {
  resolveLocationByInboundAddress,
  extractContactFromEmail,
} from "@/lib/integrations/inbound-email";
import { parseWebhookBody, pickField } from "@/lib/integrations/parse-body";

/**
 * Email-in bridge (Item 1). The inbound-email provider (Cloudflare Email
 * Routing → Worker, Resend/Mailgun inbound, etc.) POSTs a forwarded
 * confirmation email here as JSON or form:
 *   { to, from, subject, text, message_id? }
 * Auth = shared INBOUND_EMAIL_SECRET (header x-inbound-secret or ?secret=).
 * The location is resolved from the `to` address (r-<token>@domain); the
 * customer's contact is parsed out and enqueued.
 *
 * Always 200s on a handled-but-skipped email so the provider doesn't retry.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // AI extraction call

export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  const presented =
    request.headers.get("x-inbound-secret") ??
    request.nextUrl.searchParams.get("secret");
  if (!secret || presented !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await parseWebhookBody(request);
  const to = pickField(body, "to", "recipient", "envelope_to");
  const from = pickField(body, "from", "sender");
  const subject = pickField(body, "subject");
  const text = pickField(body, "text", "body-plain", "plain", "body");
  const messageId = pickField(body, "message_id", "message-id", "messageId");

  const locationId = await resolveLocationByInboundAddress(to);
  if (!locationId) {
    // Unknown address — ack so the provider doesn't keep retrying.
    return NextResponse.json({ ok: true, status: "no_location" });
  }

  const contact = await extractContactFromEmail({ from, subject, text });
  if (!contact.email && !contact.phone) {
    return NextResponse.json({ ok: true, status: "no_contact" });
  }

  // Idempotency: prefer the provider's message id; else hash the email's
  // identifying parts so a re-forward of the same email doesn't double-queue.
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
