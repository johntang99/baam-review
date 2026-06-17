import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runAuditPipeline,
  startAuditGeneration,
} from "@/lib/audit/delivery/start-audit";
import { canUserAudit, incrementAuditCount } from "@/lib/audit/quotas";
import { VERTICAL_KEYS, type VerticalKey } from "@/lib/audit/google/types";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";
import { canonicalizeService, getServiceSpecificity } from "@/lib/audit/service-taxonomy";
import {
  logServiceAnalystShadow,
  logServiceResolutionLearning,
} from "@/lib/audit/service-learning";

export const runtime = "nodejs";
// Paid (Outscraper) scrapes of the business + ~7 competitors can legitimately
// take a couple of minutes; 120s occasionally killed the function mid-run,
// leaving the audit stuck on "generating" forever. 300s (matches the
// sync-reviews cron) gives the pipeline room to finish.
export const maxDuration = 300;

const INDUSTRY_ALIAS_TO_VERTICAL: Record<string, VerticalKey> = {
  manufacturer_industrial: "contractor",
  optometry_vision: "general_smb",
};

interface GenerateRequest {
  /** Free-form business identifier (URL, text query, place_id). Used
   *  when the user skipped the confirm step (legacy path). */
  business?: string;
  /** Confirmed place_id from /api/audit/resolve. Preferred. */
  place_id?: string;
  /** User-confirmed industry override (one of our 14 verticals). */
  vertical_override?: string;
  /** User-confirmed main-service keyword (e.g. "bridal boutique"). */
  service_override?: string;
  /** Report-language choice from the intake form. "auto" defers to the
   *  language router (Chinese businesses → both, else English). */
  language_choice?: "auto" | "en" | "zh" | "both";
  /** V1 gate: user must explicitly confirm service before generation. */
  service_confirmed?: boolean;
  /** V2 learning payload from reconcile step. */
  gs_service?: string;
  bs_service?: string;
  cs_recommended_service?: string;
  cs_confidence?: number;
  cs_reason_codes?: string[];
  needs_service_selection?: boolean;
  service_options?: string[];
  service_shadow?: {
    enabled?: boolean;
    mode?: "distilled" | "llm";
    recommended_service?: string;
    confidence?: number;
    agrees_with_system?: boolean;
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!auth.user.email_confirmed_at) {
    return NextResponse.json(
      { error: "email_not_verified" },
      { status: 403 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const businessRef = buildBusinessRef(body);
  if (!businessRef) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const verticalOverride = parseVerticalOverride(body.vertical_override);
  const serviceOverrideRaw = (body.service_override ?? "").trim();
  const serviceOverride = serviceOverrideRaw || undefined;
  const serviceConfirmed = body.service_confirmed === true;

  if (!serviceConfirmed) {
    return NextResponse.json(
      { error: "service_confirmation_required" },
      { status: 400 },
    );
  }
  if (!serviceOverride) {
    return NextResponse.json(
      { error: "specific_service_required" },
      { status: 400 },
    );
  }

  const canonicalServiceOverride = canonicalizeService(serviceOverride);
  if (isBroadServiceSelection(canonicalServiceOverride, verticalOverride)) {
    return NextResponse.json(
      { error: "specific_service_required" },
      { status: 400 },
    );
  }

  const needsServiceSelection = body.needs_service_selection === true;
  const allowedServiceOptions = (Array.isArray(body.service_options) ? body.service_options : [])
    .map((item) => (typeof item === "string" ? canonicalizeService(item) : ""))
    .filter(Boolean);
  if (
    needsServiceSelection &&
    allowedServiceOptions.length > 0 &&
    !allowedServiceOptions.includes(canonicalServiceOverride)
  ) {
    return NextResponse.json(
      { error: "specific_service_selection_required" },
      { status: 400 },
    );
  }

  const quota = await canUserAudit(auth.user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason ?? "quota_exceeded" },
      { status: 429 },
    );
  }

  await incrementAuditCount(auth.user.id);

  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", auth.user.id)
    .maybeSingle<{ full_name: string | null }>();

  const pipelineInput = {
    business_ref: businessRef,
    user_id: auth.user.id,
    email: auth.user.email ?? "",
    name: profile?.full_name ?? undefined,
    vertical_override: verticalOverride,
    service_override: canonicalServiceOverride,
    language_choice: body.language_choice,
  };

  const result = await startAuditGeneration(pipelineInput);

  await logServiceResolutionLearning({
    audit_id: result.audit_id,
    user_id: auth.user.id,
    business_place_id: body.place_id?.trim() || undefined,
    gs_service: (body.gs_service ?? "").trim() || undefined,
    bs_service: (body.bs_service ?? "").trim() || undefined,
    cs_recommended_service:
      (body.cs_recommended_service ?? "").trim() || undefined,
    cs_confidence:
      typeof body.cs_confidence === "number" ? body.cs_confidence : undefined,
    cs_reason_codes: Array.isArray(body.cs_reason_codes)
      ? body.cs_reason_codes.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [],
    user_final_service: canonicalServiceOverride,
    user_final_vertical: verticalOverride,
  });
  await logServiceAnalystShadow({
    audit_id: result.audit_id,
    user_id: auth.user.id,
    business_place_id: body.place_id?.trim() || undefined,
    user_final_vertical: verticalOverride,
    user_final_service: canonicalServiceOverride,
    system_recommended_service:
      (body.cs_recommended_service ?? "").trim() || undefined,
    system_confidence:
      typeof body.cs_confidence === "number" ? body.cs_confidence : undefined,
    system_reason_codes: Array.isArray(body.cs_reason_codes)
      ? body.cs_reason_codes.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [],
    analyst_mode:
      body.service_shadow?.mode === "distilled" || body.service_shadow?.mode === "llm"
        ? body.service_shadow.mode
        : undefined,
    analyst_recommended_service:
      (body.service_shadow?.recommended_service ?? "").trim() || undefined,
    analyst_confidence:
      typeof body.service_shadow?.confidence === "number"
        ? body.service_shadow.confidence
        : undefined,
  });

  // Run the heavy pipeline AFTER the response is sent. Works in
  // serverless (Vercel keeps the function alive until after() callbacks
  // resolve, up to maxDuration) and in long-running Node servers.
  after(async () => {
    await runAuditPipeline(result.audit_id, pipelineInput);
  });

  return NextResponse.json({ audit_id: result.audit_id });
}

function isBroadServiceSelection(service: string, vertical?: VerticalKey) {
  if (!service) return true;
  if (isBroadServiceTerm(service, { vertical })) return true;
  return getServiceSpecificity(service) <= 2;
}

function buildBusinessRef(
  body: GenerateRequest,
): { placeId?: string; textQuery?: string } | null {
  if (body.place_id?.trim()) return { placeId: body.place_id.trim() };
  const raw = (body.business ?? "").trim();
  if (!raw) return null;
  if (/^ChIJ[\w-]{20,}/.test(raw)) return { placeId: raw };
  const fromUrl = extractTextFromMapsUrl(raw);
  if (fromUrl) return { textQuery: fromUrl };
  return { textQuery: raw };
}

function parseVerticalOverride(input: string | undefined): VerticalKey | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  const aliased = INDUSTRY_ALIAS_TO_VERTICAL[trimmed] ?? trimmed;
  const normalized = aliased as VerticalKey;
  return (VERTICAL_KEYS as readonly string[]).includes(normalized)
    ? normalized
    : undefined;
}

function extractTextFromMapsUrl(input: string): string | null {
  if (!/^https?:\/\//.test(input)) return null;
  try {
    const url = new URL(input);
    const placeSegment = url.pathname.match(/\/place\/([^/]+)/);
    if (placeSegment?.[1]) {
      return decodeURIComponent(placeSegment[1].replace(/\+/g, " "));
    }
    return url.searchParams.get("q");
  } catch {
    return null;
  }
}
