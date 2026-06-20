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
  isKnownService,
  normalizeServiceText,
} from "@/lib/audit/service-taxonomy";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";
import {
  pickDistilledTopCandidate,
  rankWithDistilledModel,
  type DistilledRankedCandidate,
} from "@/lib/audit/service-distilled-ranker";

const PRIMARY_ANALYST_MODEL =
  process.env.SERVICE_ANALYST_CLAUDE_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-opus-4-8";
const FALLBACK_ANALYST_MODEL = "claude-sonnet-4-5-20250929";
const PHRASE_TOKEN_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "by",
  "with",
  "service",
  "services",
  "business",
  "company",
  "professional",
  "solutions",
  "store",
  "shop",
]);

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
  llm_service_phrase?: string;
  llm_phrase_candidates?: string[];
  llm_suggested_services?: string[];
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
  const evidencePack = buildServiceEvidencePack({
    google,
    googleService,
    fallbackService,
    gbpDescription,
    websiteSignalText,
  });
  const candidates = generateServiceCandidates({
    google,
    gbpDescription,
    websiteSignalText,
    seedService: fallbackService,
  }).slice(0, 10);

  const distilledTop = pickDistilledTopCandidate(candidates);
  const distilledRanking = rankWithDistilledModel(candidates).slice(0, 5);
  if (!distilledTop) {
    return {
      recommended_service: canonicalizeService(fallbackService) || "local business",
      confidence: 0.6,
      mode: "distilled",
      rationale: "No viable candidates produced; fallback to seed service.",
      llm_service_phrase: "",
      llm_phrase_candidates: [],
      llm_suggested_services: [],
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
      llm_service_phrase: "",
      llm_phrase_candidates: [],
      llm_suggested_services: [],
      candidate_ranking: toPublicRanking(distilledRanking),
    };
  }

  const llmResult = await analyzeWithLlm({
    evidence: evidencePack,
    candidates,
  });

  if (!llmResult) {
    return {
      recommended_service: canonicalizeService(distilledTop.service),
      confidence: distilledTop.distilled_confidence,
      mode: "distilled",
      rationale:
        "LLM analyst output invalid/unavailable; falling back to distilled ranker.",
      llm_service_phrase: "",
      llm_phrase_candidates: [],
      llm_suggested_services: [],
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
      llm_service_phrase: "",
      llm_phrase_candidates: [],
      llm_suggested_services: [],
      candidate_ranking: toPublicRanking(distilledRanking),
    };
  }

  const bestSupported = chooseSupportedRecommendation({
    llmRecommendation: recommended,
    candidates,
    distilledTop,
  });
  let normalizedRecommendation = applyDeterministicAnalystNormalization({
    recommendedService: bestSupported.service,
    evidence: evidencePack,
  });
  let rationale = llmResult.rationale;
  let llmServicePhrase = keepRawServicePhrase(
    llmResult.service_phrase || llmResult.recommended_service,
  );
  const llmPhraseCandidates: string[] = [];
  pushUniquePhrase(llmPhraseCandidates, llmServicePhrase);
  pushUniquePhrase(llmPhraseCandidates, llmResult.recommended_service);
  for (const phrase of llmResult.alternative_phrases ?? []) {
    pushUniquePhrase(llmPhraseCandidates, phrase);
  }
  if (
    shouldRunVerifierPass({
      evidence: evidencePack,
      recommendedService: normalizedRecommendation,
      candidates,
    })
  ) {
    const verifierResult = await analyzeWithVerifierEnsemble({
      evidence: evidencePack,
      candidates,
      initialRecommendation: normalizedRecommendation,
      initialPhrase: llmServicePhrase,
    }).catch(() => null);
    if (verifierResult) {
      const verifierRecommendationRaw =
        verifierResult.recommended_service || verifierResult.service_phrase || "";
      const verifierRecommended = canonicalizeService(verifierRecommendationRaw);
      if (verifierRecommended) {
        const verifierSupported = chooseSupportedRecommendation({
          llmRecommendation: verifierRecommended,
          candidates,
          distilledTop,
        });
        normalizedRecommendation = applyDeterministicAnalystNormalization({
          recommendedService: verifierSupported.service,
          evidence: evidencePack,
        });
      }
      const verifierPhrase = keepRawServicePhrase(
        verifierResult.service_phrase || verifierResult.recommended_service,
      );
      if (verifierPhrase) llmServicePhrase = verifierPhrase;
      pushUniquePhrase(llmPhraseCandidates, verifierPhrase);
      for (const phrase of verifierResult.alternative_phrases ?? []) {
        pushUniquePhrase(llmPhraseCandidates, phrase);
      }
      if (verifierResult.rationale) {
        rationale = `${rationale} | Verifier: ${verifierResult.rationale}`.slice(0, 400);
      }
    }
  }
  if (!llmServicePhrase) {
    llmServicePhrase = normalizedRecommendation;
  }
  if (isOpus48Model(PRIMARY_ANALYST_MODEL)) {
    const tunedPhrase = selectBestEvidenceBackedPhrase({
      preferredPhrase: llmServicePhrase,
      phraseCandidates: llmPhraseCandidates,
      evidence: evidencePack,
    });
    if (tunedPhrase) {
      llmServicePhrase = tunedPhrase;
      pushUniquePhrase(llmPhraseCandidates, tunedPhrase);
    }
  }
  const phraseFirstRecommendation = llmServicePhrase || normalizedRecommendation;

  return {
    // Keep phrase-first output for business service wording.
    recommended_service: phraseFirstRecommendation,
    confidence: bestSupported.confidence,
    mode: "llm",
    rationale,
    llm_service_phrase: llmServicePhrase,
    llm_phrase_candidates: llmPhraseCandidates,
    llm_suggested_services: buildLlmSuggestedServices({
      rawLlmRecommendation: llmResult.recommended_service,
      normalizedRecommendation: phraseFirstRecommendation,
      llmServicePhrase,
      llmPhraseCandidates,
    }),
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
  const response = await createAnalystMessage(client, evidence, candidates, PRIMARY_ANALYST_MODEL).catch(
    async () => {
      if (PRIMARY_ANALYST_MODEL === FALLBACK_ANALYST_MODEL) {
        throw new Error("primary_analyst_model_failed");
      }
      return createAnalystMessage(client, evidence, candidates, FALLBACK_ANALYST_MODEL);
    },
  );

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const parsed = safeParseAnalystJson(text);
  if (!parsed) return null;
  return parsed;
}

