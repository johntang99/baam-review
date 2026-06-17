import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { VerticalKey } from "@/lib/audit/google/types";

interface ServiceResolutionLearningInput {
  audit_id: string;
  user_id: string;
  business_place_id?: string;
  gs_service?: string;
  bs_service?: string;
  cs_recommended_service?: string;
  cs_confidence?: number;
  cs_reason_codes?: string[];
  user_final_service?: string;
  user_final_vertical?: VerticalKey;
}

const TABLE = "audit_service_resolutions";
const SHADOW_TABLE = "audit_service_shadow_logs";
const UNKNOWN_TABLE = "audit_service_unknown_candidates";

interface ServiceAnalystShadowInput {
  audit_id: string;
  user_id: string;
  business_place_id?: string;
  user_final_vertical?: VerticalKey;
  user_final_service?: string;
  system_recommended_service?: string;
  system_confidence?: number;
  system_reason_codes?: string[];
  analyst_mode?: "distilled" | "llm";
  analyst_recommended_service?: string;
  analyst_confidence?: number;
}

interface UnknownServiceCandidateInput {
  user_id: string;
  business_place_id?: string;
  business_name?: string;
  inferred_vertical?: string;
  candidate_service: string;
  source_tag: string;
  confidence?: number;
  rationale?: string;
  evidence_excerpt?: string;
}

export async function logServiceResolutionLearning(
  input: ServiceResolutionLearningInput,
) {
  const supabase = createServiceClient();
  const recommendedService = input.cs_recommended_service ?? "";
  const finalService = input.user_final_service ?? "";
  const changedFromRecommended =
    Boolean(recommendedService) &&
    Boolean(finalService) &&
    normalize(recommendedService) !== normalize(finalService);

  const row = {
    audit_id: input.audit_id,
    user_id: input.user_id,
    business_place_id: input.business_place_id ?? null,
    gs_service: input.gs_service ?? null,
    bs_service: input.bs_service ?? null,
    cs_recommended_service: input.cs_recommended_service ?? null,
    cs_confidence:
      typeof input.cs_confidence === "number"
        ? Number(input.cs_confidence.toFixed(2))
        : null,
    cs_reason_codes:
      input.cs_reason_codes && input.cs_reason_codes.length > 0
        ? input.cs_reason_codes
        : [],
    user_final_service: input.user_final_service ?? null,
    user_final_vertical: input.user_final_vertical ?? null,
    changed_from_recommended: changedFromRecommended,
    created_at: new Date().toISOString(),
  };

  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => Promise<{
        error: { code?: string; message: string } | null;
      }>;
    };
  })
    .from(TABLE)
    .insert(row);

  if (!error) return;

  // Keep V1 flow non-blocking while V2 table rolls out.
  if (error.code === "42P01" || error.message.includes(TABLE)) {
    return;
  }
  console.warn("[service-learning] insert failed:", error.message);
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function logServiceAnalystShadow(input: ServiceAnalystShadowInput) {
  const analystService = input.analyst_recommended_service ?? "";
  const systemService = input.system_recommended_service ?? "";
  if (!analystService.trim() || !systemService.trim()) {
    return;
  }

  const supabase = createServiceClient();
  const userFinal = input.user_final_service ?? "";
  const agreesWithSystem = normalize(analystService) === normalize(systemService);
  const matchesUserFinalSystem =
    Boolean(userFinal.trim()) && normalize(systemService) === normalize(userFinal);
  const matchesUserFinalAnalyst =
    Boolean(userFinal.trim()) && normalize(analystService) === normalize(userFinal);

  const row = {
    audit_id: input.audit_id,
    user_id: input.user_id,
    business_place_id: input.business_place_id ?? null,
    user_final_vertical: input.user_final_vertical ?? null,
    user_final_service: input.user_final_service ?? null,
    system_recommended_service: input.system_recommended_service ?? null,
    system_confidence:
      typeof input.system_confidence === "number"
        ? Number(input.system_confidence.toFixed(2))
        : null,
    system_reason_codes:
      input.system_reason_codes && input.system_reason_codes.length > 0
        ? input.system_reason_codes
        : [],
    analyst_mode: input.analyst_mode ?? null,
    analyst_recommended_service: input.analyst_recommended_service ?? null,
    analyst_confidence:
      typeof input.analyst_confidence === "number"
        ? Number(input.analyst_confidence.toFixed(2))
        : null,
    agrees_with_system: agreesWithSystem,
    matches_user_final_system: matchesUserFinalSystem,
    matches_user_final_analyst: matchesUserFinalAnalyst,
    created_at: new Date().toISOString(),
  };

  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => Promise<{
        error: { code?: string; message: string } | null;
      }>;
    };
  })
    .from(SHADOW_TABLE)
    .insert(row);

  if (!error) return;
  if (error.code === "42P01" || error.message.includes(SHADOW_TABLE)) {
    return;
  }
  console.warn("[service-analyst-shadow] insert failed:", error.message);
}

export async function logUnknownServiceCandidate(input: UnknownServiceCandidateInput) {
  const candidateService = normalize(input.candidate_service);
  const sourceTag = normalize(input.source_tag);
  if (!candidateService || !sourceTag) return;

  const supabase = createServiceClient();
  const row = {
    user_id: input.user_id,
    business_place_id: input.business_place_id ?? null,
    business_name: input.business_name?.trim() || null,
    inferred_vertical: input.inferred_vertical?.trim() || null,
    candidate_service: candidateService,
    source_tag: sourceTag,
    confidence:
      typeof input.confidence === "number"
        ? Number(input.confidence.toFixed(2))
        : null,
    rationale: input.rationale?.trim() || null,
    evidence_excerpt: input.evidence_excerpt?.trim().slice(0, 1200) || null,
    reviewed: false,
    created_at: new Date().toISOString(),
  };

  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      upsert: (
        payload: Record<string, unknown>,
        options: { onConflict: string; ignoreDuplicates: boolean },
      ) => Promise<{
        error: { code?: string; message: string } | null;
      }>;
    };
  })
    .from(UNKNOWN_TABLE)
    .upsert(row, {
      onConflict: "user_id,business_place_id,candidate_service,source_tag",
      ignoreDuplicates: true,
    });

  if (!error) return;
  if (error.code === "42P01" || error.message.includes(UNKNOWN_TABLE)) {
    return;
  }
  console.warn("[service-unknown-candidate] upsert failed:", error.message);
}
