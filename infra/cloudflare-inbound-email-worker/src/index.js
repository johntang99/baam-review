import PostalMime from "postal-mime";

/**
 * Cloudflare Email Worker — the receiver for BAAM Review's email-in bridge.
 * Businesses forward their order/booking confirmation emails to
 *   r-<token>@inbound.baamplatform.com
 * Cloudflare Email Routing delivers them here; we parse the message and POST
 * { to, from, subject, text } to BAAM Review's inbound endpoint, which resolves
 * the location from the address token and queues the customer.
 *
 * Vars/secrets (see wrangler.toml):
 *   BAAM_INBOUND_URL     = https://baamreview.com/api/integrations/inbound-email
 *   INBOUND_EMAIL_SECRET = (secret) must match the app's INBOUND_EMAIL_SECRET
 */
export default {
  async email(message, env) {
    let subject = message.headers.get("subject") || "";
    let text = "";
    try {
      const parsed = await new PostalMime().parse(message.raw);
      text = parsed.text || parsed.html || "";
      subject = parsed.subject || subject;
    } catch {
      // Fallback: forward the raw message; the AI parser tolerates messy input.
      try {
        text = await new Response(message.raw).text();
      } catch {
        /* give up on body; headers below still help */
      }
    }

    try {
      const resp = await fetch(env.BAAM_INBOUND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-inbound-secret": env.INBOUND_EMAIL_SECRET,
        },
        body: JSON.stringify({
          to: message.to, // r-<token>@inbound.baamplatform.com
          from: message.from,
          subject,
          text,
        }),
      });
      if (!resp.ok) {
        console.log("BAAM inbound POST failed:", resp.status, await resp.text());
      }
    } catch (e) {
      console.log("BAAM inbound POST error:", e);
    }
    // Do not message.setReject() — we always accept so senders see no bounce.
  },
};