async function analyzeWithVerifier({
  evidence,
  candidates,
  initialRecommendation,
  initialPhrase,
}: {
  evidence: ServiceEvidencePack;
  candidates: GeneratedServiceCandidate[];
  initialRecommendation: string;
  initialPhrase: string;
}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await createVerifierMessage(
    client,
    evidence,
    candidates,
    initialRecommendation,
    initialPhrase,
    PRIMARY_ANALYST_MODEL,
  ).catch(async () => {
    if (PRIMARY_ANALYST_MODEL === FALLBACK_ANALYST_MODEL) {
      throw new Error("verifier_primary_model_failed");
    }
    return createVerifierMessage(
      client,
      evidence,
      candidates,
      initialRecommendation,
      initialPhrase,
      FALLBACK_ANALYST_MODEL,
    );
  });
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  return safeParseVerifierJson(text);
}

async function analyzeWithVerifierEnsemble(args: {
  evidence: ServiceEvidencePack;
  candidates: GeneratedServiceCandidate[];
  initialRecommendation: string;
  initialPhrase: string;
}) {
  const runs: Array<{
    recommended_service: string;
    service_phrase: string;
    confidence: number;
    rationale: string;
    alternative_phrases: string[];
  }> = [];

  const primaryRun = await analyzeWithVerifier({
    evidence: args.evidence,
    candidates: args.candidates,
    initialRecommendation: args.initialRecommendation,
    initialPhrase: args.initialPhrase,
  }).catch(() => null);
  if (primaryRun) runs.push(primaryRun);

  if (FALLBACK_ANALYST_MODEL !== PRIMARY_ANALYST_MODEL) {
    const fallbackRun = await analyzeWithVerifierWithModel({
      evidence: args.evidence,
      candidates: args.candidates,
      initialRecommendation: args.initialRecommendation,
      initialPhrase: args.initialPhrase,
      model: FALLBACK_ANALYST_MODEL,
    }).catch(() => null);
    if (fallbackRun) runs.push(fallbackRun);
  }

  if (runs.length === 0) return null;
  return pickBestVerifierRun(runs, args.candidates, args.evidence.inferred_vertical);
}

async function analyzeWithVerifierWithModel({
  evidence,
  candidates,
  initialRecommendation,
  initialPhrase,
  model,
}: {
  evidence: ServiceEvidencePack;
  candidates: GeneratedServiceCandidate[];
  initialRecommendation: string;
  initialPhrase: string;
  model: string;
}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await createVerifierMessage(
    client,
    evidence,
    candidates,
    initialRecommendation,
    initialPhrase,
    model,
  );
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  return safeParseVerifierJson(text);
}

