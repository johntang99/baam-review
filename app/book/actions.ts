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

function isLang(s: string): s is "en" | "zh" {
  return s === "en" || s === "zh";
}

function preferredTimeLabel(value: string, lang: "en" | "zh"): string {
  if (value === "morning") {
    return lang === "zh"
      ? "上午 (9 点 – 12 点 美东时间)"
      : "Morning (9 am – 12 pm ET)";
  }
  if (value === "afternoon") {
    return lang === "zh"
      ? "下午 (1 – 5 点 美东时间)"
      : "Afternoon (1 – 5 pm ET)";
  }
  return value;
}

export async function submitBookingRequest(
  fd: FormData,
): Promise<BookingResult> {
  const name = field(fd, "name");
  const email = field(fd, "email");
  const phone = field(fd, "phone");
  const website = field(fd, "website");
  const business = field(fd, "business");
  const address = field(fd, "address");
  const preferredTime = field(fd, "preferred_time");
  const notes = field(fd, "notes");
  const source = field(fd, "source") || "book";
  const rawLang = field(fd, "language");
  const lang: "en" | "zh" = isLang(rawLang) ? rawLang : "en";

  if (!name) {
    return {
      ok: false,
      error: lang === "zh" ? "请填写您的姓名。" : "Please enter your name.",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      error:
        lang === "zh" ? "请输入有效的电子邮箱。" : "Please enter a valid email.",
    };
  }

  const ua = (await headers()).get("user-agent")?.slice(0, 500) ?? null;

  // Public submission → service client (bypasses RLS), same as private_feedback.
  const supabase = createServiceClient();
  const { error } = await supabase.from("booking_requests").insert({
    name,
    email,
    phone: phone || null,
    website: website || null,
    business: business || null,
    address: address || null,
    preferred_time: preferredTime || null,
    notes: notes || null,
    source,
    language: lang,
    user_agent: ua,
  });
  if (error) {
    return {
      ok: false,
      error:
        lang === "zh"
          ? "提交失败,请稍后再试。"
          : "Couldn't submit — please try again.",
    };
  }

  const prettyTime = preferredTime
    ? preferredTimeLabel(preferredTime, lang)
    : "—";

  // ───────────────────────────────────────────────────────────────────────
  // Internal sales notification — English regardless of submitter's lang,
  // since the recipient is the admin team. Reply-to is the submitter so a
  // simple "Reply" goes straight to them.
  // ───────────────────────────────────────────────────────────────────────
  try {
    const from = process.env.RESEND_FROM;
    if (from) {
      const subjectLangTag = lang === "zh" ? " (ZH)" : "";
      const lines = [
        `🟢 New consultation request${subjectLangTag} (${source})`,
        "",
        `Name:           ${name}`,
        `Email:          ${email}`,
        `Phone:          ${phone || "—"}`,
        `Business:       ${business || "—"}`,
        `Website:        ${website || "—"}`,
        `Address:        ${address || "—"}`,
        `Preferred:      ${preferredTime ? preferredTimeLabel(preferredTime, "en") : "—"}`,
        `Site language:  ${lang}`,
        "",
        "Their note:",
        notes || "—",
        "",
        "─────────────────────────────────────────",
        "Suggested reply:",
        "",
        `Hi ${name.split(/\s+/)[0] || "there"} — thanks for reaching out. I have two slots that match your ${preferredTime || "preferred"} preference: [DAY/DATE @ TIME ET] or [DAY/DATE @ TIME ET]. Just hit reply with whichever works.`,
      ];
      const text = lines.join("\n");
      await sendEmailViaResend({
        to: BOOKING_NOTIFY_EMAIL,
        subject: `🟢 Consultation request — ${name}${business ? ` · ${business}` : ""}${subjectLangTag}`,
        text,
        html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap;line-height:1.55">${escapeHtml(text)}</pre>`,
        replyTo: email,
        from,
      });
    }
  } catch {
    // swallow — the row is saved; you'll still see it in Supabase.
  }

  // ───────────────────────────────────────────────────────────────────────
  // Auto-confirmation to the requester — in their language. Reply-to goes
  // to the internal inbox so a "Reply" from the user reaches sales.
  // ───────────────────────────────────────────────────────────────────────
  try {
    const from = process.env.RESEND_FROM;
    if (from) {
      const greeting = name.split(/\s+/)[0] || (lang === "zh" ? "您" : "there");
      const { subject, body } = buildUserConfirmation({
        lang,
        greeting,
        name,
        email,
        phone,
        website,
        business,
        address,
        preferredTime: prettyTime,
        notes,
      });
      await sendEmailViaResend({
        to: email,
        subject,
        text: body.text,
        html: body.html,
        replyTo: BOOKING_NOTIFY_EMAIL,
        from,
      });
    }
  } catch {
    // swallow — confirmation is a courtesy; the request is already recorded.
  }

  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Localized user-facing confirmation email content.
// ────────────────────────────────────────────────────────────────────────────
function buildUserConfirmation(opts: {
  lang: "en" | "zh";
  greeting: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  business: string;
  address: string;
  preferredTime: string;
  notes: string;
}): { subject: string; body: { text: string; html: string } } {
  const {
    lang,
    greeting,
    phone,
    website,
    business,
    address,
    preferredTime,
    notes,
  } = opts;

  if (lang === "zh") {
    const subject = "已收到您的咨询请求 — BAAM Review";
    const lines = [
      `${greeting},您好,`,
      "",
      "感谢您联系 BAAM Review 全托管服务。我们已收到您的请求,1 个工作日内会有团队成员回复您,附上两个具体的 30 分钟通话时间供您挑选。",
      "",
      "─────────────────",
      "您提交的信息:",
      `电话:     ${phone || "—"}`,
      `店铺名称: ${business || "—"}`,
      `网站:     ${website || "—"}`,
      `店铺地址: ${address || "—"}`,
      `方便时段: ${preferredTime}`,
      ...(notes ? ["", "您的备注:", notes] : []),
      "─────────────────",
      "",
      "等待回复期间,以下两份材料您可能会感兴趣:",
      "• 我们如何携手合作:https://review.baamplatform.com/zh#partnership",
      "• 《合作方式说明》PDF:https://review.baamplatform.com/BAAM-Review-合作方式说明.pdf",
      "",
      "如有补充信息,直接回复本邮件即可。",
      "",
      "期待与您交流,",
      "— BAAM Review 团队",
    ];
    const text = lines.join("\n");
    return {
      subject,
      body: { text, html: textToHtml(text) },
    };
  }

  const subject = "We got your consultation request — BAAM Review";
  const lines = [
    `Hi ${greeting},`,
    "",
    "Thanks for reaching out about BAAM Review's Full Service plan. We got your request and someone from our team will email you within 1 business day with two specific 30-minute time slots.",
    "",
    "─────────────────",
    "What you sent us:",
    `Phone:      ${phone || "—"}`,
    `Business:   ${business || "—"}`,
    `Website:    ${website || "—"}`,
    `Address:    ${address || "—"}`,
    `Preferred:  ${preferredTime}`,
    ...(notes ? ["", "Your note:", notes] : []),
    "─────────────────",
    "",
    "While you wait, you might find these useful:",
    "• How we work together: https://review.baamplatform.com/#partnership",
    "• Download the partner guide (PDF): https://review.baamplatform.com/BAAM-Review-How-We-Work-Together.pdf",
    "",
    "Just reply to this email if anything's changed in the meantime.",
    "",
    "Talk soon,",
    "— The BAAM Review team",
  ];
  const text = lines.join("\n");
  return {
    subject,
    body: { text, html: textToHtml(text) },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;line-height:1.65;color:#1A1F1C;max-width:560px">${escapeHtml(
    text,
  ).replace(/\n/g, "<br>")}</div>`;
}
