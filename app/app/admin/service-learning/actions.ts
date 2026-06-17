"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getInternalContext } from "@/lib/auth/staff";
import { normalizeServiceText } from "@/lib/audit/service-taxonomy";

async function requireInternalAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/admin/service-learning");

  const internal = await getInternalContext(supabase, user.id);
  if (!internal || (internal.opsRole !== "admin" && internal.opsRole !== null)) {
    throw new Error("Only BAAM admins can promote unknown services.");
  }
  return user.id;
}

export async function promoteUnknownService(formData: FormData) {
  const userId = await requireInternalAdmin();
  const unknownId = String(formData.get("unknown_id") ?? "").trim();
  const canonicalService = normalizeServiceText(
    String(formData.get("canonical_service") ?? ""),
  );

  if (!unknownId || !canonicalService) {
    throw new Error("Missing unknown candidate id or canonical service.");
  }

  const service = createServiceClient();
  const { data: unknownRow, error: unknownErr } = await (service as unknown as {
    from: (table: string) => {
      select: (query: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              candidate_service: string;
              inferred_vertical: string | null;
            } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("audit_service_unknown_candidates")
    .select("id, candidate_service, inferred_vertical")
    .eq("id", unknownId)
    .maybeSingle();

  if (unknownErr || !unknownRow) {
    throw new Error(unknownErr?.message ?? "Unknown candidate not found.");
  }

  const row = {
    unknown_candidate_id: unknownRow.id,
    promoted_by: userId,
    candidate_service: normalizeServiceText(unknownRow.candidate_service),
    canonical_service: canonicalService,
    suggested_vertical: unknownRow.inferred_vertical,
    status: "pending",
    note: "Queued by admin from unknown-candidate review",
    updated_at: new Date().toISOString(),
  };
  const { error: promoteErr } = await (service as unknown as {
    from: (table: string) => {
      upsert: (
        payload: Record<string, unknown>,
        options: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("audit_service_taxonomy_promotions")
    .upsert(row, { onConflict: "unknown_candidate_id" });
  if (promoteErr) {
    throw new Error(promoteErr.message);
  }

  const { error: reviewErr } = await (service as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  })
    .from("audit_service_unknown_candidates")
    .update({
      reviewed: true,
      review_note: `promoted_to_taxonomy:${canonicalService}`,
    })
    .eq("id", unknownId);
  if (reviewErr) {
    throw new Error(reviewErr.message);
  }

  revalidatePath("/app/admin/service-learning");
}

export async function markPromotionAdded(formData: FormData) {
  await requireInternalAdmin();
  const promotionId = String(formData.get("promotion_id") ?? "").trim();
  if (!promotionId) {
    throw new Error("Missing promotion id.");
  }

  const service = createServiceClient();
  const { error } = await (service as unknown as {
    from: (table: string) => {
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  })
    .from("audit_service_taxonomy_promotions")
    .update({
      status: "added",
      note: "Added to taxonomy file",
      updated_at: new Date().toISOString(),
    })
    .eq("id", promotionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/admin/service-learning");
}
