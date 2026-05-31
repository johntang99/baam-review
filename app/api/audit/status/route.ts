import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusRow {
  id: string;
  status: "generating" | "complete" | "failed";
  progress_stage: number;
  failed_reason: string | null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("audits")
    .select("id,status,progress_stage,failed_reason")
    .eq("id", id)
    .maybeSingle<StatusRow>();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    audit_id: data.id,
    status: data.status,
    stage: data.progress_stage,
    failed_reason: data.failed_reason,
  });
}
