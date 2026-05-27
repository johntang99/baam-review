import "server-only";
import {
  rewriteReviewRequestBody,
  type RewriteLang,
  type RewriteTone,
} from "./rewrite-body";

/**
 * AI variations for bulk list sends (Option B). We pre-generate 5 distinct
 * (subject, body) variants for a list. At send time, sendList randomly picks
 * one per customer — breaking spam-filter template fingerprinting while
 * staying within a set of staff-reviewed templates.
 *
 * Convention: variant bodies use {name} as the recipient placeholder. The
 * list send path replaces {name} with each customer's first name right
 * before calling sendReviewRequest. The existing <slug>/<token> URL
 * placeholders are handled by sendReviewRequest itself, as for single sends.
 */

export interface ListVariant {
  subject: string;
  body: string;
  tone: RewriteTone;
}

export interface GenerateVariantsOptions {
  /** Default subject from the location's template, with {name} placeholder. */
  baseSubject: string;
  /** Default body from the location's template, with {name} placeholder. */
  baseBody: string;
  /** Business name — must survive every variant literally. */
  businessName: string;
  language: RewriteLang;
  channel: "email" | "sms";
}

export interface GenerateVariantsResult {
  ok: boolean;
  variants?: ListVariant[];
  error?: string;
}

// The 4 tones we generate alongside the default. Order matters for stable
// indexing (variant_index → tone), so we keep it explicit.
const VARIANT_TONES: RewriteTone[] = ["brief", "professional", "casual", "warm"];

export async function generateListVariants(
  opts: GenerateVariantsOptions,
): Promise<GenerateVariantsResult> {
  // Variant 0 = the default template as-is. No LLM call, no cost, and it
  // gives staff a stable baseline to compare AI rewrites against.
  const variant0: ListVariant = {
    subject: opts.baseSubject,
    body: opts.baseBody,
    tone: "warm",
  };

  // Variants 1-4: rewrite the default with each tone in parallel. If a
  // single tone fails validation we still return the others — partial
  // success is more useful than no variants. Failures are silent (the UI
  // will show however many variants came back).
  const rewrites = await Promise.all(
    VARIANT_TONES.map(async (tone) => {
      const r = await rewriteReviewRequestBody({
        currentBody: opts.baseBody,
        currentSubject: opts.channel === "email" ? opts.baseSubject : undefined,
        businessName: opts.businessName,
        language: opts.language,
        tone,
        channel: opts.channel,
      });
      if (!r.ok || !r.body) return null;
      return {
        subject: r.subject ?? opts.baseSubject,
        body: r.body,
        tone,
      } satisfies ListVariant;
    }),
  );

  const aiVariants = rewrites.filter((v): v is ListVariant => v !== null);

  if (aiVariants.length === 0) {
    // Don't surface only the default — it defeats the purpose of "variants".
    return {
      ok: false,
      error:
        "AI couldn't generate any variants. Try again, or your AI provider may be rate-limited.",
    };
  }

  return {
    ok: true,
    variants: [variant0, ...aiVariants],
  };
}

/**
 * Substitute {name} placeholder for a specific customer. Called at send
 * time by sendList. First name only — matches the convention used by
 * the default templates (`vars.name.split(" ")[0]`).
 */
export function personalizeVariant(
  variant: { subject: string; body: string },
  customerName: string,
): { subject: string; body: string } {
  const first = (customerName || "").trim().split(/\s+/)[0] || "Customer";
  return {
    subject: variant.subject.replaceAll("{name}", first),
    body: variant.body.replaceAll("{name}", first),
  };
}
