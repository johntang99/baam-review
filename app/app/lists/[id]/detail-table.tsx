"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Mail,
  MessageSquare,
  RotateCw,
  CircleX,
  ExternalLink,
} from "lucide-react";
import { relativeTime } from "@/lib/analytics/aggregate";
import { createClient } from "@/lib/supabase/client";
import { resendToCustomers } from "../actions";

export interface DetailCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  language: string;
  channel: "email" | "sms";
  status: string;
  notes: string;
  lastActionLabel: string;
  lastActionAt: string | null;
  eligible: boolean;
  daysToWait: number | null;
}

type Pill =
  | "all"
  | "reviewed"
  | "clicked"
  | "opened"
  | "notopened"
  | "issues"
  | "eligible";

const PILLS: { id: Pill; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reviewed", label: "Reviewed" },
  { id: "clicked", label: "Clicked, no review" },
  { id: "opened", label: "Opened, no click" },
  { id: "notopened", label: "Not opened" },
  { id: "issues", label: "Issues" },
];

const LANG_PILL: Record<string, { text: string; cls: string }> = {
  en: { text: "EN", cls: "bg-success-soft text-success" },
  zh: { text: "中文", cls: "bg-alert-soft text-alert" },
  es: { text: "ES", cls: "bg-warn-soft text-warn" },
};

const PAGE_SIZE = 50;

function pillOf(status: string): Pill | "other" {
  if (status === "reviewed") return "reviewed";
  if (status === "clicked") return "clicked";
  if (status === "opened") return "opened";
  if (status === "sent" || status === "delivered") return "notopened";
  if (status === "bounced" || status === "optout") return "issues";
  return "other";
}

