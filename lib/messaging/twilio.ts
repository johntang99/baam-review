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
 * Configured? Returns true if Twilio env vars are present. UI can check this
 * to hide/show the SMS channel option until A2P registration is complete.
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSmsViaTwilio(opts: SendSmsOpts): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return {
      ok: false,
      providerId: null,
      error:
        "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in your environment.",
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({
    From: from,
    To: opts.to,
    Body: opts.body,
  });
  if (opts.statusCallback) form.set("StatusCallback", opts.statusCallback);

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

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
