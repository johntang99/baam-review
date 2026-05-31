"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGoogleBusinessData } from "@/lib/audit/google";
import { getCompetitorsData } from "@/lib/audit/competitors";
import { getBenchmarksForBusiness } from "@/lib/audit/benchmarks";
import { computeAuditScore } from "@/lib/audit/scoring";
import { computeProjection } from "@/lib/audit/projection";
import { renderAndDeliverAudit } from "@/lib/audit/delivery";
import {
  canUserAudit,
  decrementAuditCount,
  incrementAuditCount,
} from "@/lib/audit/quotas";

export interface RunAuditResult {
  ok: boolean;
  audit_id?: string;
  error?: string;
}

export async function runAudit(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    redirect("/login?next=/audit/new");
  }

  const rawInput = String(formData.get("business") ?? "").trim();
  if (!rawInput) {
    redirect("/audit/new?error=empty");
  }

  const quota = await canUserAudit(user.id);
  if (!quota.allowed) {
    const reason = quota.reason ?? "quota";
    redirect(`/audit/new?error=${reason}`);
  }

  const ref = parseBusinessReference(rawInput);

  let auditId: string;

  await incrementAuditCount(user.id);

  try {
    const google = await getGoogleBusinessData(ref, "paid");
    const competitors = await getCompetitorsData(google, "paid");
    const benchmarks = await getBenchmarksForBusiness(google);
    const score = computeAuditScore(google, competitors, benchmarks);
    const projection = computeProjection(google, competitors, score, benchmarks);

    const result = await renderAndDeliverAudit({
      google,
      competitors,
      score,
      projection,
      benchmarks,
      customer: { user_id: user.id, email: user.email ?? "" },
      send_email: false,
    });

    auditId = result.audit_id;
  } catch (err) {
    await decrementAuditCount(user.id).catch(() => {});
    const message = err instanceof Error ? err.message : "Unknown error";
    redirect(`/audit/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/audits");
  redirect(`/audit/${auditId}`);
}

function parseBusinessReference(input: string): { placeId?: string; textQuery?: string } {
  if (/^ChIJ[\w-]{20,}/.test(input)) {
    return { placeId: input };
  }

  const fromUrl = extractPlaceIdFromMapsUrl(input);
  if (fromUrl) return { placeId: fromUrl };

  return { textQuery: stripGoogleMapsUrl(input) };
}

function extractPlaceIdFromMapsUrl(input: string): string | null {
  const match = input.match(/!1s0x[0-9a-f]+:0x[0-9a-f]+/i);
  if (match) return null;
  return null;
}

function stripGoogleMapsUrl(input: string): string {
  if (!/^https?:\/\//.test(input)) return input;
  try {
    const url = new URL(input);
    const placeSegment = url.pathname.match(/\/place\/([^/]+)/);
    if (placeSegment?.[1]) {
      return decodeURIComponent(placeSegment[1].replace(/\+/g, " "));
    }
    return url.searchParams.get("q") ?? input;
  } catch {
    return input;
  }
}
