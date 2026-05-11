import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Language } from "@/lib/i18n/review";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export interface DraftInputs {
  service: string | null;
  rating: number;
  descriptor: string | null;
  note?: string | null;
}

export interface DraftLocation {
  display_name: string;
  business_type: string | null;
}

export interface DraftResult {
  tone: string;
  text: string;
}

// =============================================================================
// Prompt construction.
// System prompt is fixed per (language, business_type, display_name) and is
// the natural cache key — but for simplicity we cache the whole system block
// per request and rely on Anthropic's ephemeral cache (5min) for bursty
// traffic from the same business.
// =============================================================================

const LANG_NAME: Record<Language, string> = {
  en: "English",
  zh: "Simplified Chinese (简体中文)",
  es: "Spanish (Español)",
};

const DISCLOSURE: Record<Language, string> = {
  en: "Generate 2-3 drafts. The customer will edit before posting — make it sound like a real customer voice, not marketing.",
  zh: "请生成2-3个不同语气的草稿。客户在发布之前会进行编辑，请使用真实顾客的语气，避免营销腔调。",
  es: "Genere 2-3 borradores con tonos distintos. El cliente editará antes de publicar — debe sonar como una voz de cliente real, no como marketing.",
};

export function buildSystemPrompt(loc: DraftLocation, lang: Language): string {
  const langName = LANG_NAME[lang];
  const businessType = loc.business_type ?? "local business";

  return [
    `You help customers write authentic Google reviews for ${loc.display_name}, a ${businessType}.`,
    "",
    `Output language: ${langName}. Every draft must be in ${langName}.`,
    "",
    "Rules for every draft:",
    "- 50–90 words. No shorter, no longer.",
    "- Sounds like a real customer wrote it on their phone. First person.",
    "- Reflects the customer's specific inputs (service received, rating, descriptor).",
    "- Mentions the business by name once, naturally.",
    "- NO unverified factual claims (no specific medical outcomes, miracle cures, or measurable promises).",
    "- NO mention of being AI-generated, of BAAM, of any drafting tool.",
    "- NO emojis, hashtags, or excessive punctuation.",
    "- Natural punctuation and capitalization for the target language.",
    "",
    "Tone variation: produce drafts that differ noticeably from each other:",
    "  1. WARM — personal, emotional, mentions a feeling or detail",
    "  2. SPECIFIC — concrete details about the experience, more factual",
    "  3. BRIEF — short, punchy, two or three sentences max within the word range",
    "",
    "Calibrate to the rating:",
    "- 5 stars: clearly positive",
    "- 4 stars: positive with light qualifier",
    "- 3 stars: balanced",
    "- 1–2 stars: critical but constructive, never mean",
    "",
    DISCLOSURE[lang],
    "",
    'Return ONLY JSON, no preamble: {"drafts":[{"tone":"warm","text":"…"},{"tone":"specific","text":"…"},{"tone":"brief","text":"…"}]}',
  ].join("\n");
}

export function buildUserMessage(inputs: DraftInputs, lang: Language): string {
  const service = inputs.service?.trim() || "(not specified)";
  const descriptor = inputs.descriptor?.trim() || "(not specified)";
  const note = inputs.note?.trim();
  const rating = Math.max(1, Math.min(5, Math.round(inputs.rating)));

  const lines = [
    `Customer inputs (language: ${lang}):`,
    `- Service received: ${service}`,
    `- Rating: ${rating}/5`,
    `- One-word descriptor: ${descriptor}`,
  ];
  if (note) lines.push(`- Free-text note: ${note}`);

  return lines.join("\n");
}

// =============================================================================
// Call Claude. Non-streaming v1 — we wait for the full response and parse.
// Adds prompt-cache markers so repeated requests from the same business
// reuse the system prompt for ~5 minutes.
// =============================================================================

const client = new Anthropic();

export async function generateDrafts(opts: {
  location: DraftLocation;
  language: Language;
  inputs: DraftInputs;
  model?: string;
}): Promise<DraftResult[]> {
  const model = opts.model ?? DEFAULT_MODEL;
  const system = buildSystemPrompt(opts.location, opts.language);
  const userMessage = buildUserMessage(opts.inputs, opts.language);

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.7,
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
    .join("");

  return parseDrafts(text);
}

function parseDrafts(text: string): DraftResult[] {
  // Be forgiving: model may include a leading "Here are…" line despite instructions.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in model response");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(
      `Could not parse model JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("drafts" in parsed) ||
    !Array.isArray((parsed as { drafts: unknown }).drafts)
  ) {
    throw new Error("Model JSON missing drafts array");
  }
  const drafts = (parsed as { drafts: unknown[] }).drafts
    .map((d): DraftResult | null => {
      if (!d || typeof d !== "object") return null;
      const obj = d as Record<string, unknown>;
      const tone = typeof obj.tone === "string" ? obj.tone : "default";
      const draftText = typeof obj.text === "string" ? obj.text.trim() : "";
      if (!draftText) return null;
      return { tone, text: draftText };
    })
    .filter((d): d is DraftResult => d !== null);

  if (drafts.length === 0) {
    throw new Error("Model returned no usable drafts");
  }
  return drafts;
}
