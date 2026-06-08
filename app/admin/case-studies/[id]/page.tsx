import { notFound } from "next/navigation";
import { getContentItemAdmin } from "@/lib/admin/content";
import { CaseStudyEditor } from "./editor";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default async function AdminCaseStudyEditPage({ params }: RouteParams) {
  const { id } = await params;
  const item = await getContentItemAdmin(id);
  if (!item || item.kind !== "case_study") notFound();
  return <CaseStudyEditor initial={item} />;
}
