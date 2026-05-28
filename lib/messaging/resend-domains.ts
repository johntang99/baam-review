import "server-only";
import { Resend } from "resend";

/**
 * Checks whether a sending-domain is verified in Resend.
 *
 * The location settings form lets staff enter a custom sender like
 * `review@drhuangclinic.com`. For sends to use that address (instead of the
 * shared no-reply on baamplatform.com), Resend needs to have the domain
 * verified AND we need to mirror that fact onto `locations.sender_verified_at`
 * — otherwise the send action's gate at sendReviewRequest falls back to the
 * shared sender.
 *
 * This helper does the live check against Resend's REST API so we can flip
 * sender_verified_at to NOW() the moment the domain shows up as verified in
 * the dashboard, no manual admin action required.
 *
 * Returns null on any error (missing API key, network failure, etc.) — the
 * caller treats null as "unverified" and uses the shared sender, which is
 * the safe default.
 */
export async function isDomainVerifiedInResend(
  domain: string,
): Promise<boolean | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!domain) return false;

  const client = new Resend(apiKey);
  try {
    const res = await client.domains.list();
    if (res.error || !res.data) return null;
    const match = res.data.data.find(
      (d) => d.name.toLowerCase() === domain.toLowerCase(),
    );
    return match?.status === "verified";
  } catch {
    return null;
  }
}

/** Extract the domain portion of an email address. Returns empty string on
 * malformed input — callers should guard against that. */
export function domainFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return "";
  return email.slice(at + 1).trim().toLowerCase();
}
