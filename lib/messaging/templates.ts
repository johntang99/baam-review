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
  /** Physical postal address shown in the footer — CAN-SPAM requires a valid
   *  physical address in every commercial email. The business's own address
   *  (falls back to a company address at the call site). */
  businessAddress?: string;
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
        businessAddress: vars.businessAddress,
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
        businessAddress: vars.businessAddress,
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
        businessAddress: vars.businessAddress,
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
  businessAddress?: string;
}): EmailOutput {
  // Footer carries the CAN-SPAM essentials: the sender's physical postal
  // address + a working unsubscribe link. The unsubscribe LINE is only shown
  // when a real URL is present (the preview passes none, to avoid a dangling
  // "unsubscribe:" with no URL); at send time a URL is always supplied. The
  // address shows whenever provided.
  const addr = parts.businessAddress?.trim() || null;
  const unsubLine = parts.unsubscribe
    ? `${parts.footer} ${parts.unsubscribe.url}`
    : null;
  const textFooterLines = [addr, unsubLine].filter(Boolean);
  const textFooter =
    textFooterLines.length > 0 ? `\n\n—\n${textFooterLines.join("\n")}` : "";

  // Plain-text first. Gmail Promotions classifier strongly weights HTML-heavy
  // marketing-style emails. Keep this looking like a personal note.
  const text = `${parts.greeting}

${parts.body}

${parts.link}

${parts.sign}${textFooter}`;

  const htmlFooter =
    addr || parts.unsubscribe
      ? `
    <p style="font-size: 12px; color: #8A938E; margin: 0;">${
      addr ? `${escapeHtml(addr)}<br>` : ""
    }${
      parts.unsubscribe
        ? `${escapeHtml(parts.footer)} <a href="${parts.unsubscribe.url}" style="color: #8A938E;">${escapeHtml(parts.unsubscribe.label)}</a>`
        : ""
    }</p>`
      : "";

  // Minimal HTML: same content, system font, single sentence link. No
  // buttons, no card chrome, no images. Reads like a normal email.
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1F1C; line-height: 1.55; max-width: 560px; margin: 0; padding: 16px;">
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.greeting)}</p>
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.body)}</p>
    <p style="margin: 0 0 14px 0;"><a href="${parts.link}" style="color: #1F4D3F;">${escapeHtml(parts.link)}</a></p>
    <p style="margin: 0 0 22px 0;">${escapeHtml(parts.sign)}</p>${htmlFooter}
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
  businessAddress?: string | null,
): string {
  let out = body;

  // 1) Unsubscribe link (CAN-SPAM + bulk-sender filters). Append if missing.
  if (unsubscribeUrl && !out.includes("/api/unsubscribe?t=")) {
    const footerText =
      UNSUBSCRIBE_FOOTER_TEXT[language] ?? UNSUBSCRIBE_FOOTER_TEXT.en;
    out = `${out.trimEnd()}\n\n—\n${footerText} ${unsubscribeUrl}`;
  }

  // 2) Physical postal address (CAN-SPAM). Append if a staff edit dropped it.
  const addr = businessAddress?.trim();
  if (addr && !out.includes(addr)) {
    out = `${out.trimEnd()}\n${addr}`;
  }

  return out;
}
