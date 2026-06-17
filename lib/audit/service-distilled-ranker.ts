import type { GeneratedServiceCandidate } from "@/lib/audit/service-candidate-generator";
import {
  canonicalizeService,
  getServiceSpecificity,
  isGenericServiceValue,
} from "@/lib/audit/service-taxonomy";

export type DistilledRankedCandidate = GeneratedServiceCandidate & {
  distilled_score: number;
  distilled_confidence: number;
  feature_breakdown: {
    candidate_score: number;
    candidate_confidence: number;
    specificity: number;
    source_diversity: number;
    generic_penalty: number;
    multi_source_specific_bonus: number;
  };
};

const DISTILLED_WEIGHTS = {
  candidateScore: 0.58,
  candidateConfidence: 0.32,
  specificity: 0.09,
  sourceDiversity: 0.05,
  genericPenalty: 0.22,
  specificMultiSourceBonus: 0.08,
} as const;

export function rankWithDistilledModel(
  candidates: GeneratedServiceCandidate[],
): DistilledRankedCandidate[] {
  return candidates
    .map((candidate) => {
      const service = canonicalizeService(candidate.service);
      const specificity = getServiceSpecificity(service);
      const sourceDiversity = Math.min(4, candidate.sources.length);
      const genericPenalty = isGenericServiceValue(service)
        ? DISTILLED_WEIGHTS.genericPenalty
        : 0;
      const multiSourceSpecificBonus =
        specificity >= 3 && sourceDiversity >= 2
          ? DISTILLED_WEIGHTS.specificMultiSourceBonus
          : 0;

      const score =
        candidate.score * DISTILLED_WEIGHTS.candidateScore +
        candidate.confidence * DISTILLED_WEIGHTS.candidateConfidence +
        specificity * DISTILLED_WEIGHTS.specificity +
        sourceDiversity * DISTILLED_WEIGHTS.sourceDiversity -
        genericPenalty +
        multiSourceSpecificBonus;

      const confidence = computeDistilledConfidence({
        baseConfidence: candidate.confidence,
        specificity,
        sourceDiversity,
        genericPenalty,
      });

      return {
        ...candidate,
        distilled_score: Number(score.toFixed(3)),
        distilled_confidence: confidence,
        feature_breakdown: {
          candidate_score: Number(
            (candidate.score * DISTILLED_WEIGHTS.candidateScore).toFixed(3),
          ),
          candidate_confidence: Number(
            (candidate.confidence * DISTILLED_WEIGHTS.candidateConfidence).toFixed(3),
          ),
          specificity: Number((specificity * DISTILLED_WEIGHTS.specificity).toFixed(3)),
          source_diversity: Number(
            (sourceDiversity * DISTILLED_WEIGHTS.sourceDiversity).toFixed(3),
          ),
          generic_penalty: Number((-genericPenalty).toFixed(3)),
          multi_source_specific_bonus: Number(multiSourceSpecificBonus.toFixed(3)),
        },
      };
    })
    .sort((a, b) => {
      if (b.distilled_score !== a.distilled_score)
        return b.distilled_score - a.distilled_score;
      if (b.distilled_confidence !== a.distilled_confidence)
        return b.distilled_confidence - a.distilled_confidence;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return b.service.length - a.service.length;
    });
}

export function pickDistilledTopCandidate(
  candidates: GeneratedServiceCandidate[],
): DistilledRankedCandidate | null {
  const ranked = rankWithDistilledModel(candidates);
  return ranked[0] ?? null;
}

function computeDistilledConfidence({
  baseConfidence,
  specificity,
  sourceDiversity,
  genericPenalty,
}: {
  baseConfidence: number;
  specificity: number;
  sourceDiversity: number;
  genericPenalty: number;
}) {
  let confidence = baseConfidence;
  confidence += Math.min(0.08, specificity * 0.01);
  confidence += Math.min(0.05, sourceDiversity * 0.012);
  confidence -= genericPenalty * 0.22;
  return Number(Math.max(0.45, Math.min(0.95, confidence)).toFixed(2));
}