export function DetailTable({
  listId,
  locationId,
  initialFilter,
  rows,
}: {
  listId: string;
  locationId: string;
  initialFilter: Pill;
  rows: DetailCustomer[];
}) {
  const router = useRouter();
  const [pill, setPill] = useState<Pill>(initialFilter);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [resending, startResend] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  // PG8 — best-effort realtime. Refreshes the server component when any
  // list_customers row for this list changes (webhook lifecycle, resend).
  // Degrades to a no-op if realtime isn't enabled on the project.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`list-${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_customers",
          filter: `list_id=eq.${listId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [listId, router]);

  const counts = useMemo(() => {
    const c: Record<Pill, number> = {
      all: rows.length,
      reviewed: 0,
      clicked: 0,
      opened: 0,
      notopened: 0,
      issues: 0,
      eligible: rows.filter((r) => r.eligible).length,
    };
    for (const r of rows) {
      const p = pillOf(r.status);
      if (p !== "other" && p !== "eligible") c[p] += 1;
    }
    return c;
  }, [rows]);

  const filtered =
    pill === "all"
      ? rows
      : pill === "eligible"
        ? rows.filter((r) => r.eligible)
        : rows.filter((r) => pillOf(r.status) === pill);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const selectableVisible = visible.filter(
    (r) => r.status !== "bounced" && r.status !== "optout",
  );
  const allSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((r) => selected.has(r.id));

  const selectedEligible = rows.filter(
    (r) => selected.has(r.id) && r.eligible,
  );

  function setFilter(p: Pill) {
    setPill(p);
    setPage(0);
  }
  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) selectableVisible.forEach((r) => n.delete(r.id));
      else selectableVisible.forEach((r) => n.add(r.id));
      return n;
    });
  }

  function doResend() {
    const ids = selectedEligible.map((r) => r.id);
    if (ids.length === 0) {
      setNotice("Select at least one resend-eligible customer.");
      return;
    }
    setNotice(null);
    startResend(async () => {
      const res = await resendToCustomers(listId, ids);
      if (res.ok) {
        setSelected(new Set());
        setNotice(
          `Resent to ${res.resent}${res.failed > 0 ? ` · ${res.failed} failed` : ""}.`,
        );
        router.refresh();
      } else {
        setNotice(res.error ?? res.errors?.[0] ?? "Resend failed.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border-base bg-paper overflow-hidden">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-border-base">
        <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 accent-forest"
          />
          {selected.size > 0 ? `${selected.size} selected` : "Select"}
        </label>
        <span className="h-4 w-px bg-border-base" />
        <div className="flex flex-wrap gap-1.5">
          {PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFilter(p.id)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                pill === p.id
                  ? "bg-ink text-cream border-ink"
                  : "bg-paper text-text-soft border-border-base hover:border-forest"
              }`}
            >
              {p.label}
              <span
                className={`ml-1.5 font-mono text-[10.5px] ${
                  pill === p.id ? "text-cream/60" : "text-text-muted"
                }`}
              >
                {counts[p.id]}
              </span>
            </button>
          ))}
          {counts.eligible > 0 && (
            <button
              type="button"
              onClick={() => setFilter("eligible")}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                pill === "eligible"
                  ? "bg-gold text-ink border-gold"
                  : "bg-gold-soft text-gold-dark border-gold hover:bg-gold hover:text-ink"
              }`}
            >
              Eligible for resend
              <span className="ml-1.5 font-mono text-[10.5px]">
                {counts.eligible}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="w-10 px-3.5 py-3 border-b border-border-base" />
              <th className="px-3.5 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Customer
              </th>
              <th className="px-3.5 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Channel / Lang
              </th>
              <th className="px-3.5 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Status
              </th>
              <th className="px-3.5 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Last action
              </th>
              <th className="w-[160px] px-3.5 py-3 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-[13.5px] text-text-soft"
                >
                  No customers in this view.
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const terminal =
                  r.status === "bounced" || r.status === "optout";
                const lang = LANG_PILL[r.language] ?? LANG_PILL.en;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-border-soft last:border-b-0 ${
                      r.eligible ? "bg-gold/[0.05]" : ""
                    }`}
                  >
                    <td className="px-3.5 py-3.5 align-top">
                      <input
                        type="checkbox"
                        disabled={terminal}
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 accent-forest disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      <div className="font-medium text-ink">{r.name}</div>
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-soft">
                        {r.channel === "sms" ? (
                          <MessageSquare className="h-3 w-3" />
                        ) : (
                          <Mail className="h-3 w-3" />
                        )}
                        {r.channel === "sms" ? "SMS" : "Email"}
                      </span>
                      <span
                        className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium ${lang.cls}`}
                      >
                        {lang.text}
                      </span>
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      <div className="text-[13px] text-text">
                        {r.lastActionLabel}
                      </div>
                      {r.lastActionAt && (
                        <div className="text-[11.5px] text-text-muted mt-0.5">
                          {relativeTime(r.lastActionAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      {r.status === "reviewed" ? (
                        <Link
                          href={`/app/locations/${locationId}/reviews`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-success px-2.5 py-1.5 text-[12px] font-medium text-success hover:bg-success hover:text-cream"
                        >
                          View review
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : terminal ? (
                        <button
                          type="button"
                          disabled
                          className="rounded-md border border-border-base px-2.5 py-1.5 text-[12px] font-medium text-text-muted opacity-60"
                        >
                          {r.status === "bounced"
                            ? "Fix email first"
                            : "Opted out"}
                        </button>
                      ) : r.eligible ? (
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[12px] font-medium ${
                            selected.has(r.id)
                              ? "bg-gold text-ink border-gold"
                              : "bg-gold-soft text-gold-dark border-gold hover:bg-gold hover:text-ink"
                          }`}
                        >
                          <RotateCw className="h-3 w-3" />
                          {selected.has(r.id) ? "Selected" : "Resend"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="rounded-md border border-border-base px-2.5 py-1.5 text-[12px] font-medium text-text-muted opacity-60"
                        >
                          {r.daysToWait && r.daysToWait > 0
                            ? `Wait ${r.daysToWait} more day${r.daysToWait === 1 ? "" : "s"}`
                            : "Not eligible"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION (PG8) */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-base text-[12.5px] text-text-soft">
          <span>
            {safePage * PAGE_SIZE + 1}–
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-border-base px-2.5 py-1 font-medium disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-1 font-mono">
              {safePage + 1}/{pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-md border border-border-base px-2.5 py-1 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* BULK RESEND BAR (PG6) */}
      {(selected.size > 0 || notice) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-base bg-cream-deep/40 px-5 py-3">
          <div className="text-[12.5px] text-text-soft">
            <strong className="text-ink font-semibold">
              {selected.size}
            </strong>{" "}
            selected ·{" "}
            <strong className="text-gold-dark font-semibold">
              {selectedEligible.length}
            </strong>{" "}
            resend-eligible
            {notice && (
              <span className="block mt-0.5 text-forest">{notice}</span>
            )}
          </div>
          <button
            type="button"
            disabled={resending || selectedEligible.length === 0}
            onClick={doResend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
          >
            <RotateCw
              className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`}
            />
            {resending
              ? "Resending…"
              : `Resend to ${selectedEligible.length} selected`}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon?: boolean }> = {
    reviewed: {
      label: "Reviewed",
      cls: "bg-success-soft text-success",
      icon: true,
    },
    clicked: { label: "Clicked, no review", cls: "bg-warn-soft text-warn" },
    opened: { label: "Opened", cls: "bg-sage/25 text-forest-light" },
    delivered: { label: "Not opened", cls: "bg-cream-deep text-text-soft" },
    sent: { label: "Not opened", cls: "bg-cream-deep text-text-soft" },
    bounced: { label: "Bounced", cls: "bg-alert-soft text-alert", icon: true },
    optout: { label: "Opted out", cls: "bg-text-muted/20 text-text-muted" },
    pending: { label: "Not sent", cls: "bg-cream-deep text-text-muted" },
    excluded: { label: "Excluded", cls: "bg-cream-deep text-text-muted" },
  };
  const v = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${v.cls}`}
    >
      {v.icon &&
        (status === "reviewed" ? (
          <Check className="h-3 w-3" />
        ) : (
          <CircleX className="h-3 w-3" />
        ))}
      {v.label}
    </span>
  );
}
