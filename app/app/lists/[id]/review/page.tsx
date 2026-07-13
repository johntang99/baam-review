import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  isFullServiceCustomerReadOnly,
  getInternalContext,
  getVisibleLocationIds,
} from "@/lib/auth/staff";
import { PresendTable, type PresendCustomer } from "./presend-table";
import { type ListVariant } from "./variants-panel";
import { ComposePanels } from "./compose-panels";
import { ReviewProgressBar } from "./review-progress-bar";
import type { Language } from "@/lib/i18n/review";

export const metadata = { title: "Review & send — BAAM Review" };
export const dynamic = "force-dynamic";

const LANG_LABEL: Record<string, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/lists/${id}/review`);

  const readOnly = await isFullServiceCustomerReadOnly(supabase, user.id);

  // Internal staff read across accounts via the service client (gated below);
  // customers stay on the RLS-bound user client (own account only).
  const internal = await getInternalContext(supabase, user.id);
  const visibleIds = await getVisibleLocationIds(supabase, internal);
  const db = internal ? createServiceClient() : supabase;

  const { data: list } = await db
    .from("lists")
    .select(
      "id, name, status, default_language, customer_count, created_at, location_id, template_variants",
    )
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();
  // Internal non-admins (sales/account_manager) may only open their locations.
  if (internal && visibleIds && !visibleIds.includes(list.location_id)) notFound();

  const [{ data: location }, { data: customers }] = await Promise.all([
    db
      .from("locations")
      .select("display_name")
      .eq("id", list.location_id)
      .maybeSingle(),
    db
      .from("list_customers")
      .select(
        "id, name, email, phone, language, channel, visit_date, notes, status, selected, excluded_reason",
      )
      .eq("list_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const rows: PresendCustomer[] = (customers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    language: c.language,
    channel: c.channel,
    visitDate: c.visit_date,
    notes: c.notes ?? "",
    status: c.status,
    selected: c.selected,
    excludedReason: c.excluded_reason,
  }));

  return (
    <main className="px-10 py-8 pb-32 max-w-[1280px]">
      <div className="flex items-center justify-between mb-7">
        <Link
          href="/app/lists"
          className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.04em] text-text-muted font-medium hover:text-ink"
        >
          <ChevronLeft className="h-3 w-3" />
          Lists / {list.name} / <span className="text-ink">Review &amp; send</span>
        </Link>
      </div>

      {(() => {
        const sentCount = rows.filter(
          (r) => r.status === "sent" && !r.excludedReason,
        ).length;
        const pendingCount = rows.filter(
          (r) => r.status === "pending" && r.selected && !r.excludedReason,
        ).length;
        const current: 2 | 3 = sentCount > 0 ? 3 : 2;
        const allDone = sentCount > 0 && pendingCount === 0;
        return <ReviewProgressBar current={current} allDone={allDone} />;
      })()}

      <div className="mb-7">
        <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-ink">
          Bulk Review Requests
        </h1>
      </div>

      {/* META BAR */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border-base bg-paper px-6 py-4 mb-6 text-[13px] text-text-soft">
        <span>
          List: <strong className="text-ink font-medium">{list.name}</strong>
        </span>
        <span className="h-3 w-px bg-border-base" />
        <span>
          Client:{" "}
          <strong className="text-ink font-medium">
            {location?.display_name ?? "—"}
          </strong>
        </span>
        <span className="h-3 w-px bg-border-base" />
        <span>
          Imported:{" "}
          <strong className="text-ink font-medium">
            {rows.length} customers
          </strong>
        </span>
        <span className="h-3 w-px bg-border-base" />
        <span>
          Default lang:{" "}
          <strong className="text-ink font-medium">
            {LANG_LABEL[list.default_language] ?? list.default_language}
          </strong>
        </span>
      </div>

      {(() => {
        const pendingSelected = rows.filter(
          (r) => r.selected && !r.excludedReason && r.status === "pending",
        );
        const initialChannel: "email" | "sms" =
          pendingSelected.length > 0 &&
          pendingSelected.every((r) => r.channel === "sms")
            ? "sms"
            : "email";
        const language = (list.default_language ?? "en") as Language;
        const initialVariants = Array.isArray(list.template_variants)
          ? (list.template_variants as unknown as ListVariant[])
          : null;
        return (
          <ComposePanels
            listId={list.id}
            language={language}
            businessName={location?.display_name ?? "your business"}
            initialVariants={initialVariants}
            initialChannel={initialChannel}
            readOnly={readOnly}
          />
        );
      })()}

      <PresendTable
        listId={list.id}
        initialRows={rows}
        readOnly={readOnly}
      />
    </main>
  );
}
