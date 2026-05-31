import "server-only";
import { Resend } from "resend";
import type { StoredPdf } from "./pdf-storage";

const DEFAULT_FROM = "BAAM Review Audit <audits@reviews.baamplatform.com>";
const SERVICE_URL = "https://baamreview.com";

export interface SendAuditEmailArgs {
  to: string;
  recipient_name?: string;
  business_name: string;
  audit_id: string;
  total_score: number;
  grade: string;
  grade_diagnosis?: string;
  dashboard_url: string;
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
    ? `BAAM Review Audit · ${args.business_name} · 您的審計報告已準備就緒`
    : `Your BAAM Review Audit for ${args.business_name} is ready`;

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
  const greetingEn = args.recipient_name ? `Hi ${escapeHtml(args.recipient_name)},` : "Hi,";
  const greetingZh = args.recipient_name
    ? `${escapeHtml(args.recipient_name)} 您好，`
    : "您好，";

  const styles = {
    body: "font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; line-height: 1.55; color: #1A1814; background: #FDFBF6;",
    headerEyebrow: "font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: #6B6259; font-weight: 600;",
    headerSub: "font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #6B6259; margin-top: 4px;",
    scoreBlock: "background: #FFFFFF; border: 1px solid #D2C9B2; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;",
    scoreNum: "font-family: Georgia, serif; font-size: 56px; line-height: 1; color: #1A1814; margin: 0;",
    grade: "font-family: Georgia, serif; font-size: 18px; color: #4F5A55; margin-top: 8px;",
    diagnosis: "font-family: Georgia, serif; font-style: italic; font-size: 15px; color: #2C3530; margin-top: 12px;",
    upsellBlock: "background: #FFFFFF; border-left: 3px solid #1F4D3F; padding: 20px 24px; margin: 28px 0; border-radius: 0 8px 8px 0;",
    upsellLabel: "font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #4F7253; font-weight: 600;",
    upsellHeadline: "font-family: Georgia, serif; font-size: 20px; color: #1A1814; margin: 8px 0 14px;",
    upsellRow: "display: block; margin: 12px 0; color: #2C3530; font-size: 14px;",
    ctaRow: "margin-top: 18px;",
    ctaBtn: "display: inline-block; padding: 10px 18px; background: #1F4D3F; color: #FDFBF6; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500; margin-right: 8px;",
    ctaBtnSecondary: "display: inline-block; padding: 10px 18px; background: #FFFFFF; color: #1F4D3F; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid #1F4D3F;",
    dashboardLink: "color: #1F4D3F; text-decoration: underline;",
    footer: "color: #6B6259; font-size: 12px; margin-top: 32px; padding-top: 18px; border-top: 1px solid #D2C9B2;",
  };

  const enBlock = `
    <div style="${styles.headerEyebrow}">BAAM · REVIEW AUDIT</div>
    <div style="${styles.headerSub}">Reputation & revenue diagnostic</div>

    <p style="margin-top: 24px;">${greetingEn}</p>
    <p>Your audit for <strong>${escapeHtml(args.business_name)}</strong> is complete.</p>

    <div style="${styles.scoreBlock}">
      <div style="${styles.scoreNum}">${args.total_score}</div>
      <div style="${styles.grade}">Grade · Tier ${escapeHtml(args.grade)}</div>
      ${args.grade_diagnosis ? `<div style="${styles.diagnosis}">"${escapeHtml(args.grade_diagnosis)}"</div>` : ""}
    </div>

    <p>The full 7-page audit is attached as a PDF. It identifies <strong>5 specific actions</strong> to take in the next 12 months.</p>

    <div style="${styles.upsellBlock}">
      <div style="${styles.upsellLabel}">BAAM Review · Service</div>
      <div style="${styles.upsellHeadline}">If you'd like help executing the action plan…</div>
      <span style="${styles.upsellRow}"><strong>Self-Serve</strong> · $99/mo · single location · 30-day free trial</span>
      <span style="${styles.upsellRow}"><strong>Full Service</strong> · $399/mo · we run it · 5× value promise</span>
      <div style="${styles.ctaRow}">
        <a href="${SERVICE_URL}" style="${styles.ctaBtn}">Learn more →</a>
      </div>
    </div>

    <p>You can also view your audit anytime at <a href="${escapeHtml(args.dashboard_url)}" style="${styles.dashboardLink}">your dashboard</a>.</p>

    <div style="${styles.footer}">
      Audit ID: <span style="font-family: 'JetBrains Mono', monospace;">${escapeHtml(args.audit_id)}</span><br>
      — BAAM Studio
    </div>
  `;

