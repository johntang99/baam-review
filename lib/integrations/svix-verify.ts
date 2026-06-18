import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Resend (Svix / Standard Webhooks) signature without the svix SDK.
 * Resend signs the webhook with a secret like `whsec_<base64>`:
 *   signedContent = `${id}.${timestamp}.${rawBody}`
 *   signature     = base64( HMAC-SHA256(base64decode(secret), signedContent) )
 * The `svix-signature` (or `webhook-signature`) header is space-delimited
 * `v1,<sig>` entries; any match passes.
 */
export function verifyResendSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const ts = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const sigHeader =
    headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !ts || !sigHeader || !secret) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${ts}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");

  for (const part of sigHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    if (sig && safeEqual(sig, expected)) return true;
  }
  return false;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
