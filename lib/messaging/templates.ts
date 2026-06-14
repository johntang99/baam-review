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
        subject: `${first}，方便分享您的體驗嗎？`,
        greeting: `${first} 您好：`,
        body: `非常感謝您選擇 ${vars.businessName}。我們由衷希望您有一次愉快的體驗；若您願意撥冗分享您的回饋，我們將非常感激。

您的一則評論對我們意義重大——它能幫助更多人認識我們，也讓我們不斷進步。當您有空時，歡迎點擊以下連結分享您的想法：`,
        closing: `衷心感謝您的時間與支持，謝謝您。`,
        sign: `誠摯問候，\n${vars.businessName} 團隊`,
        footer: "如不想再收到此類郵件，可點此退訂：",
        link: vars.link,
        businessAddress: vars.businessAddress,
        unsubscribe: vars.unsubscribeUrl
          ? { label: "退訂", url: vars.unsubscribeUrl }
          : undefined,
      });
    case "es":
      return emailHtml({
        subject: `${first}, ¿un momento para compartir su experiencia?`,
        greeting: `Estimado/a ${first}:`,
        body: `Muchas gracias por elegir ${vars.businessName}. Esperamos de verdad que haya tenido una gran experiencia con nosotros, y le agradeceríamos mucho que dedicara unos minutos a compartir su opinión.

Una breve reseña significa muchísimo: ayuda a que otras personas nos encuentren y nos permite seguir mejorando. Cuando tenga un momento, siga el enlace de abajo para compartir sus comentarios:`,
        closing: `Le agradecemos sinceramente su tiempo y su apoyo. ¡Gracias!`,
        sign: `Un cordial saludo,\nEl equipo de ${vars.businessName}`,
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
        subject: `${first}, a moment to share your experience?`,
        greeting: `Dear ${first},`,
        body: `Thank you so much for choosing ${vars.businessName}. We truly hope you had a great experience with us, and we would be very grateful if you could take a few moments to share your feedback.

A quick review means a great deal — it helps others find us and helps us keep improving. Whenever you have a moment, please follow the link below to share your thoughts:`,
        closing: `We sincerely appreciate your time and your support — thank you.`,
        sign: `Warm regards,\nThe team at ${vars.businessName}`,
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
  /** Optional line shown AFTER the link, before the sign-off. */
  closing?: string;
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

  const closing = parts.closing?.trim() || null;

  // Plain-text first. Gmail Promotions classifier strongly weights HTML-heavy
  // marketing-style emails. Keep this looking like a normal personal note.
  const text = `${parts.greeting}

${parts.body}

${parts.link}
${closing ? `\n${closing}\n` : ""}
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

  // Body may contain multiple paragraphs (blank-line separated) — render each
  // as its own <p> so HTML matches the plain-text spacing.
  const bodyHtml = parts.body
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin: 0 0 14px 0;">${escapeHtml(p.trim())}</p>`)
    .join("\n    ");

  // Minimal HTML: same content, system font, single sentence link. No
  // buttons, no card chrome, no images. Reads like a normal email.
  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1F1C; line-height: 1.55; max-width: 560px; margin: 0; padding: 16px;">
    <p style="margin: 0 0 14px 0;">${escapeHtml(parts.greeting)}</p>
    ${bodyHtml}
    <p style="margin: 0 0 14px 0;"><a href="${parts.link}" style="color: #1F4D3F;">${escapeHtml(parts.link)}</a></p>${
      closing
        ? `\n    <p style="margin: 0 0 14px 0;">${escapeHtml(closing)}</p>`
        : ""
    }
    <p style="margin: 0 0 22px 0;">${escapeHtml(parts.sign).replace(/\n/g, "<br>")}</p>${htmlFooter}
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
  zh: "如不想再收到此類郵件，可點此退訂：",
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
