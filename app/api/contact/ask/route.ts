import { NextResponse } from "next/server";
import { sendEmailViaResend } from "@/lib/messaging/resend";

export const runtime = "nodejs";

const TEAM_INBOX = "service@baamplatform.com";

interface AskBody {
  name?: string;
  email?: string;
  subject?: string;
  question?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().slice(0, 200);
  const subjectRaw = (body.subject ?? "").trim().slice(0, 160);
  const question = (body.question ?? "").trim().slice(0, 4000);

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required." },
      { status: 400 },
    );
  }
  if (!question) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 },
    );
  }

  const subject = subjectRaw || "Question from BAAM Review marketing site";

  // Team-inbox notification — reply-to is the sender so the team can hit
  // Reply in Gmail and answer directly without copy/paste.
  const teamRes = await sendEmailViaResend({
    to: TEAM_INBOX,
    subject: `[Ask] ${subject}`,
    text: teamPlainText({ name, email, subject, question }),
    html: teamHtml({ name, email, subject, question }),
    replyTo: email,
    tags: [{ name: "source", value: "marketing_ask_question" }],
  });

  if (!teamRes.ok) {
    return NextResponse.json(
      { error: "Couldn't deliver to our team. Try again in a moment." },
      { status: 502 },
    );
  }

  // Auto-reply to the sender. Failure here is non-fatal — the team copy
  // is the source of truth, the auto-reply is a courtesy.
  await sendEmailViaResend({
    to: email,
    subject: `We got your question — BAAM Review`,
    text: autoReplyPlainText({ name, subject, question }),
    html: autoReplyHtml({ name, subject, question }),
    replyTo: TEAM_INBOX,
    tags: [{ name: "source", value: "marketing_ask_question_autoreply" }],
  });

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function teamPlainText(p: {
  name: string;
  email: string;
  subject: string;
  question: string;
}): string {
  return [
    `Name:    ${p.name}`,
    `Email:   ${p.email}`,
    `Subject: ${p.subject}`,
    "",
    "Question:",
    p.question,
  ].join("\n");
}

function teamHtml(p: {
  name: string;
  email: string;
  subject: string;
  question: string;
}): string {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1c1c;line-height:1.55;font-size:14px;">
  <p style="margin:0 0 12px;color:#888;text-transform:uppercase;letter-spacing:.1em;font-size:11px;">New question from marketing site</p>
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
    <tr><td style="color:#888;padding:2px 14px 2px 0;">Name</td><td style="font-weight:600;">${escapeHtml(p.name)}</td></tr>
    <tr><td style="color:#888;padding:2px 14px 2px 0;">Email</td><td><a href="mailto:${escapeHtml(p.email)}" style="color:#2D4A3A;">${escapeHtml(p.email)}</a></td></tr>
    <tr><td style="color:#888;padding:2px 14px 2px 0;">Subject</td><td>${escapeHtml(p.subject)}</td></tr>
  </table>
  <div style="border-left:3px solid #B48E46;padding:10px 14px;background:#FBF8F1;border-radius:4px;white-space:pre-wrap;">${escapeHtml(p.question)}</div>
  <p style="margin-top:18px;color:#888;font-size:12px;">Reply directly — Reply-To is set to the sender.</p>
</body></html>`;
}

function autoReplyPlainText(p: {
  name: string;
  subject: string;
  question: string;
}): string {
  const first = p.name.trim().split(/\s+/)[0] || p.name;
  return [
    `Hi ${first},`,
    "",
    `Thanks for reaching out — we received your question and a team member will reply within one business day.`,
    "",
    `For reference, here's what you sent:`,
    `Subject: ${p.subject}`,
    "",
    p.question,
    "",
    `— The BAAM Review team`,
    `service@baamplatform.com`,
  ].join("\n");
}

function autoReplyHtml(p: {
  name: string;
  subject: string;
  question: string;
}): string {
  const first = p.name.trim().split(/\s+/)[0] || p.name;
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1c1c;line-height:1.6;font-size:14.5px;max-width:560px;margin:0 auto;padding:24px;">
  <p style="margin:0 0 14px;">Hi ${escapeHtml(first)},</p>
  <p style="margin:0 0 14px;">Thanks for reaching out — we received your question and a team member will reply within one business day.</p>
  <p style="margin:0 0 8px;color:#888;text-transform:uppercase;letter-spacing:.1em;font-size:11px;">For your reference</p>
  <p style="margin:0 0 6px;"><strong>Subject:</strong> ${escapeHtml(p.subject)}</p>
  <div style="border-left:3px solid #B48E46;padding:10px 14px;background:#FBF8F1;border-radius:4px;white-space:pre-wrap;margin-bottom:18px;">${escapeHtml(p.question)}</div>
  <p style="margin:0;color:#555;">— The BAAM Review team<br/><a href="mailto:service@baamplatform.com" style="color:#2D4A3A;">service@baamplatform.com</a></p>
</body></html>`;
}
