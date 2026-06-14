"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  X,
  Check,
  TriangleAlert,
  Clock,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { formatPhone } from "@/lib/lists/normalize";
import {
  updateListCustomer,
  saveListAsDraft,
  prepareGmailDraftsForList,
  getPreparedGmailDraftQueue,
} from "../../actions";

export interface PresendCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  language: string;
  channel: "email" | "sms";
  visitDate: string | null;
  notes: string;
  status: string;
  selected: boolean;
  excludedReason: string | null;
}

type Filter = "all" | "ready" | "excluded";

const LANG_PILL: Record<string, { text: string; cls: string }> = {
  en: { text: "EN", cls: "bg-success-soft text-success" },
  zh: { text: "中文", cls: "bg-alert-soft text-alert" },
  es: { text: "ES", cls: "bg-warn-soft text-warn" },
};

export function PresendTable({
  listId,
  initialRows,
  readOnly = false,
}: {
  listId: string;
  initialRows: PresendCustomer[];
  /** Full Service customers see the list as a showcase — no Send,
   * no Save-as-draft, no inline row edits. They're watching BAAM
   * staff's work, not operating it themselves. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();
  type SendNotice =
    | { kind: "billing" }
    | { kind: "generic"; message: string }
    | null;
  const [sendNotice, setSendNotice] = useState<SendNotice>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [preparingGmail, setPreparingGmail] = useState(false);
  const [gmailQueue, setGmailQueue] = useState<
    Array<{ customerId: string; name: string; href: string }>
  >([]);
  const [nextAllowedOpenAt, setNextAllowedOpenAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  // User-controlled pacing between Gmail draft opens. Floor 60s — anything
  // shorter triggers Gmail's spam heuristics on new sender domains, especially
  // for the first ~30 sends out of a freshly warmed inbox.
  const [gmailIntervalSec, setGmailIntervalSec] = useState(90);

  const counts = useMemo(
    () => ({
      all: rows.length,
      ready: rows.filter((r) => !r.excludedReason && r.selected && r.status === "pending").length,
      excluded: rows.filter((r) => r.excludedReason).length,
    }),
    [rows],
  );

  const visible = rows.filter((r) => {
    if (filter === "ready") return !r.excludedReason && r.selected && r.status === "pending";
    if (filter === "excluded") return !!r.excludedReason;
    return true;
  });

  const selectedCount = rows.filter(
    (r) => r.selected && !r.excludedReason && r.status === "pending",
  ).length;
  const emailCount = rows.filter(
    (r) => r.selected && !r.excludedReason && r.status === "pending" && r.channel === "email",
  ).length;
  const smsBlockingRows = rows.filter(
    (r) => r.selected && !r.excludedReason && r.status === "pending" && r.channel === "sms",
  );
  const smsCount = smsBlockingRows.length;
  const sentCount = rows.filter(
    (r) => r.status === "sent" && !r.excludedReason,
  ).length;
  const gmailBlockedBySms = smsCount > 0;
  // Names of the selected SMS rows that block Gmail drafting (Gmail = email
  // only), so the hint + button tooltip can say exactly which rows to fix.
  const smsBlockingNames = smsBlockingRows.map((r) => r.name);
  const smsBlockReason =
    smsBlockingNames.length === 0
      ? ""
      : `${smsBlockingNames.slice(0, 3).join(", ")}${
          smsBlockingNames.length > 3 ? ` +${smsBlockingNames.length - 3} more` : ""
        } ${smsBlockingNames.length === 1 ? "is an SMS row" : "are SMS rows"} — Gmail drafts are email-only. Unselect ${smsBlockingNames.length === 1 ? "it" : "them"} or switch to Email (needs an email address), then send by SMS separately.`;
  // Customers still waiting to be opened in Gmail — used to differentiate
  // "draft prepared" (in queue) from "actually sent" (popped off queue, so
  // user has opened the compose tab and presumably hit Send).
  const gmailQueueIds = useMemo(
    () => new Set(gmailQueue.map((q) => q.customerId)),
    [gmailQueue],
  );
  const waitSeconds = nextAllowedOpenAt
    ? Math.max(0, Math.ceil((nextAllowedOpenAt - nowMs) / 1000))
    : 0;

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    startTransition(async () => {
      const resumed = await getPreparedGmailDraftQueue(listId);
      if (!resumed.ok || resumed.drafts.length === 0) return;
      setGmailQueue(resumed.drafts);
    });
    // only on first mount for this list id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  function patch(
    id: string,
    p: Partial<Pick<PresendCustomer, "selected" | "channel" | "notes">>,
  ) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    startTransition(async () => {
      await updateListCustomer(id, p);
    });
  }

  function bulkChannel(channel: "email" | "sms") {
    const targets = rows.filter(
      (r) =>
        r.selected &&
        !r.excludedReason &&
        !(channel === "sms" && !r.phone),
    );
    setRows((rs) =>
      rs.map((r) =>
        targets.some((t) => t.id === r.id) ? { ...r, channel } : r,
      ),
    );
    startTransition(async () => {
      await Promise.all(
        targets.map((t) => updateListCustomer(t.id, { channel })),
      );
    });
  }

  /** Try to open a Gmail compose URL. Returns true on success, false if the
   *  browser blocked the popup. We can't use `noopener` here because that
   *  forces the return value to null whether the popup succeeded or was
   *  blocked — and we *need* the return value to detect blocking. To keep
   *  the noopener security guarantee, we null out `popup.opener` right
   *  after opening so the new tab can't navigate us. */
  function openGmailUrl(url: string): boolean {
    const popup = window.open(url, "_blank");
    if (!popup) return false;
    try {
      popup.opener = null;
    } catch {
      // cross-origin or sandboxed — fine, the browser already isolates us
    }
    return true;
  }

  function openNextGmailDraft() {
    if (waitSeconds > 0) return;
    if (gmailQueue.length === 0) return;
    const next = gmailQueue[0];
    const opened = openGmailUrl(next.href);
    if (!opened) {
      setSendNotice({
        kind: "generic",
        message:
          "Browser blocked the Gmail popup. Allow popups for this site, then click again.",
      });
      return;
    }
    setGmailQueue((q) => q.slice(1));
    setNextAllowedOpenAt(Date.now() + gmailIntervalSec * 1000);
  }

  return (
    <>
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <span className="text-[13px] font-medium text-text">
            {selectedCount} selected
          </span>
          <span className="h-4 w-px bg-border-base" />
          <div className="flex gap-1">
            {(
              [
                ["all", "All"],
                ["ready", "Ready"],
                ["excluded", "Excluded"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                  filter === id
                    ? "bg-ink text-cream border-ink"
                    : "bg-paper text-text-soft border-border-base hover:border-forest"
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 font-mono text-[10.5px] ${
                    filter === id ? "text-cream/60" : "text-text-muted"
                  }`}
                >
                  {counts[id]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bulkChannel("sms")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-2 text-[12.5px] font-medium text-text hover:bg-cream-deep"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            SMS all
          </button>
          <button
            type="button"
            onClick={() => bulkChannel("email")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-paper px-3 py-2 text-[12.5px] font-medium text-text hover:bg-cream-deep"
          >
            <Mail className="h-3.5 w-3.5" />
            Email all
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-paper border border-border-base rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="w-10 bg-cream-deep px-3 py-2.5 border-b border-border-base" />
              <th className="bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Customer
              </th>
              <th className="bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Contact
              </th>
              <th className="bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Channel
              </th>
              <th className="bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Lang
              </th>
              <th className="bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Notes for AI{" "}
                <span className="font-normal normal-case tracking-normal text-text-muted">
                  — editable
                </span>
              </th>
              <th className="w-28 bg-cream-deep px-3.5 py-2.5 text-left text-[10.5px] uppercase tracking-[0.08em] text-text-muted font-semibold border-b border-border-base">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const excluded = !!r.excludedReason;
              const pill = LANG_PILL[r.language] ?? LANG_PILL.en;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-border-soft last:border-b-0 ${
                    excluded ? "bg-alert/[0.04]" : ""
                  }`}
                >
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={r.selected && !excluded}
                      disabled={excluded}
                      onChange={(e) =>
                        patch(r.id, { selected: e.target.checked })
                      }
                      className="h-4 w-4 accent-forest disabled:opacity-40"
                    />
                  </td>
                  <td className="px-3.5 py-3 align-top">
                    <div
                      className={`font-medium ${
                        excluded ? "text-alert" : "text-ink"
                      }`}
                    >
                      {r.name}
                    </div>
                    {r.visitDate && (
                      <div className="text-[11.5px] text-text-muted mt-0.5">
                        visit {r.visitDate}
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3 align-top">
                    <div className="space-y-0.5 font-mono text-[12px] text-text-soft">
                      <div
                        className={`flex items-center gap-1.5 ${
                          !r.email ? "text-text-muted/50" : ""
                        }`}
                      >
                        <Mail className="h-3 w-3" />
                        {r.email ?? "—"}
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          !r.phone ? "text-text-muted/50" : ""
                        }`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {r.phone ? formatPhone(r.phone) : "—"}
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 align-top">
                    <div className="inline-flex rounded-md border border-border-base bg-cream p-0.5">
                      <button
                        type="button"
                        disabled={excluded || !r.phone}
                        onClick={() => patch(r.id, { channel: "sms" })}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium disabled:opacity-40 ${
                          r.channel === "sms"
                            ? "bg-forest text-cream"
                            : "text-text-soft"
                        }`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        SMS
                      </button>
                      <button
                        type="button"
                        disabled={excluded || !r.email}
                        onClick={() => patch(r.id, { channel: "email" })}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium disabled:opacity-40 ${
                          r.channel === "email"
                            ? "bg-forest text-cream"
                            : "text-text-soft"
                        }`}
                      >
                        <Mail className="h-3 w-3" />
                        Email
                      </button>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 align-top">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.cls}`}
                    >
                      {pill.text}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 align-top">
                    <textarea
                      defaultValue={r.notes}
                      rows={1}
                      disabled={excluded}
                      onBlur={(e) => {
                        if (e.target.value !== r.notes)
                          patch(r.id, { notes: e.target.value });
                      }}
                      className="w-full min-w-[160px] rounded-md border border-border-base bg-cream px-2.5 py-1.5 text-[12px] text-text resize-y focus:border-forest focus:bg-paper focus:outline-none disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3.5 py-3 align-top">
                    {excluded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-alert-soft px-2 py-0.5 text-[11px] font-medium text-alert">
                        <X className="h-3 w-3" />
                        {r.excludedReason === "duplicate_60d"
                          ? "Sent <60d"
                          : r.excludedReason === "no_contact"
                            ? "No contact"
                            : r.excludedReason === "opted_out"
                              ? "Opted out"
                              : "Excluded"}
                      </span>
                    ) : r.status === "sent" ? (
                      gmailQueueIds.has(r.id) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold-dark">
                          Draft prepared
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-medium text-forest">
                          <Check className="h-3 w-3" />
                          Sent
                        </span>
                      )
                    ) : !r.phone ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                        <TriangleAlert className="h-3 w-3" />
                        Email only
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                        <Check className="h-3 w-3" />
                        Ready
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* BILLING-REQUIRED BANNER — shown when every send failed because the
          location's subscription isn't active. Pattern-matched on the
          per-customer error string from the server. */}
      {sendNotice?.kind === "billing" && (
        <div className="mb-5 flex flex-wrap items-start gap-4 rounded-2xl border border-alert/30 bg-alert/[0.05] px-5 py-4">
          <TriangleAlert className="h-5 w-5 flex-shrink-0 text-alert mt-0.5" />
          <div className="flex-1 min-w-[280px]">
            <p className="text-[14px] font-semibold text-ink mb-1">
              Billing required for this location
            </p>
            <p className="text-[12.5px] text-text-soft leading-relaxed">
              No emails went out — this location doesn&apos;t have an active
              subscription yet, so review-request sends are blocked. Set up
              billing and the same list will send next time.
            </p>
          </div>
          <Link
            href="/app/billing"
            className="shrink-0 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-cream hover:bg-forest-dark"
          >
            Set up billing →
          </Link>
        </div>
      )}

      {/* STICKY SEND BAR — outer div spans full content width for an
          unbroken border / backdrop blur, inner div is constrained to
          match the page main's max-w-[1280px] + px-10 so it aligns
          visually with the customer table above it. */}
      <div className="fixed bottom-0 left-[270px] right-0 z-40 border-t border-border-base bg-paper/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 max-w-[1280px] px-10 py-4">
        <div className="flex items-center gap-6">
          {selectedCount > 0 ? (
            <>
              <div>
                <div className="font-display text-[22px] font-medium text-forest leading-none">
                  {selectedCount}
                </div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-medium mt-1">
                  Ready to send
                </div>
              </div>
              <span className="h-8 w-px bg-border-base" />
              <div>
                <div className="text-[15px] text-text-soft font-medium">
                  {emailCount} email · {smsCount} SMS
                </div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-medium mt-1">
                  Channel mix
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="font-display text-[22px] font-medium text-forest leading-none">
                {sentCount}
              </div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-medium mt-1">
                {sentCount === 1 ? "Customer sent" : "Customers sent"}
              </div>
            </div>
          )}
          <span className="h-8 w-px bg-border-base" />
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-cream px-3 py-2 text-[12.5px] text-text">
            <Clock className="h-3.5 w-3.5 text-text-soft" />
            Send <strong className="font-semibold">now</strong>
            <ChevronDown className="h-3 w-3 text-text-muted" />
          </span>
          <label
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-cream px-3 py-2 text-[12.5px] text-text cursor-text"
            title="Pause between Gmail draft opens (min 60s)"
          >
            <Clock className="h-3.5 w-3.5 text-text-soft" />
            Gmail pace
            <input
              type="number"
              min={60}
              max={600}
              step={30}
              value={gmailIntervalSec}
              onChange={(e) => {
                const n = Math.max(60, Math.min(600, Number(e.target.value) || 60));
                setGmailIntervalSec(n);
              }}
              className="w-12 bg-transparent border-0 outline-none text-center font-mono text-[12.5px] text-ink"
            />
            s
          </label>
        </div>
        <div className="flex items-center gap-2.5">
          {readOnly && (
            <span className="text-[12.5px] text-text-soft italic">
              Your BAAM team is operating this list — read-only view.
            </span>
          )}
          {sendNotice?.kind === "generic" && (
            <span className="text-[12.5px] text-warn font-medium mr-2">
              {sendNotice.message}
            </span>
          )}
          {!readOnly && gmailBlockedBySms && (
            <span className="text-[12px] text-warn mr-2 max-w-[420px]">
              {smsBlockReason}
            </span>
          )}
          {!readOnly && selectedCount > 0 && (
            <button
              type="button"
              disabled={savingDraft}
              onClick={() => {
                setSavingDraft(true);
                startTransition(async () => {
                  await saveListAsDraft(listId);
                });
              }}
              className="rounded-lg border border-border-base bg-paper px-4 py-2.5 text-[13.5px] font-medium text-text hover:bg-cream-deep disabled:opacity-50"
            >
              {savingDraft ? "Saving…" : "Save as draft"}
            </button>
          )}
          {!readOnly && (() => {
            const hasQueue = gmailQueue.length > 0;
            // Hide the morphing button entirely when there's nothing to do:
            // no prepared queue AND no pending email customers.
            if (!hasQueue && emailCount === 0) return null;
            const onCooldown = waitSeconds > 0;
            const label = preparingGmail
              ? "Preparing…"
              : hasQueue
                ? onCooldown
                  ? `Wait ${waitSeconds}s`
                  : `Send next in Gmail (${gmailQueue.length} left)`
                : "Prepare Send in Gmail";

            const blockedTooltip =
              !hasQueue && gmailBlockedBySms
                ? smsBlockReason
                : !hasQueue && emailCount === 0
                  ? "No email rows selected to draft in Gmail."
                  : undefined;

            return (
              <button
                type="button"
                title={blockedTooltip}
                disabled={
                  preparingGmail ||
                  (hasQueue ? onCooldown : emailCount === 0 || gmailBlockedBySms)
                }
                onClick={() => {
                  if (hasQueue) {
                    openNextGmailDraft();
                    return;
                  }
                  setSendNotice(null);
                  setPreparingGmail(true);
                  startTransition(async () => {
                    const res = await prepareGmailDraftsForList(listId);
                    setPreparingGmail(false);
                    if (!res.ok) {
                      // Prefer per-customer reasons over the generic wrapper
                      // ("No Gmail drafts prepared — list left as draft.")
                      // since the specific reason is what the user needs to
                      // see — most commonly billing not set up, suppression,
                      // or velocity blocks.
                      const detail = res.errors?.[0];
                      if (detail?.includes("Billing required")) {
                        setSendNotice({ kind: "billing" });
                      } else {
                        setSendNotice({
                          kind: "generic",
                          message:
                            detail ||
                            res.error ||
                            "Could not prepare Gmail drafts.",
                        });
                      }
                      return;
                    }
                    const queue = res.drafts ?? [];
                    // Auto-open the first draft in Gmail so "Prepare" is a
                    // single click instead of two. If the popup is blocked
                    // (Safari, or Chrome with strict popup settings), we
                    // leave the queue intact so the user can click the
                    // now-morphed "Send next in Gmail" button to retry —
                    // crucially we don't pop the first item, otherwise the
                    // pill would lie and say "Sent" for a draft the user
                    // never actually opened.
                    setNextAllowedOpenAt(null);
                    if (queue.length === 0) {
                      setGmailQueue([]);
                    } else {
                      const first = queue[0];
                      const opened = openGmailUrl(first.href);
                      if (opened) {
                        setGmailQueue(queue.slice(1));
                        setNextAllowedOpenAt(
                          Date.now() + gmailIntervalSec * 1000,
                        );
                      } else {
                        setGmailQueue(queue);
                        setSendNotice({
                          kind: "generic",
                          message:
                            "Drafts ready in Gmail, but the browser blocked the popup. Click 'Send next in Gmail' to open the first one.",
                        });
                      }
                    }
                    // Sync the table rows: every prepared customer is now
                    // status="sent" in the DB. Without this, the pill stays
                    // on "Ready" until a hard reload because the local rows
                    // state is initialized once and router.refresh() does
                    // not reset child component state.
                    const preparedIds = new Set(queue.map((q) => q.customerId));
                    if (preparedIds.size > 0) {
                      setRows((rs) =>
                        rs.map((r) =>
                          preparedIds.has(r.id)
                            ? { ...r, status: "sent" }
                            : r,
                        ),
                      );
                    }
                    if (res.failed > 0) {
                      setSendNotice({
                        kind: "generic",
                        message:
                          res.errors?.[0] ||
                          `${res.failed} customer${res.failed === 1 ? "" : "s"} could not be prepared.`,
                      });
                    }
                    router.refresh();
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-5 py-2.5 text-[13.5px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
              >
                {hasQueue ? <ExternalLink className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {label}
              </button>
            );
          })()}
        </div>
        </div>
      </div>
    </>
  );
}
