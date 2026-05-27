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
    businessName?: string;
    language?: string;
    tone?: string;
    channel?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { currentBody, businessName, language, tone, channel } = body;

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
    businessName,
    language: language as RewriteLang,
    tone: tone as RewriteTone,
    channel,
  });

  return NextResponse.json(result);
}
