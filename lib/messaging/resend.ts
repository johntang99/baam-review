import "server-only";
import { Resend } from "resend";

export interface SendEmailOpts {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  /** Stable tags for tracking. */
  tags?: Array<{ name: string; value: string }>;
}

export interface SendResult {
  ok: boolean;
  providerId: string | null;
  error: string | null;
}

export async function sendEmailViaResend(
  opts: SendEmailOpts,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    return {
      ok: false,
      providerId: null,
      error: "Resend not configured (RESEND_API_KEY or RESEND_FROM missing)",
    };
  }

  const resend = new Resend(key);

  try {
    const result = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
      tags: opts.tags,
    });
    if (result.error) {
      return {
        ok: false,
        providerId: null,
        error: result.error.message || "Resend send error",
      };
    }
    return {
      ok: true,
      providerId: result.data?.id ?? null,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      providerId: null,
      error: e instanceof Error ? e.message : "Unknown send error",
    };
  }
}
