import { CallbackClient } from "./callback-client";

export const metadata = { title: "Signing you in — BAAM Review" };
export const dynamic = "force-dynamic";

/**
 * Auth callback. Renders a client island that handles all three flavours
 * Supabase can send us:
 *
 *   • ?code=…             — PKCE flow (sign-in / sign-up / magic-link
 *                           clicked in same browser)
 *   • ?token_hash=&type=  — server-side OTP (recovery / invite when the
 *                           email template uses TokenHash directly)
 *   • #access_token=…&refresh_token=…
 *                         — implicit flow (default Supabase recovery /
 *                           invite email after passing through the
 *                           /auth/v1/verify endpoint)
 *
 * The hash variant is the one that bit us — server routes can't read
 * URL fragments, so this had to move to the client.
 */
export default function AuthCallbackPage() {
  return <CallbackClient />;
}
