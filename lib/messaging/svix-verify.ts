import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Svix-signed webhook (Resend uses Svix under the hood).
 *
 * Returns true if the signature is valid AND the timestamp is within the
 * tolerance window (default 5 minutes — protects against replay attacks).
 *
 * Spec: https://docs.svix.com/receiving/verifying-payloads/how-manual
 *
 * @param secret  The "whsec_…" string from the Resend dashboard.
 * @param headers The request headers — case-insensitive lookup.
 * @param body    The raw request body, as received (string).
 */
export function verifySvixSignature(opts: {
  secret: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  body: string;
  toleranceSeconds?: number;
}): boolean {
  const {
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
    body,
    toleranceSeconds = 5 * 60,
  } = opts;

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Replay protection.
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > toleranceSeconds) return false;

  // Decode the secret. Svix secrets are "whsec_" + base64(rawBytes).
  if (!secret.startsWith("whsec_")) return false;
  let key: Buffer;
  try {
    key = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const expectedSig = createHmac("sha256", key)
    .update(toSign)
    .digest("base64");

  // Header format: "v1,<base64sig> v1,<base64sig> ..." (multiple signatures
  // may be present during a secret rotation). Any match counts as verified.
  for (const part of svixSignature.split(" ")) {
    const [version, providedSig] = part.split(",");
    if (version !== "v1" || !providedSig) continue;
    if (constantTimeEq(providedSig, expectedSig)) return true;
  }
  return false;
}

function constantTimeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
