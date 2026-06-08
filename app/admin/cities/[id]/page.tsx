import { notFound } from "next/navigation";
import { getContentItemAdmin } from "@/lib/admin/content";
import { CityPageEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function AdminCityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getContentItemAdmin(id);
  if (!item || item.kind !== "city_page") notFound();
  return <CityPageEditor initial={item} />;
}
