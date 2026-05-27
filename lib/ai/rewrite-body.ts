import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL =
  process.env.AI_REWRITE_CLAUDE_MODEL || "claude-haiku-4-5-20251001";

export type RewriteTone = "warm" | "brief" | "professional" | "casual";
export type RewriteLang = "en" | "zh" | "es";

export interface RewriteInputs {
  currentBody: string;
  businessName: string;
  language: RewriteLang;
  tone: RewriteTone;
  channel: "email" | "sms";
}

const LANG_NAME: Record<RewriteLang, string> = {
  en: "English",
  zh: "Chinese (use the same character set — Traditional or Simplified — as the input body)",
  es: "Spanish (Español)",
};

const TONE_GUIDE: Record<RewriteTone, string> = {
  warm: "Warm and personal — sounds like a sincere thank-you note from a real person, not a marketing email.",
  brief:
    "Brief and direct — two or three short sentences plus the link. Trim every non-essential word.",
  professional:
    "Polite and formal — courteous tone appropriate for medical / legal / B2B contexts.",
  casual:
    "Casual and conversational — friendly, light, like a quick text from a familiar acquaintance.",
};

const CHANNEL_LIMITS: Record<"email" | "sms", string> = {
  email:
    "Length: 60–180 words. Multi-line is fine; include a short greeting and a sign-off.",
  sms: "Length: 1–3 short sentences, under 320 characters total. No greeting/sign-off lines — just the message and the link.",
};

function buildSystemPrompt(inputs: RewriteInputs): string {
  return [
    `You rewrite review-request ${inputs.channel} bodies for small businesses.`,
    "",
    `Output language: ${LANG_NAME[inputs.language]}. The rewrite MUST be in this language only.`,
    "",
    `Tone for this rewrite: ${inputs.tone.toUpperCase()} — ${TONE_GUIDE[inputs.tone]}`,
    "",
    CHANNEL_LIMITS[inputs.channel],
    "",
    "HARD RULES — violation is failure:",
    `1. The business name "${inputs.businessName}" MUST appear in the output exactly as written, character-for-character. Do not translate, abbreviate, paraphrase, or reorder it.`,
    "2. The URL placeholders <slug> and <token> MUST appear in the output EXACTLY as the strings '<slug>' and '<token>'. Do not remove them, rename them, or wrap them in different brackets.",
    "3. The URL format must remain: https://review.baamplatform.com/r/<slug>?t=<token>",
    "4. Include exactly one clear call-to-action pointing to that URL.",
    "5. NEVER offer incentives, discounts, gifts, or rewards in exchange for a review. NEVER imply the reviewer should leave a specific rating. NEVER use urgency tactics ('limited time', 'today only').",
    "6. NEVER mention BAAM, AI, rewriting, or any tooling. Sound like a real person from the business wrote it.",
    "7. NO emojis. NO hashtags. NO ALL-CAPS headlines.",
    "",
    "Output ONLY the rewritten body text as plain text. No preamble, no JSON, no explanation, no quotes around it.",
  ].join("\n");
}

export interface RewriteResult {
  ok: boolean;
  body?: string;
  error?: string;
}

export async function rewriteReviewRequestBody(
  inputs: RewriteInputs,
): Promise<RewriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI rewrite not configured (missing API key)" };
  }

  const client = new Anthropic({ apiKey });

  // Try up to 2 times — once normally, once with a stricter reminder if the
  // first response loses the business name or placeholders.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 600,
        system: buildSystemPrompt(inputs),
        messages: [
          {
            role: "user",
            content:
              attempt === 0
                ? `Original ${inputs.channel} body:\n\n${inputs.currentBody}\n\nRewrite it now.`
                : `Original ${inputs.channel} body:\n\n${inputs.currentBody}\n\nYour previous rewrite removed the business name or placeholders. Rewrite again, this time ensuring "${inputs.businessName}" appears literally and the URL ends with "/r/<slug>?t=<token>" exactly.`,
          },
        ],
      });

      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim();

      if (!text) continue;

      // Validate — business name + both URL placeholders must survive.
      const hasBusinessName = text.includes(inputs.businessName);
      const hasSlug = text.includes("<slug>");
      const hasToken = text.includes("<token>");

      if (hasBusinessName && hasSlug && hasToken) {
        return { ok: true, body: text };
      }
      // else fall through to retry
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "AI request failed",
      };
    }
  }

  return {
    ok: false,
    error: "AI couldn't produce a valid rewrite — please try a different tone.",
  };
}
