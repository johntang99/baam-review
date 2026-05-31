"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTrackingToken } from "@/lib/tokens";
import { buildSmsBody, buildEmail } from "@/lib/messaging/templates";
import { sendSmsViaTwilio, isTwilioConfigured } from "@/lib/messaging/twilio";
import { sendEmailViaResend } from "@/lib/messaging/resend";
import { checkVelocity } from "@/lib/messaging/velocity";
import { getLocationBillingState } from "@/lib/billing/access";
import { isLanguage, type Language } from "@/lib/i18n/review";
import {
  getValidGmailAccessTokenForLocation,
  sendEmailViaGmailApi,
} from "@/lib/google/gmail-api";

export interface SendResult {
  ok: boolean;
  error?: string;
  requestId?: string;
  flagged?: boolean;
  trackingUrl?: string;
}

export interface GmailDraftResult {
  ok: boolean;
  error?: string;
  requestId?: string;
  flagged?: boolean;
  trackingUrl?: string;
  subject?: string;
  body?: string;
}

export async function sendReviewRequestViaGmailApi(
  formData: FormData,
): Promise<SendResult> {
  const channelRaw = getString(formData, "channel");
  if (channelRaw !== "email") {
    return { ok: false, error: "Gmail API send only supports Email channel." };
  }
  const locationId = getString(formData, "location_id");
  const recipientEmail = getString(formData, "recipient_email");
  if (!locationId) return { ok: false, error: "Pick a location." };
  if (!recipientEmail) return { ok: false, error: "Email is required." };

  const draft = await createGmailDraftRequest(formData);
  if (!draft.ok) return draft;
  if (!draft.requestId || !draft.subject || !draft.body || !draft.trackingUrl) {
    return {
      ok: false,
      error: "Could not prepare Gmail API payload. Please try again.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { accessToken } = await getValidGmailAccessTokenForLocation(locationId);
    await sendEmailViaGmailApi({
      accessToken,
      to: recipientEmail,
      subject: draft.subject,
      body: draft.body,
      replyTo: user.email ?? undefined,
    });
  } catch (err) {
    const service = createServiceClient();
    await service
      .from("review_requests")
      .delete()
      .eq("id", draft.requestId)
      .is("sent_at", null);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Gmail API send failed. Please reconnect Gmail API or use manual Preview flow.",
    };
  }

  const now = new Date().toISOString();
  const service = createServiceClient();
  const { error: markErr } = await service
    .from("review_requests")
    .update({
      sent_at: now,
      delivered_at: now,
    })
    .eq("id", draft.requestId);
  if (markErr) {
    console.error(
      "Gmail API sent but failed to mark review_request timestamps",
      markErr,
    );
    return {
      ok: true,
      requestId: draft.requestId,
      flagged: !!draft.flagged,
      trackingUrl: draft.trackingUrl,
      error: "Message sent, but we couldn't log send timestamp. Please notify support.",
    };
  }

  revalidatePath("/app/send");
  revalidatePath("/app");

  return {
    ok: true,
    requestId: draft.requestId,
    flagged: !!draft.flagged,
    trackingUrl: draft.trackingUrl,
  };
}

