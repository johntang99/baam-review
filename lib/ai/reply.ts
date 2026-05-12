import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export interface ReplyInputs {
  /** The reviewer's display name as shown on Google. Used to address them. */
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

/**
 * Detect the predominant language of the review comment so the reply
 * matches. Conservative — defaults to English when uncertain.
 */
export function detectReviewLanguage(comment: string | null): "en" | "zh" | "es" {
  if (!comment) return "en";
  const trimmed = comment.trim();
  // Heuristic: count CJK chars; if >20% of total, treat as Chinese.
  const cjkMatches = trimmed.match(/[一-鿿]/g);
  if (cjkMatches && cjkMatches.length / trimmed.length > 0.2) return "zh";
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
    "- Thank the reviewer by first name if available.",
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
  const lines = [
    `Reviewer name: ${inputs.reviewerName ?? "(anonymous)"}`,
    `Rating: ${inputs.rating}/5`,
    `Review:`,
    inputs.comment?.trim() || "(reviewer left only stars, no text)",
  ];
  return lines.join("\n");
}

const client = new Anthropic();

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
  return text;
}
