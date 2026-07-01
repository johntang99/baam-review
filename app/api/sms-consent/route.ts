import { NextResponse, type NextRequest } from "next/server";
import { isIP } from "node:net";
import {
  SMS_CONSENT_DISCLOSURE_TEXT,
  SMS_CONSENT_FORM_VERSION,
  SMS_CONSENT_SOURCE_PATH,
  normalizePhoneToE164,
} from "@/lib/messaging/sms-consent";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function redirectWithStatus(
  request: NextRequest,
  status: "success" | "error",
  reason?: string,
) {
  const target = new URL(SMS_CONSENT_SOURCE_PATH, request.url);
  target.searchParams.set("status", status);
  if (reason) target.searchParams.set("reason", reason);
  return NextResponse.redirect(target, { status: 303 });
}

function readClientIp(request: NextRequest): string | null {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && isIP(cfIp)) return cfIp;

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp && isIP(xRealIp)) return xRealIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded
      .split(",")
      .map((s) => s.trim())
      .find(Boolean);
    if (first && isIP(first)) return first;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const businessName = String(formData.get("businessName") ?? "")
    .trim()
    .slice(0, 200);
  const firstName = String(formData.get("firstName") ?? "")
    .trim()
    .slice(0, 120);
  const mobileRaw = String(formData.get("mobileNumber") ?? "").trim();
  const smsConsent = formData.get("smsConsent");
  const consentChecked =
    smsConsent === "on" || smsConsent === "true" || smsConsent === "1";

  const phoneE164 = normalizePhoneToE164(mobileRaw);
  if (!phoneE164) {
    return redirectWithStatus(request, "error", "invalid_phone");
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin
  ).trim();
  const sourceUrl = `${appUrl}${SMS_CONSENT_SOURCE_PATH}`;
  const referer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent")?.slice(0, 1000) ?? null;

  const supabase = createServiceClient();
  const { error } = await supabase.from("sms_consents").insert({
    business_name: businessName || null,
    first_name: firstName || null,
    phone_e164: phoneE164,
    consent_status: consentChecked ? "opted_in" : "opted_out",
    consent_method: "web_form_checkbox_optional",
    consent_text: SMS_CONSENT_DISCLOSURE_TEXT,
    form_version: SMS_CONSENT_FORM_VERSION,
    source_url: sourceUrl,
    source_path: SMS_CONSENT_SOURCE_PATH,
    source_label: "Public Twilio proof page",
    ip_address: readClientIp(request),
    user_agent: userAgent,
    opted_out_at: consentChecked ? null : new Date().toISOString(),
    metadata: {
      referer,
      raw_phone_input: mobileRaw,
      consent_checkbox_checked: consentChecked,
      submitted_from: "app/api/sms-consent",
    },
  });

  if (error) {
    console.error("[sms-consent] insert failed", {
      message: error.message,
      code: error.code,
    });
    return redirectWithStatus(request, "error", "save_failed");
  }

  return redirectWithStatus(
    request,
    "success",
    consentChecked ? "opted_in" : "submitted_without_sms",
  );
}