async function createAnalystMessage(
  client: Anthropic,
  evidence: ServiceEvidencePack,
  candidates: GeneratedServiceCandidate[],
  model: string,
) {
  return client.messages.create({
    model,
    max_tokens: 700,
    temperature: 0.1,
    system: [
      {
        type: "text",
        text: buildAnalystSystemPrompt(model),
      },
    ],
    messages: [
      {
        role: "user",
        content: buildAnalystUserPrompt(evidence, candidates),
      },
    ],
  });
}

async function createVerifierMessage(
  client: Anthropic,
  evidence: ServiceEvidencePack,
  candidates: GeneratedServiceCandidate[],
  initialRecommendation: string,
  initialPhrase: string,
  model: string,
) {
  return client.messages.create({
    model,
    max_tokens: 700,
    temperature: 0,
    system: [
      {
        type: "text",
        text: buildVerifierSystemPrompt(model),
      },
    ],
    messages: [
      {
        role: "user",
        content: buildVerifierUserPrompt(
          evidence,
          candidates,
          initialRecommendation,
          initialPhrase,
        ),
      },
    ],
  });
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

  if (
    isKnownService(llmRecommendation) &&
    !isGenericServiceValue(llmRecommendation) &&
    getServiceSpecificity(llmRecommendation) >= 3
  ) {
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

function buildAnalystSystemPrompt(model: string) {
  const base = [
    "You are a strict service analyst for local business audits.",
    "Choose the most specific, evidence-supported service.",
    "Avoid broad categories if a specific and supported service exists.",
    "Multi-word service labels are preferred when they better match niche intent.",
    "If evidence is mixed, prefer precise business-language phrases over generic categories.",
    "Never invent evidence not present in input.",
  ];
  if (isOpus48Model(model)) {
    base.push(
      "For service_phrase, keep meaningful qualifiers if evidence supports them (for example: fish, tropical, express, custom, wedding, mobile).",
      "Do not over-compress phrases. Preserve useful modifiers that improve business intent clarity.",
      "recommended_service should usually match service_phrase wording unless evidence strongly conflicts.",
    );
  }
  base.push(
    'Output JSON only: {"recommended_service":"...","service_phrase":"...","confidence":0.00,"rationale":"...","alternative_phrases":["..."]}',
  );
  return base.join("\n");
}

function buildVerifierSystemPrompt(model: string) {
  const base = [
    "You are a second-pass verifier for local business service classification.",
    "Your job is to correct broad or ambiguous services.",
    "Prefer precise, evidence-backed multi-word service phrases.",
    "Do not invent evidence or categories not supported by inputs.",
  ];
  if (isOpus48Model(model)) {
    base.push(
      "When two phrases are both plausible, prefer the one with richer, evidence-backed qualifiers over a shortened generic version.",
    );
  }
  base.push(
    'Output JSON only: {"recommended_service":"...","service_phrase":"...","confidence":0.00,"rationale":"...","alternative_phrases":["..."]}',
  );
  return base.join("\n");
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
    "Select the best final service and return JSON only with recommended_service, service_phrase, confidence, rationale, alternative_phrases.",
  ].join("\n");
}

function buildVerifierUserPrompt(
  evidence: ServiceEvidencePack,
  candidates: GeneratedServiceCandidate[],
  initialRecommendation: string,
  initialPhrase: string,
) {
  return [
    `Business: ${evidence.business_name}`,
    `Vertical: ${evidence.inferred_vertical}`,
    `Google primary category: ${evidence.google_primary_category}`,
    `Google categories: ${evidence.google_categories.join(", ")}`,
    `Google service: ${evidence.google_service}`,
    `Fallback service: ${evidence.fallback_service}`,
    `Initial recommendation: ${initialRecommendation}`,
    `Initial phrase: ${initialPhrase || "(empty)"}`,
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
    "Pick final recommendation + a human-readable phrase + 1-3 alternative phrases.",
  ].join("\n");
}

function safeParseAnalystJson(
  text: string,
): {
  recommended_service: string;
  service_phrase: string;
  confidence: number;
  rationale: string;
  alternative_phrases: string[];
} | null {
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
    const recommendedRaw = parsed.recommended_service;
    const confidenceRaw =
      typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence ?? NaN);
    const confidence = Number.isFinite(confidenceRaw)
      ? Number(Math.max(0.45, Math.min(0.95, confidenceRaw)).toFixed(2))
      : 0.72;
    const rationale =
      typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim().slice(0, 400)
        : "LLM analyst recommendation.";
    const servicePhrase =
      typeof (parsed as { service_phrase?: unknown }).service_phrase === "string" &&
      String((parsed as { service_phrase?: unknown }).service_phrase).trim()
        ? String((parsed as { service_phrase?: unknown }).service_phrase)
        : recommendedRaw;
    const alternativePhrases = Array.isArray(
      (parsed as { alternative_phrases?: unknown }).alternative_phrases,
    )
      ? ((parsed as { alternative_phrases?: unknown[] }).alternative_phrases ?? [])
          .map((item) => (typeof item === "string" ? item : ""))
          .filter((item) => item.trim().length > 0)
          .slice(0, 3)
      : [];
    return {
      recommended_service: recommendedRaw,
      service_phrase: servicePhrase,
      confidence,
      rationale,
      alternative_phrases: alternativePhrases,
    };
  } catch {
    return null;
  }
}

