import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export interface ReplyInputs {
  /** The reviewer's display name as shown on Google. Not used in output. */
  reviewerName: string | null;
  /** 1-5 star rating. */
  rating: number;
  /** Their review text (may be empty if they only left stars). */
  comment: string | null;
  /** Language to write the reply in (auto-detected from the review). */
  language: string;
}

export interface ReplyLocation {
  display_name: string;
  business_type: string | null;
}

function stripAutoTranslatedSuffix(comment: string): string {
  const marker = /\(\s*translated by google\s*\)/i;
  const idx = comment.search(marker);
  if (idx === -1) return comment.trim();
  const original = comment.slice(0, idx).trim();
  return original.length > 0 ? original : comment.trim();
}

/**
 * Detect the predominant language of the review comment so the reply
 * matches. Conservative — defaults to English when uncertain.
 */
export function detectReviewLanguage(comment: string | null): "en" | "zh" | "es" {
  if (!comment) return "en";
  const trimmed = stripAutoTranslatedSuffix(comment);
  // Heuristic: script-aware counts (ignore punctuation/spacing noise).
  const hanCount = (trimmed.match(/\p{Script=Han}/gu) ?? []).length;
  const latinCount = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  if (hanCount >= 2 && hanCount >= latinCount * 0.25) return "zh";
  // Heuristic: count Spanish-specific characters (ñ, ¿, ¡) or common words.
  const esIndicators = /[ñ¿¡]|\b(que|para|gracias|excelente|servicio|recomiendo|muy bueno|gracias por)\b/i;
  if (esIndicators.test(trimmed)) return "es";
  return "en";
}

const LANG_NAME: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese (简体中文)",
  es: "Spanish (Español)",
};

function buildSystemPrompt(loc: ReplyLocation, language: string): string {
  const langName = LANG_NAME[language] ?? "English";
  const businessType = loc.business_type ?? "local business";

  return [
    `You are drafting an owner's reply to a Google review of ${loc.display_name}, a ${businessType}.`,
    "",
    `Output language: ${langName}. The reply must be entirely in ${langName}.`,
    "",
    "Rules:",
    "- 30–80 words. Concise; owners are busy and customers skim.",
    "- First person, plural ('we', 'our team'). Warm but professional, not corporate.",
    "- NEVER use the reviewer's name, nickname, handle, or any translated name (Google profile names are often inaccurate).",
    "- Address the reviewer only with second-person wording (for example: 'you' in English, '您' in Chinese).",
    "- Reference one specific thing from their review where possible.",
    "- For 4–5★ reviews: gracious thanks, mention you'd welcome them back.",
    "- For 3★ reviews: acknowledge the feedback, briefly say what you'd do differently.",
    "- For 1–2★ reviews: apologize, take ownership, propose an offline conversation (email or phone) without revealing private details — phrase like 'please reach out so we can make it right'. Never argue, never defend.",
    "- NEVER admit specific wrongdoing or fault publicly (legal exposure).",
    "- NEVER promise refunds, compensation, or specific outcomes in a public reply.",
    "- NEVER mention BAAM Review, AI, or that the reply was generated.",
    "- NO emojis, hashtags, or excessive punctuation.",
    "",
    "Return only the reply text, no preamble, no quotation marks, no signature line. The platform appends 'Reply from owner' automatically.",
  ].join("\n");
}

function buildUserMessage(inputs: ReplyInputs): string {
  const normalizedComment = stripAutoTranslatedSuffix(inputs.comment ?? "");
  const lines = [
    `Reply language code (strict): ${inputs.language}`,
    `Rating: ${inputs.rating}/5`,
    `Review:`,
    normalizedComment || "(reviewer left only stars, no text)",
  ];
  return lines.join("\n");
}

const client = new Anthropic();

function isLikelyLanguage(text: string, language: string): boolean {
  const hanCount = (text.match(/\p{Script=Han}/gu) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  if (language === "zh") return hanCount >= 2;
  if (language === "es")
    return /[ñ¿¡áéíóúü]|\b(que|para|gracias|excelente|servicio|recomiendo|muy|usted|ustedes|equipo)\b/i.test(
      text,
    );
  // English default: mostly latin and not Han.
  return latinCount >= 10 && hanCount === 0;
}

async function rewriteToLanguage(
  draft: string,
  language: string,
  model?: string,
): Promise<string> {
  const langName = LANG_NAME[language] ?? "English";
  const response = await client.messages.create({
    model: model ?? DEFAULT_MODEL,
    max_tokens: 400,
    temperature: 0.2,
    system: [
      {
        type: "text",
        text: `Rewrite the provided Google review response in ${langName}. Output only rewritten text in ${langName}.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: draft }],
  });
  const rewritten = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return rewritten || draft;
}

export async function generateReply(opts: {
  location: ReplyLocation;
  inputs: ReplyInputs;
  model?: string;
}): Promise<string> {
  const system = buildSystemPrompt(opts.location, opts.inputs.language);
  const userMessage = buildUserMessage(opts.inputs);

  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 400,
    temperature: 0.65,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Model returned no reply text");
  }
  if (isLikelyLanguage(text, opts.inputs.language)) {
    return text;
  }
  const rewritten = await rewriteToLanguage(
    text,
    opts.inputs.language,
    opts.model,
  );
  return rewritten;
}
