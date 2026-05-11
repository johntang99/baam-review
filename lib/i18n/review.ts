// Tiny typed translations for the public review page.
// Keep keys flat. If this grows past ~80 entries we'll move to a real i18n lib.

export const SUPPORTED_LANGUAGES = ["en", "zh", "es"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isLanguage(s: string | null | undefined): s is Language {
  return !!s && (SUPPORTED_LANGUAGES as readonly string[]).includes(s);
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

export const STRINGS = {
  en: {
    welcome_default: "Thanks for visiting. How was your experience?",
    language_picker_label: "Language",

    // Step labels
    step_service: "Service you received",
    step_rating: "Your rating",
    step_descriptor: "In one word",

    // Helpers
    optional: "Optional",
    other_chip: "Other",
    other_placeholder: "Type your own…",
    rating_helper: "Tap to rate",

    // CTAs
    cta_continue: "Continue",
    cta_google: "Leave a Google review",
    cta_yelp: "Leave a Yelp review",
    cta_back: "Back",
    cta_generate: "Help me write a review",
    cta_generating: "Writing drafts…",
    cta_post: "Looks good — post to Google",
    cta_regenerate: "Generate different drafts",
    cta_edit: "Edit",
    cta_edit_save: "Save",
    cta_edit_cancel: "Cancel",
    cta_change_inputs: "Change my answers",

    // Draft picker
    drafts_heading: "Pick the one that fits best",
    drafts_subtitle: "Tap a draft, then edit if you want.",
    drafts_helper: "We'll copy it to your clipboard before opening Google.",
    drafts_tone_warm: "Warm",
    drafts_tone_specific: "Specific",
    drafts_tone_brief: "Brief",
    drafts_summary_rating: "{n}-star",
    drafts_failed: "We couldn't generate drafts right now. You can still post on Google without one.",
    drafts_skip: "Skip and go straight to Google",
    drafts_copied: "Copied to clipboard",
    drafts_copy_failed: "Tap to copy",

    // Private feedback
    private_link: "Or share privately with us",
    private_title: "Send a private message",
    private_subtitle:
      "Tell us about your experience. This goes directly to the business — it won’t be posted publicly.",
    private_rating: "Rating (optional)",
    private_message: "Your message",
    private_message_placeholder: "What would you like us to know?",
    private_email: "Email (optional)",
    private_phone: "Phone (optional)",
    private_submit: "Send",
    private_submitting: "Sending…",

    // Thank you
    thanks_title: "Thank you.",
    thanks_google: "Your review helps other people find us.",
    thanks_private: "We received your message and will reach out if you left a way to contact you.",

    // WeChat
    wechat_title: "Open this page in your browser to leave a Google review",
    wechat_body:
      "WeChat blocks Google sign-in. Tap the ⋯ menu in the top right and choose “Open in browser”, then return to this page.",

    // Disclosure
    ai_disclosure:
      "This draft is generated from your inputs to help you get started. Please edit it to make it your own.",

    // Errors
    error_message_required: "Please write a short message.",
    error_generic: "Something went wrong. Please try again.",

    // Default service chips for fallback business_type
    default_service_chips: ["Visit", "Service", "Consultation", "Treatment"],
    default_descriptor_chips: [
      "Professional",
      "Warm",
      "Knowledgeable",
      "Friendly",
      "Skilled",
      "Patient",
      "Caring",
      "Thorough",
    ],
  },
  zh: {
    welcome_default: "感谢您的光临。您的体验如何？",
    language_picker_label: "语言",

    step_service: "您接受的服务",
    step_rating: "您的评分",
    step_descriptor: "用一个词形容",

    optional: "可选",
    other_chip: "其他",
    other_placeholder: "输入其他内容…",
    rating_helper: "点击评分",

    cta_continue: "继续",
    cta_google: "在 Google 上留下评价",
    cta_yelp: "在 Yelp 上留下评价",
    cta_back: "返回",
    cta_generate: "帮我写一段评论",
    cta_generating: "正在生成草稿…",
    cta_post: "就用这条—去 Google 发布",
    cta_regenerate: "再生成几条不同的草稿",
    cta_edit: "编辑",
    cta_edit_save: "保存",
    cta_edit_cancel: "取消",
    cta_change_inputs: "更改我的回答",

    drafts_heading: "选一条最合适的",
    drafts_subtitle: "点击一条草稿，然后可以编辑。",
    drafts_helper: "我们会先将文字复制到剪贴板，然后跳转到 Google。",
    drafts_tone_warm: "温暖",
    drafts_tone_specific: "具体",
    drafts_tone_brief: "简短",
    drafts_summary_rating: "{n} 星",
    drafts_failed: "暂时无法生成草稿，您仍可以直接前往 Google 评价。",
    drafts_skip: "跳过，直接去 Google",
    drafts_copied: "已复制到剪贴板",
    drafts_copy_failed: "点击复制",

    private_link: "或私下告诉我们",
    private_title: "发送私信",
    private_subtitle:
      "告诉我们您的体验。这条消息会直接发给商家，不会公开发布。",
    private_rating: "评分（可选）",
    private_message: "您的留言",
    private_message_placeholder: "您想告诉我们什么？",
    private_email: "电子邮箱（可选）",
    private_phone: "电话（可选）",
    private_submit: "发送",
    private_submitting: "正在发送…",

    thanks_title: "谢谢您。",
    thanks_google: "您的评价能帮助更多人找到我们。",
    thanks_private: "我们已收到您的消息。如您留下联系方式，我们将与您联系。",

    wechat_title: "请在浏览器中打开此页面以留 Google 评价",
    wechat_body:
      "微信会拦截 Google 登录。请点击右上角 ⋯ 菜单，选择「在浏览器中打开」，然后返回此页面。",

    ai_disclosure:
      "此草稿是根据您的输入生成，仅供参考。请按需修改成您自己的话。",

    error_message_required: "请输入一条简短的留言。",
    error_generic: "出错了，请稍后再试。",

    default_service_chips: ["到访", "服务", "咨询", "治疗"],
    default_descriptor_chips: [
      "专业",
      "热情",
      "有经验",
      "亲切",
      "技术好",
      "耐心",
      "细致",
      "周到",
    ],
  },
  es: {
    welcome_default: "Gracias por su visita. ¿Cómo fue su experiencia?",
    language_picker_label: "Idioma",

    step_service: "Servicio recibido",
    step_rating: "Su calificación",
    step_descriptor: "En una palabra",

    optional: "Opcional",
    other_chip: "Otro",
    other_placeholder: "Escriba el suyo…",
    rating_helper: "Toque para calificar",

    cta_continue: "Continuar",
    cta_google: "Deje una reseña en Google",
    cta_yelp: "Deje una reseña en Yelp",
    cta_back: "Atrás",
    cta_generate: "Ayúdeme a escribir una reseña",
    cta_generating: "Generando borradores…",
    cta_post: "Perfecto — publicar en Google",
    cta_regenerate: "Generar otros borradores",
    cta_edit: "Editar",
    cta_edit_save: "Guardar",
    cta_edit_cancel: "Cancelar",
    cta_change_inputs: "Cambiar mis respuestas",

    drafts_heading: "Elija el que mejor le quede",
    drafts_subtitle: "Toque un borrador y edítelo si quiere.",
    drafts_helper: "Lo copiaremos al portapapeles antes de abrir Google.",
    drafts_tone_warm: "Cálido",
    drafts_tone_specific: "Específico",
    drafts_tone_brief: "Breve",
    drafts_summary_rating: "{n} estrellas",
    drafts_failed: "No pudimos generar borradores ahora. Aún puede publicar directamente en Google.",
    drafts_skip: "Saltar e ir a Google",
    drafts_copied: "Copiado al portapapeles",
    drafts_copy_failed: "Toque para copiar",

    private_link: "O envíenos un mensaje privado",
    private_title: "Enviar un mensaje privado",
    private_subtitle:
      "Cuéntenos sobre su experiencia. Va directamente al negocio — no se publicará públicamente.",
    private_rating: "Calificación (opcional)",
    private_message: "Su mensaje",
    private_message_placeholder: "¿Qué quisiera contarnos?",
    private_email: "Correo electrónico (opcional)",
    private_phone: "Teléfono (opcional)",
    private_submit: "Enviar",
    private_submitting: "Enviando…",

    thanks_title: "Gracias.",
    thanks_google: "Su reseña ayuda a otras personas a encontrarnos.",
    thanks_private:
      "Recibimos su mensaje. Le contactaremos si nos dejó una forma de comunicarnos.",

    wechat_title: "Abra esta página en su navegador para dejar una reseña en Google",
    wechat_body:
      "WeChat bloquea el inicio de sesión de Google. Toque el menú ⋯ en la esquina superior derecha y elija «Abrir en navegador», luego vuelva a esta página.",

    ai_disclosure:
      "Este borrador se genera a partir de sus respuestas para ayudarle a empezar. Por favor edítelo para hacerlo suyo.",

    error_message_required: "Por favor escriba un mensaje corto.",
    error_generic: "Algo salió mal. Inténtelo de nuevo.",

    default_service_chips: ["Visita", "Servicio", "Consulta", "Tratamiento"],
    default_descriptor_chips: [
      "Profesional",
      "Cálido",
      "Experto",
      "Amable",
      "Hábil",
      "Paciente",
      "Atento",
      "Minucioso",
    ],
  },
} as const satisfies Record<Language, Record<string, string | readonly string[]>>;

export type StringsForLang = (typeof STRINGS)[Language];

export function pickLanguage(opts: {
  request?: { language?: string | null } | null;
  acceptLanguage?: string | null;
  supported: readonly string[];
  fallback: string;
}): Language {
  const candidates: (string | null | undefined)[] = [
    opts.request?.language,
    ...parseAcceptLanguage(opts.acceptLanguage),
    opts.fallback,
  ];

  for (const c of candidates) {
    if (!c) continue;
    const normalized = c.toLowerCase().slice(0, 2);
    if (
      isLanguage(normalized) &&
      opts.supported.includes(normalized)
    ) {
      return normalized;
    }
  }

  // Final fallback: first supported, else en
  const first = opts.supported[0];
  return isLanguage(first) ? first : "en";
}

function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((s) => s.trim().split(";")[0].trim())
    .filter(Boolean);
}
