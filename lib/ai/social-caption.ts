import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export type CaptionPlatform =
  | "instagram"
  | "xiaohongshu"
  | "facebook"
  | "wechat";

export interface CaptionInputs {
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  language: "en" | "zh" | "es";
  platform: CaptionPlatform;
  locationName: string;
  businessType: string | null;
  bookingUrl?: string | null;
}

interface CaptionOutput {
  caption: string;
  hashtags: string[];
}

const LANG_NAME: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese (简体中文)",
  es: "Spanish (Español)",
};

const PLATFORM_GUIDE: Record<CaptionPlatform, string> = {
  instagram:
    "Instagram feed post. 60–140 words. Lead with the review's strongest line. Sprinkle 1–2 tasteful emojis if natural. Include a soft CTA. 5–10 specific hashtags (location + service + condition).",
  xiaohongshu:
    "Xiaohongshu (小红书) post. Audience is overseas Chinese (海外华人). 80–180 characters. Conversational, slightly emotional. Use a relatable hook line. 4–8 specific hashtags in #话题 format including the city and modality.",
  facebook:
    "Facebook Page post. 80–160 words. More narrative, more trustworthy. Keep it informational; avoid emoji-heavy style. 0–3 hashtags max.",
  wechat:
    "WeChat Moments (朋友圈). 50–120 characters. Casual, personal voice as if recommending to friends. No hashtags (WeChat doesn't surface them). End with the clinic / business name.",
};

function buildSystemPrompt(input: CaptionInputs): string {
  const langName = LANG_NAME[input.language] ?? "English";
  const guide = PLATFORM_GUIDE[input.platform];
  return [
    `You are drafting a social-media caption for a ${input.businessType ?? "local business"} called "${input.locationName}".`,
    "",
    `The caption accompanies a share-card image showing a real ${input.rating}-star Google review from a customer.`,
    "",
    `Platform: ${input.platform}. ${guide}`,
    "",
    `Output language: ${langName}. Caption text and hashtags MUST be in ${langName}.`,
    "",
    "Hard rules:",
    "- Never claim medical outcomes or specific results — owners are liable.",
    "- Never write IN THE VOICE OF the reviewer (they are quoted in the image; the caption is the business speaking).",
    "- Never use the phrase 'AI-generated' or mention BAAM.",
    "- Never invent details not in the review.",
    "- Refer to the customer by first name only when natural, never full name.",
    "- One-line CTA at the end where the platform supports it (Instagram / Facebook). Use the booking URL only if provided.",
    "",
    "Return JSON only, in this exact shape:",
    `{ "caption": "...", "hashtags": ["#tag1", "#tag2", ...] }`,
    "",
    "Do not wrap the JSON in markdown fences. Do not include any commentary before or after.",
  ].join("\n");
}

function buildUserMessage(input: CaptionInputs): string {
  return [
    `Reviewer name: ${input.reviewerName ?? "(anonymous)"}`,
    `Rating: ${input.rating}/5`,
    `Review text:`,
    input.comment?.trim() || "(reviewer left only stars, no text)",
    input.bookingUrl ? `Booking URL: ${input.bookingUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const client = new Anthropic();

export async function generateSocialCaption(
  input: CaptionInputs,
  opts: { model?: string } = {},
): Promise<CaptionOutput> {
  const system = buildSystemPrompt(input);
  const user = buildUserMessage(input);

  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 700,
    temperature: 0.7,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error("Model returned no caption text");

  // The model is instructed to return raw JSON. Be defensive: strip
  // markdown fences if it slipped one in, then parse.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: { caption?: unknown; hashtags?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { caption?: unknown; hashtags?: unknown };
  } catch {
    throw new Error("Model returned non-JSON caption");
  }

  const caption =
    typeof parsed.caption === "string" ? parsed.caption.trim() : "";
  const hashtagsRaw = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
  const hashtags = hashtagsRaw
    .filter((h): h is string => typeof h === "string")
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .slice(0, 12);

  if (!caption) throw new Error("Caption missing from model response");

  return { caption, hashtags };
}
