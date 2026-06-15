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
