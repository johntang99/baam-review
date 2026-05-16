"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmailViaResend } from "@/lib/messaging/resend";

// Internal-test notification target. Change here (or swap to an env var)
// when this moves past internal testing.
const BOOKING_NOTIFY_EMAIL = "baamplatform@gmail.com";

export interface BookingResult {
  ok: boolean;
  error?: string;
}

function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitBookingRequest(
  fd: FormData,
): Promise<BookingResult> {
  const name = field(fd, "name");
  const email = field(fd, "email");
  const business = field(fd, "business");
  const preferredTime = field(fd, "preferred_time");
  const notes = field(fd, "notes");
  const source = field(fd, "source") || "book";

  if (!name) return { ok: false, error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email." };
  }

  const ua = (await headers()).get("user-agent")?.slice(0, 500) ?? null;

  // Public submission → service client (bypasses RLS), same as private_feedback.
  const supabase = createServiceClient();
  const { error } = await supabase.from("booking_requests").insert({
    name,
    email,
    business: business || null,
    preferred_time: preferredTime || null,
    notes: notes || null,
    source,
    user_agent: ua,
  });
  if (error) {
    return { ok: false, error: "Couldn't submit — please try again." };
  }

  // Best-effort notification. A failed email must not lose the stored lead.
  try {
    const from = process.env.RESEND_FROM;
    if (from) {
      const lines = [
        `New booking-call request (${source})`,
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Business: ${business || "—"}`,
        `Preferred time: ${preferredTime || "—"}`,
        "",
        "Notes:",
        notes || "—",
      ];
      const text = lines.join("\n");
      await sendEmailViaResend({
        to: BOOKING_NOTIFY_EMAIL,
        subject: `Intro call request — ${name}${business ? ` (${business})` : ""}`,
        text,
        html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>`,
        replyTo: email,
        from,
      });
    }
  } catch {
    // swallow — the row is saved; you'll still see it in Supabase.
  }

  // Best-effort confirmation to the requester. Independent try/catch so a
  // failure here never affects the saved row or the team notification.
  try {
    const from = process.env.RESEND_FROM;
    if (from) {
      const greeting = name.split(/\s+/)[0] || "there";
      const text = [
        `Hi ${greeting},`,
        "",
        "Thanks for requesting a 15-minute intro call with BAAM Review — we've got it.",
        "We'll email you shortly to lock in a time" +
          (preferredTime ? ` around your preferred window (${preferredTime})` : "") +
          ". Usually within one business day.",
        "",
        "Just reply to this email if anything changes.",
        "",
        "— The BAAM Review team",
      ].join("\n");
      await sendEmailViaResend({
        to: email,
        subject: "Thanks — we'll be in touch to schedule your call",
        text,
        html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#1A1F1C">${text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")}</div>`,
        replyTo: BOOKING_NOTIFY_EMAIL,
        from,
      });
    }
  } catch {
    // swallow — confirmation is a courtesy; the request is already recorded.
  }

  return { ok: true };
}