function safeParseVerifierJson(
  text: string,
): {
  recommended_service: string;
  service_phrase: string;
  confidence: number;
  rationale: string;
  alternative_phrases: string[];
} | null {
  return safeParseAnalystJson(text);
}

function applyDeterministicAnalystNormalization(args: {
  recommendedService: string;
  evidence: ServiceEvidencePack;
}) {
  const recommended = canonicalizeService(args.recommendedService);
  if (!recommended) return recommended;
  const textBlob = normalizeServiceText(
    [
      args.evidence.business_name,
      args.evidence.google_primary_category,
      args.evidence.google_categories.join(" "),
      args.evidence.gbp_description,
      args.evidence.website_signal_excerpt,
    ].join(" "),
  );

  if (
    recommended === "building materials store" &&
    /\b(tubz|walk[\s-]?in tubs?|kitchen\s*(and|&)\s*bath|bath(room)? fixtures?|plumbing showroom)\b/i.test(
      textBlob,
    )
  ) {
    return canonicalizeService("kitchen & bath plumbing showroom");
  }

  if (recommended === "school" || recommended === "academy" || recommended === "educational institution") {
    if (/\b(language school|esl school|english school|language academy)\b/i.test(textBlob)) {
      return canonicalizeService("language school");
    }
    if (/\b(after school|after-school|afterschool|enrichment program|homework help)\b/i.test(textBlob)) {
      return canonicalizeService("after school program");
    }
    if (
      /\b(academy|school|tutor|tutoring|test prep|sat prep|learning center|learning centre|education center|education centre|summer camp organizer)\b/i.test(
        textBlob,
      )
    ) {
      return canonicalizeService("tutoring service");
    }
  }

  return recommended;
}

function buildLlmSuggestedServices(args: {
  rawLlmRecommendation: string;
  normalizedRecommendation: string;
  llmServicePhrase: string;
  llmPhraseCandidates: string[];
}) {
  const output: string[] = [];
  const push = (value: string | null | undefined) => {
    const phrase = keepRawServicePhrase(value);
    if (!phrase) return;
    const exists = output.some((item) => item.toLowerCase() === phrase.toLowerCase());
    if (exists) return;
    output.push(phrase);
  };
  push(args.rawLlmRecommendation);
  push(args.llmServicePhrase);
  for (const phrase of args.llmPhraseCandidates) {
    push(phrase);
  }
  push(args.normalizedRecommendation);
  return output;
}

function shouldRunVerifierPass(args: {
  evidence: ServiceEvidencePack;
  recommendedService: string;
  candidates: GeneratedServiceCandidate[];
}) {
  const recommended = canonicalizeService(args.recommendedService);
  const primaryCategory = normalizeServiceText(args.evidence.google_primary_category);
  const categories = normalizeServiceText(args.evidence.google_categories.join(" "));
  const broadHints = [
    "school",
    "educational institution",
    "store",
    "building materials store",
    "manufacturer",
    "contractor",
    "medical clinic",
    "health",
    "local business",
  ];
  const hasAmbiguousCategory = broadHints.some(
    (hint) => primaryCategory.includes(hint) || categories.includes(hint),
  );
  const isBroadRecommended =
    isBroadServiceTerm(recommended, { vertical: args.evidence.inferred_vertical }) ||
    getServiceSpecificity(recommended) <= 2;
  const hasBroadTopCandidates = args.candidates
    .slice(0, 3)
    .filter((candidate) => {
      const normalized = canonicalizeService(candidate.service);
      return (
        isBroadServiceTerm(normalized, { vertical: args.evidence.inferred_vertical }) ||
        getServiceSpecificity(normalized) <= 2
      );
    }).length >= 2;
  return isBroadRecommended || hasAmbiguousCategory || hasBroadTopCandidates;
}

