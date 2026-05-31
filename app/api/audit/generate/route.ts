import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runAuditPipeline,
  startAuditGeneration,
} from "@/lib/audit/delivery/start-audit";
import { canUserAudit, incrementAuditCount } from "@/lib/audit/quotas";
import { VERTICAL_KEYS, type VerticalKey } from "@/lib/audit/google/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  const serviceOverride = (body.service_override ?? "").trim() || undefined;

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
    service_override: serviceOverride,
  };

  const result = await startAuditGeneration(pipelineInput);

  // Run the heavy pipeline AFTER the response is sent. Works in
  // serverless (Vercel keeps the function alive until after() callbacks
  // resolve, up to maxDuration) and in long-running Node servers.
  after(async () => {
    await runAuditPipeline(result.audit_id, pipelineInput);
  });

  return NextResponse.json({ audit_id: result.audit_id });
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
  const trimmed = input.trim() as VerticalKey;
  return (VERTICAL_KEYS as readonly string[]).includes(trimmed) ? trimmed : undefined;
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
