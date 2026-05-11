import type { Language } from "@/lib/i18n/review";

/**
 * Message templates per channel × language.
 *
 * SMS includes TCPA-required opt-out copy. We don't allow owners to customize
 * the SMS body in v1 because that's where the opt-out language must appear —
 * if customers could omit it, we'd be facilitating a TCPA violation.
 *
 * Email subject + body are localized similarly. The link variable is the
 * fully-qualified URL to /r/<slug>?t=<token>.
 */

export interface TemplateVars {
  name: string;
  businessName: string;
  link: string;
}

interface MessageOutput {
  body: string;
}

interface EmailOutput {
  subject: string;
  body: string; // plain-text
  html: string; // simple HTML wrapper
}

export function buildSmsBody(lang: Language, vars: TemplateVars): MessageOutput {
  const first = vars.name.split(" ")[0];

  switch (lang) {
    case "zh":
      return {
        body: `您好 ${first}，感谢您光临${vars.businessName}。能否花一分钟分享您的体验？${vars.link}\n回复 STOP 取消订阅。`,
      };
    case "es":
      return {
        body: `Hola ${first}, gracias por visitar ${vars.businessName}. ¿Podría compartir su experiencia en un minuto? ${vars.link}\nResponda STOP para cancelar.`,
      };
    case "en":
    default:
      return {
        body: `Hi ${first}, thanks for visiting ${vars.businessName}. Mind sharing your experience? It only takes a minute: ${vars.link}\nReply STOP to opt out.`,
      };
  }
}

export function buildEmail(lang: Language, vars: TemplateVars): EmailOutput {
  const first = vars.name.split(" ")[0];

  switch (lang) {
    case "zh":
      return emailHtml({
        subject: `${vars.businessName}：邀您分享体验`,
        greeting: `您好 ${first}，`,
        body: `感谢您光临${vars.businessName}。能否花一分钟分享您的体验？我们准备好了几个快速选项，30 秒即可完成。`,
        cta: "撰写评价",
        footer:
          "您之所以收到此邮件，是因为最近光临了我们。如不希望再收到此类邮件，请忽略本邮件。",
        link: vars.link,
      });
    case "es":
      return emailHtml({
        subject: `${vars.businessName}: comparta su experiencia`,
        greeting: `Hola ${first},`,
        body: `Gracias por visitar ${vars.businessName}. ¿Le importaría compartir su experiencia? Le hemos preparado unas opciones rápidas, sólo 30 segundos.`,
        cta: "Escribir reseña",
        footer:
          "Recibe este correo porque visitó recientemente. Si no desea recibir más, simplemente ignórelo.",
        link: vars.link,
      });
    case "en":
    default:
      return emailHtml({
        subject: `${vars.businessName}: a quick favor`,
        greeting: `Hi ${first},`,
        body: `Thanks for visiting ${vars.businessName}. Would you mind sharing your experience? We've set up a few quick options — about 30 seconds.`,
        cta: "Write a review",
        footer:
          "You're getting this because you visited recently. If you'd rather not, just ignore this email.",
        link: vars.link,
      });
  }
}

function emailHtml(parts: {
  subject: string;
  greeting: string;
  body: string;
  cta: string;
  footer: string;
  link: string;
}): EmailOutput {
  const text = `${parts.greeting}

${parts.body}

${parts.cta}: ${parts.link}

${parts.footer}`;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background: #FAF7F2; padding: 24px; color: #1A1F1C;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #E8E2D5; border-radius: 16px; padding: 28px;">
      <p style="font-size: 15px; margin: 0 0 12px 0;">${escapeHtml(parts.greeting)}</p>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 22px 0;">${escapeHtml(parts.body)}</p>
      <p style="margin: 0 0 22px 0;">
        <a href="${parts.link}" style="display: inline-block; background: #1F4D3F; color: #FAF7F2; text-decoration: none; padding: 11px 18px; border-radius: 10px; font-size: 14px; font-weight: 500;">${escapeHtml(parts.cta)}</a>
      </p>
      <p style="font-size: 12px; color: #8A938E; line-height: 1.5; margin: 0;">${escapeHtml(parts.footer)}</p>
    </div>
  </body>
</html>`;

  return { subject: parts.subject, body: text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
