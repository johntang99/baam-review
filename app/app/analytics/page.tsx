import Link from "next/link";
import { AlertTriangle, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Breakdown } from "@/components/admin/breakdown";
import {
  buildFunnel,
  countBy,
  pctFormat,
  relativeTime,
  PLATFORM_LABEL,
  LANGUAGE_LABEL,
  sourceLabel,
} from "@/lib/analytics/aggregate";
import { Funnel } from "@/components/admin/funnel";

export const metadata = {
  title: "Analytics — BAAM Review",
};

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, display_name, slug");
  const locById = new Map((locations ?? []).map((l) => [l.id, l]));

  const { data: requests } = await supabase
    .from("review_requests")
    .select(
      "id, recipient_name, language, channel, sent_at, delivered_at, clicked_at, completed_platform, completed_at, created_at, location_id, flagged_at, flag_reason",
    )
    .gte("created_at", sinceIso);

  const { data: pageViews } = await supabase
    .from("landing_events")
    .select("metadata, location_id, occurred_at")
    .eq("event_type", "page_view")
    .gte("occurred_at", sinceIso);

  const { data: embedLoads } = await supabase
    .from("embed_loads")
    .select("origin_url, occurred_at, location_id")
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: false });

  const rs = requests ?? [];
  const pv = pageViews ?? [];

  const sent = rs.filter((r) => r.sent_at).length;
  const delivered = rs.filter((r) => r.delivered_at).length;
  const clicked = rs.filter((r) => r.clicked_at).length;
  const completed = rs.filter((r) => r.completed_at).length;

  const funnel = buildFunnel([
    { key: "sent", label: "Sent", count: sent },
    { key: "delivered", label: "Delivered", count: delivered },
    { key: "clicked", label: "Clicked", count: clicked },
    { key: "completed", label: "Completed", count: completed },
  ]);

  const byChannel = countBy(rs, (r) => r.channel, (k) => k.toUpperCase());
  const byPlatform = countBy(
    rs.filter((r) => r.completed_platform),
    (r) => r.completed_platform ?? null,
    (k) => PLATFORM_LABEL[k] ?? k,
  );
  const byLanguage = countBy(
    rs,
    (r) => r.language,
    (k) => LANGUAGE_LABEL[k] ?? k,
  );
  const byLocation = countBy(
    rs,
    (r) => r.location_id,
    (id) => locById.get(id)?.display_name ?? "—",
  );

  const bySource = countBy(
    pv,
    (e) => {
      const m = (e.metadata ?? {}) as { source?: string };
      return m.source ?? "direct";
    },
    (k) => sourceLabel(k === "direct" ? null : k),
  );

  const byEmbedOrigin = countBy(
    embedLoads ?? [],
    (e) => {
      try {
        if (!e.origin_url) return "(no referrer)";
        return new URL(e.origin_url).host;
      } catch {
        return e.origin_url ?? "(no referrer)";
      }
    },
  );

  const flagged = rs.filter((r) => r.flagged_at);

  return (
    <main className="px-10 py-10 space-y-8">
      <div className="flex items-start justify-between gap-6">
        <PageHeader
          eyebrow="Analytics"
          title="Last 90 days"
          description="Deeper view: per-location performance, traffic sources, embed origins, velocity flags."
        />
        <Link
          href="/app/analytics/advocates"
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-full border border-border-base bg-paper px-4 py-2 text-[13px] font-medium text-text transition-colors hover:bg-hover"
        >
          <Trophy className="h-3.5 w-3.5 text-gold" />
          Best advocates
        </Link>
      </div>

      <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] text-ink">Funnel</h2>
          <p className="text-[12px] text-text-muted">
            Overall completion {sent === 0 ? "—" : pctFormat(completed / sent)}
          </p>
        </div>
        <Funnel steps={funnel} topCount={sent} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Breakdown
          title="By location"
          rows={byLocation}
          emptyMessage="No requests yet."
        />
        <Breakdown
          title="By language"
          rows={byLanguage}
          emptyMessage="No requests yet."
        />
        <Breakdown
          title="By channel"
          rows={byChannel}
          emptyMessage="No requests yet."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Breakdown
          title="Completed reviews by platform"
          rows={byPlatform}
          emptyMessage="No completions yet."
        />
        <Breakdown
          title="Public page sources"
          rows={bySource}
          emptyMessage="No public page visits yet."
        />
        <Breakdown
          title="Embed origins"
          rows={byEmbedOrigin}
          emptyMessage="Embed snippet not loaded anywhere yet."
        />
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] text-ink">Flagged requests</h2>
          <p className="text-[12px] text-text-muted">
            Sends that exceeded the velocity threshold. Reviewer should confirm these were
            legitimate before continuing to send at this rate.
          </p>
        </div>
        {flagged.length === 0 ? (
          <p className="text-[13px] text-text-muted italic">
            None — all good. Velocity caps fire at 20/hr or 100/day per location.
          </p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {flagged.slice(0, 25).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 py-2.5"
              >
                <AlertTriangle className="h-4 w-4 text-warn flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[13.5px] text-ink truncate">
                    {r.recipient_name}
                  </p>
                  <p className="text-[11.5px] text-text-muted">
                    {locById.get(r.location_id)?.display_name ?? "—"} ·{" "}
                    {r.flag_reason ?? "flagged"}
                  </p>
                </div>
                <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                  {relativeTime(r.flagged_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {embedLoads && embedLoads.length > 0 && (
        <section className="rounded-2xl border border-border-base bg-paper p-6 space-y-3">
          <h2 className="font-display text-[18px] text-ink">Recent embed loads</h2>
          <ul className="divide-y divide-border-soft text-[13px]">
            {embedLoads.slice(0, 10).map((e, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-text">
                  {e.origin_url ?? "(no referrer)"}
                </span>
                <span className="text-[11.5px] text-text-muted whitespace-nowrap">
                  {locById.get(e.location_id)?.display_name ?? "—"}
                </span>
                <span className="w-16 text-right text-[11.5px] text-text-muted whitespace-nowrap">
                  {relativeTime(e.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
