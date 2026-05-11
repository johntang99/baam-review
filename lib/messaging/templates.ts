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
        subject: `${first}，能耽误您一分钟吗？`,
        greeting: `${first}，您好：`,
        body: `感谢您今天来到${vars.businessName}。如果方便，能花一分钟跟我们说说您的体验吗？以下链接里有几个快速选项：`,
        sign: `${vars.businessName} 团队`,
        footer: "如不想收到此类邮件，可直接忽略。",
        link: vars.link,
      });
    case "es":
      return emailHtml({
        subject: `${first}, ¿tendrá un minuto?`,
        greeting: `Hola ${first},`,
        body: `Gracias por su visita a ${vars.businessName}. Si tiene un minuto, ¿podría contarnos cómo le fue? Le dejamos un enlace con algunas opciones rápidas:`,
        sign: `El equipo de ${vars.businessName}`,
        footer: "Si prefiere no recibir más, simplemente ignore este mensaje.",
        link: vars.link,
      });
    case "en":
    default:
      return emailHtml({
        subject: `${first}, do you have a minute?`,
        greeting: `Hi ${first},`,
        body: `Thanks for stopping by ${vars.businessName} today. If you have a minute, we'd love to hear how it went — there are a few quick options at this link:`,
        sign: `The team at ${vars.businessName}`,
        footer: "If you'd rather not, just ignore this email — no worries.",
        link: vars.link,
      });
  }
}

function emailHtml(parts: {
  subject: string;
  greeting: string;
  body: string;
  sign: string;
  footer: string;
  link: string;
}): EmailOutput {
  // Plain-text first. Gmail Promotions classifier strongly weights HTML-heavy
  // marketing-style emails. Keep this looking like a personal note.
  const text = `${parts.greeting}

${parts.body}

${parts.link}

${parts.sign}

—
${parts.footer}`;

  // Minimal HTML: same content, system font, single sentence link. No
  // buttons, no card chrome, no images. Reads like a normal email.
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1F1C; line-height: 1.55; max-width: 560px; margin: 0; padding: 16px;">
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.greeting)}</p>
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.body)}</p>
    <p style="margin: 0 0 14px 0;"><a href="${parts.link}" style="color: #1F4D3F;">${escapeHtml(parts.link)}</a></p>
    <p style="margin: 0 0 22px 0;">${escapeHtml(parts.sign)}</p>
    <p style="font-size: 12px; color: #8A938E; margin: 0;">${escapeHtml(parts.footer)}</p>
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