function pickBestVerifierRun(
  runs: Array<{
    recommended_service: string;
    service_phrase: string;
    confidence: number;
    rationale: string;
    alternative_phrases: string[];
  }>,
  candidates: GeneratedServiceCandidate[],
  vertical: string,
) {
  const canonicalCounts = new Map<string, number>();
  for (const run of runs) {
    const canonical = canonicalizeService(run.recommended_service || run.service_phrase);
    if (!canonical) continue;
    canonicalCounts.set(canonical, (canonicalCounts.get(canonical) ?? 0) + 1);
  }

  let best:
    | {
        run: {
          recommended_service: string;
          service_phrase: string;
          confidence: number;
          rationale: string;
          alternative_phrases: string[];
        };
        score: number;
      }
    | null = null;
  for (const run of runs) {
    const canonical = canonicalizeService(run.recommended_service || run.service_phrase);
    if (!canonical) continue;
    const support = candidates.find((candidate) => canonicalizeService(candidate.service) === canonical);
    const specificity = getServiceSpecificity(canonical);
    const broad =
      isBroadServiceTerm(canonical, { vertical }) || getServiceSpecificity(canonical) <= 2;
    const agreement = canonicalCounts.get(canonical) ?? 0;
    const score =
      (support ? 2.2 : 0) +
      (support?.confidence ?? 0) +
      specificity * 0.35 +
      (broad ? -2.5 : 0) +
      agreement * 1.15 +
      run.confidence * 0.8;
    if (!best || score > best.score) {
      best = { run, score };
    }
  }

  return best?.run ?? runs[0];
}

function keepRawServicePhrase(input: string | null | undefined) {
  if (typeof input !== "string") return "";
  if (!input.trim()) return "";
  return input;
}

function pushUniquePhrase(target: string[], phrase: string | null | undefined) {
  const raw = keepRawServicePhrase(phrase);
  if (!raw) return;
  const exists = target.some((item) => item.trim().toLowerCase() === raw.trim().toLowerCase());
  if (exists) return;
  target.push(raw);
}

function isOpus48Model(model: string) {
  return /claude-opus-4-8/i.test(model);
}

function selectBestEvidenceBackedPhrase(args: {
  preferredPhrase: string;
  phraseCandidates: string[];
  evidence: ServiceEvidencePack;
}) {
  const preferred = keepRawServicePhrase(args.preferredPhrase);
  const pool: string[] = [];
  const push = (value: string) => {
    const raw = keepRawServicePhrase(value);
    if (!raw) return;
    if (pool.some((item) => item.trim().toLowerCase() === raw.trim().toLowerCase())) return;
    pool.push(raw);
  };
  push(preferred);
  for (const candidate of args.phraseCandidates) push(candidate);
  if (pool.length === 0) return preferred;

  const evidenceText = normalizeServiceText(
    [
      args.evidence.business_name,
      args.evidence.google_primary_category,
      args.evidence.google_categories.join(" "),
      args.evidence.google_service,
      args.evidence.fallback_service,
      args.evidence.gbp_description,
      args.evidence.website_signal_excerpt,
    ].join(" "),
  );

  const scorePhrase = (phrase: string) => {
    const normalized = normalizeServiceText(phrase);
    if (!normalized) return -999;
    const tokens = normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token.length > 2)
      .filter((token) => !PHRASE_TOKEN_STOPWORDS.has(token));
    const informativeTokenCount = Math.min(4, tokens.length);
    const overlapCount = Math.min(
      3,
      tokens.filter((token) => evidenceText.includes(token)).length,
    );
    const hasTypeNoun =
      /\b(shop|store|salon|barber|spa|clinic|studio|service|repair|school|agency|temple|church|market)\b/.test(
        normalized,
      );
    const genericPenalty =
      normalized === "service" || normalized === "services" || normalized === "local business"
        ? 4
        : 0;
    return informativeTokenCount * 0.7 + overlapCount * 1.15 + (hasTypeNoun ? 0.5 : 0) - genericPenalty;
  };

  let best = preferred || pool[0];
  let bestScore = scorePhrase(best);
  for (const candidate of pool) {
    const candidateScore = scorePhrase(candidate);
    if (candidateScore > bestScore + 0.25) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best || preferred;
}
