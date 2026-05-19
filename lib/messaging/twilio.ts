import "server-only";

export interface SendSmsOpts {
  to: string;
  body: string;
  /** Optional URL Twilio should POST status callbacks to. */
  statusCallback?: string;
}

export interface SendSmsResult {
  ok: boolean;
  providerId: string | null;
  error: string | null;
}

/**
 * Auth resolution. The REST URL always needs the Account SID (AC…). For the
 * Basic-auth credentials we prefer a scoped API Key (SK… + Secret) — Twilio's
 * recommended model: independently revocable, least-privilege — and fall back
 * to the account Auth Token if no API key is set (zero-downtime migration).
 */
function resolveTwilioAuth(): { user: string; pass: string } | null {
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  if (keySid && keySecret) return { user: keySid, pass: keySecret };

  const token = process.env.TWILIO_AUTH_TOKEN;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (sid && token) return { user: sid, pass: token };

  return null;
}

/**
 * Configured? Returns true if Twilio env vars are present. UI can check this
 * to hide/show the SMS channel option until A2P registration is complete.
 * Needs the Account SID (for the URL), a sending number, and *either* an
 * API key pair *or* the Auth Token.
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_FROM_NUMBER &&
    resolveTwilioAuth()
  );
}

export async function sendSmsViaTwilio(opts: SendSmsOpts): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const from = process.env.TWILIO_FROM_NUMBER;
  const creds = resolveTwilioAuth();

  if (!sid || !from || !creds) {
    return {
      ok: false,
      providerId: null,
      error:
        "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER, and either TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (preferred) or TWILIO_AUTH_TOKEN.",
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({
    From: from,
    To: opts.to,
    Body: opts.body,
  });
  if (opts.statusCallback) form.set("StatusCallback", opts.statusCallback);

  const auth = Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const json = (await res.json()) as { sid?: string; message?: string; error_message?: string };
    if (!res.ok) {
      return {
        ok: false,
        providerId: null,
        error: json.error_message || json.message || `Twilio ${res.status}`,
      };
    }
    return { ok: true, providerId: json.sid ?? null, error: null };
  } catch (e) {
    return {
      ok: false,
      providerId: null,
      error: e instanceof Error ? e.message : "Unknown Twilio error",
    };
  }
}
