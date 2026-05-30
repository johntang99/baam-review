import "server-only";
import { Resend } from "resend";
import type { AuditLanguage } from "../templating/types";
import type { StoredPdf } from "./pdf-storage";

const DEFAULT_FROM = "BAAM Review Audit <audits@reviews.baamplatform.com>";

export interface SendAuditEmailArgs {
  to: string;
  recipient_name?: string;
  business_name: string;
  audit_id: string;
  total_score: number;
  grade: string;
  pdfs: Array<StoredPdf & { pdf_buffer: Uint8Array }>;
}

export interface SendAuditEmailResult {
  sent: boolean;
  message_id?: string;
  error?: string;
}

export async function sendAuditEmail(
  args: SendAuditEmailArgs,
): Promise<SendAuditEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { sent: false, error: "RESEND_API_KEY not set" };
  }

  const from = process.env.AUDIT_RESEND_FROM ?? DEFAULT_FROM;
  const hasZh = args.pdfs.some((p) => p.language === "zh");
  const subject = hasZh
    ? `BAAM 評論審計報告 · 您的 BAAM Review Audit · ${args.business_name}`
    : `Your BAAM Review Audit · ${args.business_name}`;

  const resend = new Resend(key);

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject,
      html: renderEmailHtml(args, hasZh),
      text: renderEmailText(args, hasZh),
      attachments: args.pdfs.map((p) => ({
        filename: `BAAM-Audit-${args.audit_id}-${p.language}.pdf`,
        content: Buffer.from(p.pdf_buffer),
      })),
      tags: [
        { name: "type", value: "audit_delivery" },
        { name: "audit_id", value: args.audit_id },
        { name: "languages", value: args.pdfs.map((p) => p.language).join("+") },
      ],
    });

    if (result.error) {
      return { sent: false, error: result.error.message };
    }
    return { sent: true, message_id: result.data?.id };
  } catch (e) {
    return {
      sent: false,
      error: e instanceof Error ? e.message : "unknown send error",
    };
  }
}

function renderEmailHtml(args: SendAuditEmailArgs, bilingual: boolean): string {
  const greeting = args.recipient_name ? `Hi ${args.recipient_name},` : "Hi,";
  const greetingZh = args.recipient_name
    ? `${args.recipient_name} 您好，`
    : "您好，";

  const enBlock = `
    <p>${greeting}</p>
    <p>Your BAAM Review Audit for <strong>${escapeHtml(args.business_name)}</strong> is ready.</p>
    <p style="font-size: 28px; margin: 24px 0;"><strong>${args.total_score}</strong> · Grade <strong>${args.grade}</strong></p>
    <p>The full audit is attached as a PDF. Open it at your desk — it's designed to be read once, end-to-end.</p>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">Audit ID: ${args.audit_id}</p>
  `;

  const zhBlock = `
    <p>${greetingZh}</p>
    <p>您的 <strong>${escapeHtml(args.business_name)}</strong> BAAM 評論審計報告已準備完成。</p>
    <p style="font-size: 28px; margin: 24px 0;"><strong>${args.total_score}</strong> · 等級 <strong>${args.grade}</strong></p>
    <p>完整報告已附於電子郵件附件 (PDF)。建議您在電腦前一次讀完。</p>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">審計編號：${args.audit_id}</p>
  `;

  const body = bilingual ? `${enBlock}<hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">${zhBlock}` : enBlock;

  return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; line-height: 1.5; color: #1A1814;">${body}</body></html>`;
}

function renderEmailText(args: SendAuditEmailArgs, bilingual: boolean): string {
  const en = `Your BAAM Review Audit for ${args.business_name} is ready.\n\nScore: ${args.total_score} · Grade ${args.grade}\n\nThe full audit is attached as a PDF.\n\nAudit ID: ${args.audit_id}`;
  if (!bilingual) return en;
  const zh = `您的 ${args.business_name} BAAM 評論審計報告已準備完成。\n\n分數：${args.total_score} · 等級 ${args.grade}\n\n完整報告已附於電子郵件附件 (PDF)。\n\n審計編號：${args.audit_id}`;
  return `${en}\n\n---\n\n${zh}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
