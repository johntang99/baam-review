import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isFullServiceCustomerReadOnly } from "@/lib/auth/staff";
import { PresendTable, type PresendCustomer } from "./presend-table";
import { VariantsPanel, type ListVariant } from "./variants-panel";
import { DefaultContentPanel } from "./default-content-panel";
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

  const { data: list } = await supabase
    .from("lists")
    .select(
      "id, name, status, default_language, customer_count, created_at, location_id, template_variants",
    )
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const [{ data: location }, { data: customers }] = await Promise.all([
    supabase
      .from("locations")
      .select("display_name")
      .eq("id", list.location_id)
      .maybeSingle(),
    supabase
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
        const channel: "email" | "sms" =
          rows.some((r) => r.channel === "sms") &&
          !rows.some((r) => r.channel === "email")
            ? "sms"
            : "email";
        const language = (list.default_language ?? "en") as Language;
        const initialVariants = Array.isArray(list.template_variants)
          ? (list.template_variants as unknown as ListVariant[])
          : null;
        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 mb-12">
              <DefaultContentPanel
                language={language}
                channel={channel}
                businessName={location?.display_name ?? "your business"}
              />
              <VariantsPanel
                listId={list.id}
                initialVariants={initialVariants}
                channel={channel}
                readOnly={readOnly}
              />
            </div>
          </>
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