  const zhBlock = `
    <div style="${styles.headerEyebrow}">BAAM · 評論審計</div>
    <div style="${styles.headerSub}">聲譽與營收診斷報告</div>

    <p style="margin-top: 24px;">${greetingZh}</p>
    <p>您的 <strong>${escapeHtml(args.business_name)}</strong> BAAM 評論審計報告已完成。</p>

    <div style="${styles.scoreBlock}">
      <div style="${styles.scoreNum}">${args.total_score}</div>
      <div style="${styles.grade}">等級 · ${escapeHtml(args.grade)} 級</div>
      ${args.grade_diagnosis ? `<div style="${styles.diagnosis}">「${escapeHtml(args.grade_diagnosis)}」</div>` : ""}
    </div>

    <p>完整的 7 頁審計報告已附於電子郵件附件。報告中列出未來 12 個月應採取的 <strong>5 項具體行動</strong>。</p>

    <div style="${styles.upsellBlock}">
      <div style="${styles.upsellLabel}">BAAM Review · 服務</div>
      <div style="${styles.upsellHeadline}">若您想找人代為執行行動計劃…</div>
      <span style="${styles.upsellRow}"><strong>自助方案</strong> · 每月 $99 · 單店 · 30 天免費試用</span>
      <span style="${styles.upsellRow}"><strong>全託管方案</strong> · 每月 $399 · 由我們執行 · 5 倍價值承諾</span>
      <div style="${styles.ctaRow}">
        <a href="${SERVICE_URL}" style="${styles.ctaBtn}">了解更多 →</a>
      </div>
    </div>

    <p>您隨時可在 <a href="${escapeHtml(args.dashboard_url)}" style="${styles.dashboardLink}">儀表板</a> 查看您的審計。</p>

    <div style="${styles.footer}">
      審計編號：<span style="font-family: 'JetBrains Mono', monospace;">${escapeHtml(args.audit_id)}</span><br>
      — BAAM Studio
    </div>
  `;

  const body = bilingual
    ? `${enBlock}<hr style="border: none; border-top: 1px solid #D2C9B2; margin: 40px 0;">${zhBlock}`
    : enBlock;

  return `<!DOCTYPE html>
<html><body style="${styles.body}">${body}</body></html>`;
}

function renderEmailText(args: SendAuditEmailArgs, bilingual: boolean): string {
  const enBlock = [
    "BAAM · Review Audit",
    "Reputation & revenue diagnostic",
    "",
    args.recipient_name ? `Hi ${args.recipient_name},` : "Hi,",
    "",
    `Your audit for ${args.business_name} is complete.`,
    "",
    `  Score: ${args.total_score}`,
    `  Grade: Tier ${args.grade}`,
    args.grade_diagnosis ? `  Diagnosis: "${args.grade_diagnosis}"` : "",
    "",
    "The full 7-page audit is attached as a PDF. It identifies 5 specific actions to take in the next 12 months.",
    "",
    "If you'd like help executing the action plan:",
    "  · BAAM Review Self-Serve · $99/mo · single location",
    "  · BAAM Review Full Service · $399/mo · we run it · 5× value promise",
    `  Learn more: ${SERVICE_URL}`,
    "",
    `View your audit anytime: ${args.dashboard_url}`,
    "",
    `Audit ID: ${args.audit_id}`,
    "— BAAM Studio",
  ]
    .filter(Boolean)
    .join("\n");

  if (!bilingual) return enBlock;

  const zhBlock = [
    "",
    "---",
    "",
    "BAAM · 評論審計",
    "聲譽與營收診斷報告",
    "",
    args.recipient_name ? `${args.recipient_name} 您好，` : "您好，",
    "",
    `您的 ${args.business_name} BAAM 評論審計報告已完成。`,
    "",
    `  分數：${args.total_score}`,
    `  等級：${args.grade} 級`,
    args.grade_diagnosis ? `  診斷：「${args.grade_diagnosis}」` : "",
    "",
    "完整的 7 頁審計報告已附於電子郵件附件。",
    "",
    "若您想找人代為執行行動計劃：",
    "  · BAAM Review 自助方案 · 每月 $99 · 單店",
    "  · BAAM Review 全託管方案 · 每月 $399 · 由我們執行 · 5 倍價值承諾",
    `  了解更多：${SERVICE_URL}`,
    "",
    `儀表板：${args.dashboard_url}`,
    "",
    `審計編號：${args.audit_id}`,
    "— BAAM Studio",
  ]
    .filter(Boolean)
    .join("\n");

  return `${enBlock}${zhBlock}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
