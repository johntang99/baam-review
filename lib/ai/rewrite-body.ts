import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL =
  process.env.AI_REWRITE_CLAUDE_MODEL || "claude-haiku-4-5-20251001";

export type RewriteTone = "warm" | "brief" | "professional" | "casual";
export type RewriteLang = "en" | "zh" | "es";

export interface RewriteInputs {
  currentBody: string;
  /** Email subject to rewrite. Ignored for SMS. */
  currentSubject?: string;
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
  const emailMode = inputs.channel === "email";
  return [
    `You rewrite review-request ${inputs.channel} messages for small businesses.`,
    "",
    `Output language: ${LANG_NAME[inputs.language]}. The rewrite MUST be in this language only.`,
    "",
    `Tone for this rewrite: ${inputs.tone.toUpperCase()} — ${TONE_GUIDE[inputs.tone]}`,
    "",
    CHANNEL_LIMITS[inputs.channel],
    "",
    emailMode
      ? "Subject line: 4–9 words. Specific to this customer/business, not generic. Vary the structure noticeably from the existing subject — different opening word, different sentence shape — so a recipient receiving multiple emails from this business doesn't see the same subject twice. NO 'Re:' / 'Fwd:' prefixes. NO ALL-CAPS. NO spam-flag words ('FREE', 'URGENT', 'GUARANTEED'). NO emoji."
      : "",
    "",
    "HARD RULES — violation is failure:",
    `1. The business name "${inputs.businessName}" MUST appear in the BODY exactly as written, character-for-character. Do not translate, abbreviate, paraphrase, or reorder it. (It may also appear in the subject, but is not required there.)`,
    "2. The URL placeholders <slug> and <token> MUST appear in the BODY EXACTLY as the strings '<slug>' and '<token>'. Do not remove them, rename them, or wrap them in different brackets.",
    "3. The URL format must remain: https://review.baamplatform.com/r/<slug>?t=<token>",
    "4. Include exactly one clear call-to-action pointing to that URL.",
    "5. NEVER offer incentives, discounts, gifts, or rewards in exchange for a review. NEVER imply the reviewer should leave a specific rating. NEVER use urgency tactics ('limited time', 'today only').",
    "6. NEVER mention BAAM, AI, rewriting, or any tooling. Sound like a real person from the business wrote it.",
    "7. NO emojis. NO hashtags. NO ALL-CAPS headlines.",
    "",
    emailMode
      ? 'Output ONLY a JSON object with this exact shape (no preamble, no markdown fence, no commentary): {"subject":"…","body":"…"}'
      : "Output ONLY the rewritten body text as plain text. No preamble, no JSON, no explanation, no quotes around it.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface RewriteResult {
  ok: boolean;
  /** Rewritten body. Always present on success. */
  body?: string;
  /** Rewritten subject. Present only when channel='email'. */
  subject?: string;
  error?: string;
}

function extractJsonObject(raw: string): { subject?: string; body?: string } | null {
  // Strip optional markdown fences the model might add despite instructions.
  const trimmed = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return parsed as { subject?: string; body?: string };
    }
  } catch {
    // Fall through — try to extract first {...} block.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as { subject?: string; body?: string };
      } catch {}
    }
  }
  return null;
}

export async function rewriteReviewRequestBody(
  inputs: RewriteInputs,
): Promise<RewriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI rewrite not configured (missing API key)" };
  }

  const client = new Anthropic({ apiKey });
  const emailMode = inputs.channel === "email";

  // Try up to 2 times — once normally, once with a stricter reminder if the
  // first response loses the business name or placeholders.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const originalBlock = emailMode
        ? `Original subject:\n${inputs.currentSubject ?? ""}\n\nOriginal body:\n${inputs.currentBody}`
        : `Original ${inputs.channel} body:\n\n${inputs.currentBody}`;

      const message = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 700,
        system: buildSystemPrompt(inputs),
        messages: [
          {
            role: "user",
            content:
              attempt === 0
                ? `${originalBlock}\n\nRewrite ${emailMode ? "both subject and body" : "the body"} now.`
                : `${originalBlock}\n\nYour previous rewrite removed the business name or placeholders. Rewrite again, this time ensuring "${inputs.businessName}" appears literally in the body and the URL ends with "/r/<slug>?t=<token>" exactly.`,
          },
        ],
      });

      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim();

      if (!text) continue;

      let body: string | undefined;
      let subject: string | undefined;

      if (emailMode) {
        const parsed = extractJsonObject(text);
        if (
          !parsed ||
          typeof parsed.body !== "string" ||
          typeof parsed.subject !== "string"
        ) {
          continue;
        }
        body = parsed.body.trim();
        subject = parsed.subject.trim();
      } else {
        body = text;
      }

      // Validate — body must keep business name + both URL placeholders.
      // Subject (when present) just needs to be non-empty and not unreasonably long.
      const hasBusinessName = body.includes(inputs.businessName);
      const hasSlug = body.includes("<slug>");
      const hasToken = body.includes("<token>");
      const subjectOk = !emailMode || (subject && subject.length > 0 && subject.length <= 120);

      if (hasBusinessName && hasSlug && hasToken && subjectOk) {
        return { ok: true, body, subject: emailMode ? subject : undefined };
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
