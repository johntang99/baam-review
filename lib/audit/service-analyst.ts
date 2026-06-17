import Anthropic from "@anthropic-ai/sdk";
import type { AuditGoogleData } from "@/lib/audit/google/types";
import {
  generateServiceCandidates,
  type GeneratedServiceCandidate,
} from "@/lib/audit/service-candidate-generator";
import {
  canonicalizeService,
  getServiceSpecificity,
  isGenericServiceValue,
  normalizeServiceText,
} from "@/lib/audit/service-taxonomy";
import {
  pickDistilledTopCandidate,
  rankWithDistilledModel,
  type DistilledRankedCandidate,
} from "@/lib/audit/service-distilled-ranker";

const DEFAULT_ANALYST_MODEL =
  process.env.SERVICE_ANALYST_CLAUDE_MODEL || "claude-haiku-4-5-20251001";

export interface ServiceEvidencePack {
  business_name: string;
  inferred_vertical: string;
  google_primary_category: string;
  google_categories: string[];
  google_service: string;
  fallback_service: string;
  gbp_description: string;
  website_signal_excerpt: string;
}

export interface ServiceAnalystResult {
  recommended_service: string;
  confidence: number;
  mode: "distilled" | "llm";
  rationale: string;
  candidate_ranking: Array<{
    service: string;
    score: number;
    confidence: number;
    sources: string[];
    specificity: number;
  }>;
}

export async function analyzeServiceWithAnalyst({
  google,
  googleService,
  fallbackService,
  gbpDescription,
  websiteSignalText,
  useLlm = false,
}: {
  google: AuditGoogleData;
  googleService: string;
  fallbackService: string;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
  useLlm?: boolean;
}): Promise<ServiceAnalystResult> {
  const candidates = generateServiceCandidates({
    google,
    gbpDescription,
    websiteSignalText,
    seedService: fallbackService,
  }).slice(0, 6);

  const distilledTop = pickDistilledTopCandidate(candidates);
  const distilledRanking = rankWithDistilledModel(candidates).slice(0, 5);
  if (!distilledTop) {
    return {
      recommended_service: canonicalizeService(fallbackService) || "local business",
      confidence: 0.6,
      mode: "distilled",
      rationale: "No viable candidates produced; fallback to seed service.",
      candidate_ranking: [],
    };
  }

  if (!useLlm || !process.env.ANTHROPIC_API_KEY) {
    return {
      recommended_service: canonicalizeService(distilledTop.service),
      confidence: distilledTop.distilled_confidence,
      mode: "distilled",
      rationale:
        "Distilled ranker selected the best candidate by specificity, source diversity, and broad-service penalty.",
      candidate_ranking: toPublicRanking(distilledRanking),
    };
  }

  const llmResult = await analyzeWithLlm({
    evidence: buildServiceEvidencePack({
      google,
      googleService,
      fallbackService,
      gbpDescription,
      websiteSignalText,
    }),
    candidates,
  });

  if (!llmResult) {
    return {
      recommended_service: canonicalizeService(distilledTop.service),
      confidence: distilledTop.distilled_confidence,
      mode: "distilled",
      rationale:
        "LLM analyst output invalid/unavailable; falling back to distilled ranker.",
      candidate_ranking: toPublicRanking(distilledRanking),
    };
  }

  const recommended = canonicalizeService(llmResult.recommended_service);
  if (!recommended) {
    return {
      recommended_service: canonicalizeService(distilledTop.service),
      confidence: distilledTop.distilled_confidence,
      mode: "distilled",
      rationale:
        "LLM returned empty recommendation; falling back to distilled ranker.",
      candidate_ranking: toPublicRanking(distilledRanking),
    };
  }

  const bestSupported = chooseSupportedRecommendation({
    llmRecommendation: recommended,
    candidates,
    distilledTop,
  });

  return {
    recommended_service: bestSupported.service,
    confidence: bestSupported.confidence,
    mode: "llm",
    rationale: llmResult.rationale,
    candidate_ranking: toPublicRanking(distilledRanking),
  };
}

export function buildServiceEvidencePack({
  google,
  googleService,
  fallbackService,
  gbpDescription,
  websiteSignalText,
}: {
  google: AuditGoogleData;
  googleService: string;
  fallbackService: string;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
}): ServiceEvidencePack {
  return {
    business_name: google.business.name,
    inferred_vertical: google.vertical.inferred_vertical,
    google_primary_category:
      google.vertical.primary_category_display || google.vertical.primary_category,
    google_categories: google.vertical.google_categories ?? [],
    google_service: canonicalizeService(googleService),
    fallback_service: canonicalizeService(fallbackService),
    gbp_description: normalizeServiceText(gbpDescription).slice(0, 600),
    website_signal_excerpt: normalizeServiceText(websiteSignalText).slice(0, 1000),
  };
}

