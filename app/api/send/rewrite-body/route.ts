import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rewriteReviewRequestBody,
  type RewriteLang,
  type RewriteTone,
} from "@/lib/ai/rewrite-body";

const TONES: ReadonlySet<RewriteTone> = new Set([
  "warm",
  "brief",
  "professional",
  "casual",
]);
const LANGS: ReadonlySet<RewriteLang> = new Set(["en", "zh", "es"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    currentBody?: string;
    currentSubject?: string;
    businessName?: string;
    language?: string;
    tone?: string;
    channel?: string;
    /** Single-send only: the recipient's name from the form. When provided,
     * the API substitutes {name} → first name before returning so the
     * preview shows the actual recipient's name, not the placeholder.
     * For bulk list-variant generation this is omitted — the placeholder
     * must survive so it can be substituted per-customer at send time. */
    recipientName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const {
    currentBody,
    currentSubject,
    businessName,
    language,
    tone,
    channel,
    recipientName,
  } = body;

  if (
    typeof currentBody !== "string" ||
    typeof businessName !== "string" ||
    !currentBody ||
    !businessName ||
    typeof language !== "string" ||
    !LANGS.has(language as RewriteLang) ||
    typeof tone !== "string" ||
    !TONES.has(tone as RewriteTone) ||
    (channel !== "email" && channel !== "sms")
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid fields" },
      { status: 400 },
    );
  }

  const result = await rewriteReviewRequestBody({
    currentBody,
    currentSubject:
      typeof currentSubject === "string" ? currentSubject : undefined,
    businessName,
    language: language as RewriteLang,
    tone: tone as RewriteTone,
    channel,
  });

  // Substitute {name} → recipient's first name for single-send callers.
  // Bulk list-variant generation omits recipientName so the placeholder
  // survives the round-trip and gets expanded per-customer at send time.
  if (result.ok && typeof recipientName === "string" && recipientName.trim()) {
    const first =
      recipientName.trim().split(/\s+/)[0] || recipientName.trim();
    if (result.body) result.body = result.body.replaceAll("{name}", first);
    if (result.subject)
      result.subject = result.subject.replaceAll("{name}", first);
  }

  return NextResponse.json(result);
}
