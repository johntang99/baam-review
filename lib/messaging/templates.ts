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
  /** One-click unsubscribe URL. When set, the email footer shows a real
   *  opt-out link instead of "just ignore this email" (CAN-SPAM + Gmail
   *  / Yahoo bulk-sender requirements). */
  unsubscribeUrl?: string;
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
        footer: "如不想收到此类邮件，可点击下方退订。",
        link: vars.link,
        unsubscribe: vars.unsubscribeUrl
          ? { label: "退订", url: vars.unsubscribeUrl }
          : undefined,
      });
    case "es":
      return emailHtml({
        subject: `${first}, ¿tendrá un minuto?`,
        greeting: `Hola ${first},`,
        body: `Gracias por su visita a ${vars.businessName}. Si tiene un minuto, ¿podría contarnos cómo le fue? Le dejamos un enlace con algunas opciones rápidas:`,
        sign: `El equipo de ${vars.businessName}`,
        footer: "Si prefiere no recibir más, puede cancelar la suscripción:",
        link: vars.link,
        unsubscribe: vars.unsubscribeUrl
          ? { label: "Cancelar suscripción", url: vars.unsubscribeUrl }
          : undefined,
      });
    case "en":
    default:
      return emailHtml({
        subject: `${first}, do you have a minute?`,
        greeting: `Hi ${first},`,
        body: `Thanks for stopping by ${vars.businessName} today. If you have a minute, we'd love to hear how it went — there are a few quick options at this link:`,
        sign: `The team at ${vars.businessName}`,
        footer: "If you'd rather not hear from us, you can unsubscribe:",
        link: vars.link,
        unsubscribe: vars.unsubscribeUrl
          ? { label: "Unsubscribe", url: vars.unsubscribeUrl }
          : undefined,
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
  unsubscribe?: { label: string; url: string };
}): EmailOutput {
  // Only emit the footer line when there's a real unsubscribe URL to
  // attach. Otherwise the editor preview ends with "If you'd rather
  // not hear from us, you can unsubscribe:" with nothing after it,
  // which (a) confuses staff and (b) caused ensureUnsubscribeFooter()
  // to append a duplicate footer on send because it couldn't detect
  // the existing one had no URL. At send time the action always passes
  // a real URL, so the default template body always carries a working
  // footer; for the preview we just hide it.
  const footerLine = parts.unsubscribe
    ? `${parts.footer} ${parts.unsubscribe.url}`
    : null;

  // Plain-text first. Gmail Promotions classifier strongly weights HTML-heavy
  // marketing-style emails. Keep this looking like a personal note.
  const text = `${parts.greeting}

${parts.body}

${parts.link}

${parts.sign}${footerLine ? `\n\n—\n${footerLine}` : ""}`;

  // Minimal HTML: same content, system font, single sentence link. No
  // buttons, no card chrome, no images. Reads like a normal email.
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1F1C; line-height: 1.55; max-width: 560px; margin: 0; padding: 16px;">
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.greeting)}</p>
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.body)}</p>
    <p style="margin: 0 0 14px 0;"><a href="${parts.link}" style="color: #1F4D3F;">${escapeHtml(parts.link)}</a></p>
    <p style="margin: 0 0 22px 0;">${escapeHtml(parts.sign)}</p>${
      parts.unsubscribe
        ? `
    <p style="font-size: 12px; color: #8A938E; margin: 0;">${escapeHtml(parts.footer)} <a href="${parts.unsubscribe.url}" style="color: #8A938E;">${escapeHtml(parts.unsubscribe.label)}</a></p>`
        : ""
    }
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

/**
 * Localized unsubscribe footer text — the line that precedes the URL.
 * Mirrors the per-language footers used by `buildEmail()` so an
 * auto-appended footer reads identically to the default template.
 */
const UNSUBSCRIBE_FOOTER_TEXT: Record<Language, string> = {
  en: "If you'd rather not hear from us, you can unsubscribe:",
  zh: "如不想收到此类邮件，可点击下方退订：",
  es: "Si prefiere no recibir más, puede cancelar la suscripción:",
};

/**
 * Guarantee the email body carries a working unsubscribe link, regardless
 * of how heavily the sender edited the default template.
 *
 * The default body returned by `buildEmail()` already includes the
 * unsubscribe URL. But on the Send page the user can rewrite the body
 * arbitrarily — including deleting the footer or starting from scratch.
 * Sending a review-request email without a one-click unsubscribe breaks
 * CAN-SPAM and trips Gmail / Yahoo bulk-sender filters; it also
 * eliminates the one mechanism the recipient has to opt out (which
 * cascades into us not respecting their opt-out on subsequent sends,
 * since `opt_outs` is keyed off the click on the unsubscribe URL).
 *
 * So: if the supplied body does not already contain
 * `/api/unsubscribe?t=`, append the localized footer + URL on a fresh
 * pair of lines. The check is broad-substring intentionally — any
 * unsubscribe URL is considered enough, so we don't double-append when
 * the user kept the default footer or pasted in their own.
 *
 * Returns the body unchanged when:
 *  - it already contains an `/api/unsubscribe?t=` URL, OR
 *  - no `unsubscribeUrl` is provided (e.g., SMS flow uses Reply STOP).
 */
export function ensureUnsubscribeFooter(
  body: string,
  unsubscribeUrl: string | null | undefined,
  language: Language,
): string {
  if (!unsubscribeUrl) return body;
  if (body.includes("/api/unsubscribe?t=")) return body;

  const footerText =
    UNSUBSCRIBE_FOOTER_TEXT[language] ?? UNSUBSCRIBE_FOOTER_TEXT.en;
  // Two newlines + em dash + footer line mirrors the visual rhythm
  // buildEmail() uses for the default template footer.
  return `${body.trimEnd()}\n\n—\n${footerText} ${unsubscribeUrl}`;
}