export async function createGmailDraftRequest(
  formData: FormData,
): Promise<GmailDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, error: "No account for current user." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("suspended_at, name")
    .eq("id", profile.account_id)
    .maybeSingle();
  if (account?.suspended_at) {
    return { ok: false, error: "This account is currently suspended." };
  }

  const locationId = getString(formData, "location_id");
  const recipientName = getString(formData, "recipient_name");
  const recipientEmail = getString(formData, "recipient_email");
  const langRaw = getString(formData, "language");
  const language: Language = isLanguage(langRaw) ? langRaw : "en";

  if (!locationId) return { ok: false, error: "Pick a location." };
  if (!recipientName) return { ok: false, error: "Customer name is required." };
  if (!recipientEmail) return { ok: false, error: "Email is required." };

  const { data: location } = await supabase
    .from("locations")
    .select("id, slug, display_name, default_language, supported_languages")
    .eq("id", locationId)
    .maybeSingle();
  if (!location) return { ok: false, error: "Location not found." };

  const gate = await getLocationBillingState(location.id);
  if (!gate.allowed) {
    return {
      ok: false,
      error:
        "Billing required — set up billing for this location to send review requests.",
    };
  }

  const suppressionClient = createServiceClient();
  const { data: suppressed } = await suppressionClient
    .from("opt_outs")
    .select("id")
    .eq("location_id", location.id)
    .eq("contact", recipientEmail)
    .eq("channel", "email")
    .maybeSingle();
  if (suppressed) {
    return {
      ok: false,
      error:
        "This contact has unsubscribed or previously bounced — not opening Gmail draft.",
    };
  }

  const velocity = await checkVelocity(location.id);
  if (velocity.kind === "block") {
    return {
      ok: false,
      error: `Send blocked: too many requests (${velocity.current}/${velocity.limit} in the last ${velocity.reason === "velocity:hourly" ? "hour" : "24h"}). Slow down and try again later.`,
    };
  }

  const token = generateTrackingToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";
  const trackingUrl = `${appUrl}/r/${location.slug}?t=${token}`;
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?t=${token}`;
  const recipientFirst =
    recipientName.trim().split(/\s+/)[0] || recipientName.trim();
  const applyVars = (s: string) =>
    s
      .replaceAll("<slug>", location.slug)
      .replaceAll("<token>", token)
      .replaceAll("{name}", recipientFirst);

  const overrideSubjectRaw = getString(formData, "message_subject");
  const overrideBodyRaw = getString(formData, "message_body");
  const vars = {
    name: recipientName,
    businessName: location.display_name,
    link: trackingUrl,
    unsubscribeUrl,
  };
  const defaultEmail = buildEmail(language, vars);
  const subjectText = overrideSubjectRaw
    ? applyVars(overrideSubjectRaw)
    : defaultEmail.subject;
  const bodyText = overrideBodyRaw ? applyVars(overrideBodyRaw) : defaultEmail.body;
  const now = new Date().toISOString();
  const flaggedAt =
    velocity.kind === "flag" ? now : null;
  const flagReason = velocity.kind === "flag" ? velocity.reason : null;

  const service = createServiceClient();
  const { data: inserted, error: insertErr } = await service
    .from("review_requests")
    .insert({
      location_id: location.id,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_phone: null,
      language,
      channel: "email",
      tracking_token: token,
      message_sent: bodyText,
      // Gmail manual flow: draft opened now, actual send happens outside BAAM.
      sent_at: null,
      delivered_at: null,
      flagged_at: flaggedAt,
      flag_reason: flagReason,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("Failed to insert Gmail draft review_request", insertErr);
    return {
      ok: false,
      error:
        "Could not prepare tracked Gmail draft. Please try again or use Send via email.",
    };
  }

  revalidatePath("/app/send");
  revalidatePath("/app");

  return {
    ok: true,
    requestId: inserted.id,
    flagged: velocity.kind === "flag",
    trackingUrl,
    subject: subjectText,
    body: bodyText,
  };
}

export async function sendReviewRequest(formData: FormData): Promise<SendResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, error: "No account for current user." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("suspended_at, name")
    .eq("id", profile.account_id)
    .maybeSingle();
  if (account?.suspended_at) {
    return { ok: false, error: "This account is currently suspended." };
  }

  const locationId = getString(formData, "location_id");
  const recipientName = getString(formData, "recipient_name");
  const channelRaw = getString(formData, "channel");
  const recipientPhone = getString(formData, "recipient_phone");
  const recipientEmail = getString(formData, "recipient_email");
  const langRaw = getString(formData, "language");

  if (!locationId) return { ok: false, error: "Pick a location." };
  if (!recipientName) return { ok: false, error: "Customer name is required." };
  if (channelRaw !== "sms" && channelRaw !== "email") {
    return { ok: false, error: "Pick a channel (SMS or email)." };
  }
  const channel = channelRaw;
  const language: Language = isLanguage(langRaw) ? langRaw : "en";

  if (channel === "sms" && !recipientPhone) {
    return { ok: false, error: "Phone number is required for SMS." };
  }
  if (channel === "email" && !recipientEmail) {
    return { ok: false, error: "Email is required." };
  }
  if (channel === "sms" && !isTwilioConfigured()) {
    return {
      ok: false,
      error: "SMS is not configured yet (Twilio keys missing). Use email for now.",
    };
  }

  // Fetch location via RLS-typed client to verify ownership.
  const { data: location } = await supabase
    .from("locations")
    .select(
      "id, slug, display_name, default_language, supported_languages, sender_email, sender_name, sender_verified_at",
    )
    .eq("id", locationId)
    .maybeSingle();
  if (!location) return { ok: false, error: "Location not found." };

  const gate = await getLocationBillingState(location.id);
  if (!gate.allowed)
    return {
      ok: false,
      error:
        "Billing required — set up billing for this location to send review requests.",
    };

  // Suppression check: never send to a contact that has unsubscribed or
  // previously bounced/complained. track.ts + the resend webhook write
  // these into opt_outs; without this gate the send path keeps emailing
  // addresses Resend already knows bounce (silent non-delivery).
  const suppressionClient = createServiceClient();
  const suppressionContact =
    channel === "sms" ? recipientPhone : recipientEmail;
  if (suppressionContact) {
    const { data: suppressed } = await suppressionClient
      .from("opt_outs")
      .select("id")
      .eq("location_id", location.id)
      .eq("contact", suppressionContact)
      .eq("channel", channel)
      .maybeSingle();
    if (suppressed) {
      return {
        ok: false,
        error:
          "This contact has unsubscribed or previously bounced — not sending.",
      };
    }
  }

  const velocity = await checkVelocity(location.id);
  if (velocity.kind === "block") {
    return {
      ok: false,
      error: `Send blocked: too many requests (${velocity.current}/${velocity.limit} in the last ${velocity.reason === "velocity:hourly" ? "hour" : "24h"}). Slow down and try again later.`,
    };
  }

  const token = generateTrackingToken();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4001";
  const trackingUrl = `${appUrl}/r/${location.slug}?t=${token}`;
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?t=${token}`;

  // The form sends user-editable subject + body. Variables in the preview
  // were the rendered values for a placeholder URL — at send time we
  // substitute the real <slug>/<token> placeholders with the actual link.
  // Also substitute {name} as a safety net: list-variant generation uses
  // {name} as a per-customer placeholder, and AI rewrites are instructed
  // to use it too. If anything reaches here with an unresolved {name},
  // expand it to the recipient's first name so the email never ships
  // with a literal "Hi {name}," in production.
  const locSlug = location.slug;
  const recipientFirst =
    recipientName.trim().split(/\s+/)[0] || recipientName.trim();
  const applyVars = (s: string) =>
    s
      .replaceAll("<slug>", locSlug)
      .replaceAll("<token>", token)
      .replaceAll("{name}", recipientFirst);

  const overrideSubjectRaw = getString(formData, "message_subject");
  const overrideBodyRaw = getString(formData, "message_body");

  const vars = {
    name: recipientName,
    businessName: location.display_name,
    link: trackingUrl,
    unsubscribeUrl,
  };

  let messageBody: string;
  let providerId: string | null = null;
  let sendError: string | null = null;

  if (channel === "sms") {
    const defaultBody = buildSmsBody(language, vars).body;
    messageBody = overrideBodyRaw ? applyVars(overrideBodyRaw) : defaultBody;
    const r = await sendSmsViaTwilio({
      to: recipientPhone!,
      body: messageBody,
      statusCallback: `${appUrl}/api/webhooks/twilio`,
    });
    providerId = r.providerId;
    sendError = r.error;
  } else {
    const defaultEmail = buildEmail(language, vars);
    const subjectText = overrideSubjectRaw
      ? applyVars(overrideSubjectRaw)
      : defaultEmail.subject;
    const bodyText = overrideBodyRaw
      ? applyVars(overrideBodyRaw)
      : defaultEmail.body;
    messageBody = bodyText;
    const html = bodyText === defaultEmail.body ? defaultEmail.html : plainToHtml(bodyText);

    // Sender selection (per-location):
    // 1. If the location has a verified custom sender_email, send from there.
    // 2. Otherwise fall back to the shared no-reply but use the location's
    //    display name (or its sender_name override) so the inbox preview
    //    is recognizable instead of generic "No-Reply".
    let from: string | undefined;
    if (location.sender_email && location.sender_verified_at) {
      const senderName = location.sender_name || location.display_name;
      from = formatFromHeader(senderName, location.sender_email);
    } else {
      // No verified per-location sender: we're sending from the shared
      // baamplatform.com domain. Putting the bare client name in From while
      // DKIM-signing as baamplatform.com is a name/domain mismatch that
      // trips spam heuristics. "<Business> via BAAM Review" is the honest,
      // standard pattern (cf. "X via Substack") — keeps recognizability
      // without the mismatch.
      const baseName = location.sender_name || location.display_name;
      const senderName = `${baseName} via BAAM Review`;
      const defaultAddr =
        extractEmail(process.env.RESEND_FROM ?? "") || process.env.RESEND_FROM;
      if (defaultAddr) from = formatFromHeader(senderName, defaultAddr);
    }

    // Reply-To set to the sending user's address so customer can reply to a
    // real person, not no-reply@. Helps Gmail classify as personal, not bulk.
    // List-Unsubscribe + one-click (RFC 8058). Required by Gmail/Yahoo
    // bulk-sender rules; its absence is a strong spam signal for
    // solicitation mail. https URL is our /api/unsubscribe endpoint;
    // mailto is the monitored support inbox.
    const supportAddr =
      extractEmail(process.env.RESEND_FROM ?? "") ||
      process.env.RESEND_FROM ||
      "support@baamplatform.com";
    const r = await sendEmailViaResend({
      to: recipientEmail!,
      subject: subjectText,
      text: bodyText,
      html,
      replyTo: user.email ?? undefined,
      from,
      headers: {
        "List-Unsubscribe": `<mailto:${supportAddr}?subject=unsubscribe>, <${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    providerId = r.providerId;
    sendError = r.error;
    if (sendError) {
      // Resend rejects synchronously — log the exact payload (sans body
      // text) so we can diagnose address-length / header-encoding bugs
      // without having to reproduce locally.
      console.error("[send] Resend rejected single send", {
        from,
        to: recipientEmail,
        subjectLen: subjectText.length,
        replyTo: user.email ?? null,
        error: sendError,
      });
    }
  }

  if (sendError) {
    return { ok: false, error: sendError };
  }

  // Insert the request row via service client so we can populate the system
  // fields (sent_at, flagged_at) atomically regardless of RLS posture.
  const service = createServiceClient();
  const flaggedAt =
    velocity.kind === "flag" ? new Date().toISOString() : null;
  const flagReason = velocity.kind === "flag" ? velocity.reason : null;

  const now = new Date().toISOString();
  // Resend rejects malformed sends synchronously, so a successful API call
  // is a strong signal the email is on its way. Mark delivered_at optimistically
  // for email — the Resend webhook (when configured) can still confirm via
  // email.delivered or revert via email.bounced. For SMS, leave it null;
  // Twilio's delivery status comes from its callback webhook in real time.
  const optimisticDeliveredAt = channel === "email" ? now : null;

  const { data: inserted, error: insertErr } = await service
    .from("review_requests")
    .insert({
      location_id: location.id,
      recipient_name: recipientName,
      recipient_phone: channel === "sms" ? recipientPhone : null,
      recipient_email: channel === "email" ? recipientEmail : null,
      language,
      channel,
      tracking_token: token,
      message_sent: messageBody,
      sent_at: now,
      delivered_at: optimisticDeliveredAt,
      flagged_at: flaggedAt,
      flag_reason: flagReason,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Message was already sent, but we couldn't log it. Surface a soft warning;
    // the customer still receives the link. Worth alerting in production.
    console.error("Failed to insert review_request after successful send", insertErr, providerId);
    return {
      ok: true,
      flagged: false,
      trackingUrl,
      error: "Message sent, but we couldn't log it. Please notify support.",
    };
  }

  revalidatePath("/app/send");
  revalidatePath("/app");

  return {
    ok: true,
    requestId: inserted.id,
    flagged: velocity.kind === "flag",
    trackingUrl,
  };
}

function plainToHtml(text: string): string {
  // Escape HTML, linkify URLs, convert newlines to <br>. Same minimal,
  // personal-style markup as the default template so deliverability stays
  // consistent when the user edits the body.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color: #1F4D3F;">${url}</a>`,
  );
  const html = linked.replace(/\n/g, "<br>");
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1F1C; line-height: 1.55; max-width: 560px; margin: 0; padding: 16px;">
    ${html}
  </body>
</html>`;
}

function formatFromHeader(name: string, email: string): string {
  // RFC 5322: quote display name when it contains characters like commas,
  // colons, semicolons, etc. Stripping these is simplest.
  const safe = name.replace(/["<>]/g, "").trim();
  // Bound the display name so Resend's RFC 2047 encoding doesn't blow
  // past their 320-char "address length" cap. Non-ASCII chars get
  // base64-encoded and wrapped, which roughly doubles the byte count;
  // a long Chinese / Cyrillic / Arabic business name + " via BAAM
  // Review" easily exceeds the limit. Inbox previews only show ~25
  // chars anyway, so truncating loses nothing visible.
  const capped = capDisplayName(safe);
  return capped ? `${capped} <${email}>` : email;
}

function capDisplayName(name: string): string {
  if (!name) return "";
  // ASCII-only: cap at 64 chars (still well under any address limit).
  const isAscii = /^[\x00-\x7F]*$/.test(name);
  const limit = isAscii ? 64 : 32;
  if (name.length <= limit) return name;
  // Cut at a word boundary if possible so we don't truncate mid-word.
  const cut = name.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut;
}

function extractEmail(s: string): string | null {
  const m = s.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

function getString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