async function analyzeWithLlm({
  evidence,
  candidates,
}: {
  evidence: ServiceEvidencePack;
  candidates: GeneratedServiceCandidate[];
}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: DEFAULT_ANALYST_MODEL,
    max_tokens: 700,
    temperature: 0.1,
    system: [
      {
        type: "text",
        text: buildAnalystSystemPrompt(),
      },
    ],
    messages: [
      {
        role: "user",
        content: buildAnalystUserPrompt(evidence, candidates),
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const parsed = safeParseAnalystJson(text);
  if (!parsed) return null;
  return parsed;
}

function chooseSupportedRecommendation({
  llmRecommendation,
  candidates,
  distilledTop,
}: {
  llmRecommendation: string;
  candidates: GeneratedServiceCandidate[];
  distilledTop: DistilledRankedCandidate;
}) {
  const inCandidateSet = candidates.find(
    (candidate) => canonicalizeService(candidate.service) === llmRecommendation,
  );
  if (inCandidateSet) {
    return {
      service: canonicalizeService(inCandidateSet.service),
      confidence: Number(
        Math.max(0.62, Math.min(0.95, inCandidateSet.confidence + 0.03)).toFixed(2),
      ),
    };
  }

  if (!isGenericServiceValue(llmRecommendation) && getServiceSpecificity(llmRecommendation) >= 3) {
    return {
      service: llmRecommendation,
      confidence: 0.74,
    };
  }

  return {
    service: canonicalizeService(distilledTop.service),
    confidence: distilledTop.distilled_confidence,
  };
}

function toPublicRanking(candidates: DistilledRankedCandidate[]) {
  return candidates.map((candidate) => ({
    service: canonicalizeService(candidate.service),
    score: candidate.distilled_score,
    confidence: candidate.distilled_confidence,
    sources: candidate.sources,
    specificity: candidate.specificity,
  }));
}

function buildAnalystSystemPrompt() {
  return [
    "You are a strict service analyst for local business audits.",
    "Choose the most specific, evidence-supported service.",
    "Avoid broad categories if a specific and supported service exists.",
    "Never invent evidence not present in input.",
    'Output JSON only: {"recommended_service":"...","confidence":0.00,"rationale":"..."}',
  ].join("\n");
}

function buildAnalystUserPrompt(
  evidence: ServiceEvidencePack,
  candidates: GeneratedServiceCandidate[],
) {
  return [
    `Business: ${evidence.business_name}`,
    `Vertical: ${evidence.inferred_vertical}`,
    `Google primary category: ${evidence.google_primary_category}`,
    `Google categories: ${evidence.google_categories.join(", ")}`,
    `Google service: ${evidence.google_service}`,
    `Fallback service: ${evidence.fallback_service}`,
    `GBP description: ${evidence.gbp_description || "(empty)"}`,
    `Website signal: ${evidence.website_signal_excerpt || "(empty)"}`,
    "",
    "Candidates:",
    ...candidates.map(
      (candidate, index) =>
        `${index + 1}. ${canonicalizeService(candidate.service)} | score=${candidate.score.toFixed(
          2,
        )} confidence=${Math.round(candidate.confidence * 100)}% specificity=${candidate.specificity} sources=${candidate.sources.join(", ")}`,
    ),
    "",
    "Select the best final service and return JSON only.",
  ].join("\n");
}

function safeParseAnalystJson(
  text: string,
): { recommended_service: string; confidence: number; rationale: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      recommended_service?: unknown;
      confidence?: unknown;
      rationale?: unknown;
    };
    if (typeof parsed.recommended_service !== "string" || !parsed.recommended_service.trim()) {
      return null;
    }
    const confidenceRaw =
      typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence ?? NaN);
    const confidence = Number.isFinite(confidenceRaw)
      ? Number(Math.max(0.45, Math.min(0.95, confidenceRaw)).toFixed(2))
      : 0.72;
    const rationale =
      typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim().slice(0, 400)
        : "LLM analyst recommendation.";
    return {
      recommended_service: parsed.recommended_service.trim(),
      confidence,
      rationale,
    };
  } catch {
    return null;
  }
}
