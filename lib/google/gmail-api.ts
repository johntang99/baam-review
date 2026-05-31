import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { refreshGmailAccessToken } from "@/lib/google/gmail-oauth";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export async function getValidGmailAccessTokenForLocation(
  locationId: string,
): Promise<{ accessToken: string; googleEmail: string | null }> {
  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("gmail_oauth_tokens")
    .select("access_token, refresh_token, expiry, google_email")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) throw new Error(`Gmail token lookup failed: ${error.message}`);
  if (!row) throw new Error("Gmail API is not connected for this location.");

  const expiresAt = new Date(row.expiry).getTime();
  const stillFresh = expiresAt - Date.now() > 60_000;
  if (stillFresh) {
    return {
      accessToken: row.access_token,
      googleEmail: row.google_email ?? null,
    };
  }

  const refreshed = await refreshGmailAccessToken(row.refresh_token);
  const { error: updateError } = await supabase
    .from("gmail_oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      expiry: refreshed.expiry.toISOString(),
    })
    .eq("location_id", locationId);
  if (updateError) {
    throw new Error(`Gmail token refresh persist failed: ${updateError.message}`);
  }

  return {
    accessToken: refreshed.access_token,
    googleEmail: row.google_email ?? null,
  };
}

export async function sendEmailViaGmailApi(opts: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<{ providerId: string | null }> {
  const raw = buildRawMimeMessage({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    replyTo: opts.replyTo,
  });

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API send failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { id?: string };
  return { providerId: json.id ?? null };
}

function buildRawMimeMessage(opts: {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}): string {
  const headers: string[] = [
    `To: ${opts.to}`,
    `Subject: ${encodeHeaderUtf8(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (opts.replyTo) {
    headers.push(`Reply-To: ${opts.replyTo}`);
  }

  const bodyBase64 = wrapAt76(Buffer.from(opts.body, "utf8").toString("base64"));
  const mime = `${headers.join("\r\n")}\r\n\r\n${bodyBase64}`;
  return Buffer.from(mime, "utf8").toString("base64url");
}

function encodeHeaderUtf8(value: string): string {
  // RFC 2047 encoded-word for UTF-8 subject safety.
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapAt76(input: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += 76) {
    chunks.push(input.slice(i, i + 76));
  }
  return chunks.join("\r\n");
}
