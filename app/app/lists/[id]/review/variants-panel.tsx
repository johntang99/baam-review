"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  generateVariantsForList,
  clearVariantsForList,
  updateVariantForList,
} from "../../actions";

export interface ListVariant {
  subject: string;
  body: string;
  tone: string;
}

interface VariantsPanelProps {
  listId: string;
  initialVariants: ListVariant[] | null;
  channel: "email" | "sms";
  /** When true, hide Generate/Regenerate/Clear/Edit controls and render
   * the variants as a read-only showcase. Used for Full Service customers
   * who see what BAAM is doing on their behalf without operational levers. */
  readOnly?: boolean;
}

const TONE_LABEL: Record<string, string> = {
  warm: "Warm",
  brief: "Brief",
  professional: "Professional",
  casual: "Casual",
};

export function VariantsPanel({
  listId,
  initialVariants,
  channel,
  readOnly = false,
}: VariantsPanelProps) {
  const [variants, setVariants] = useState<ListVariant[] | null>(initialVariants);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mixedLanguageNote, setMixedLanguageNote] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const hasVariants = variants && variants.length > 0;

  // After a generate() reload, recover the mixed-language notice we stashed
  // in sessionStorage so it shows up alongside the freshly-loaded variants.
  useEffect(() => {
    const stashed = sessionStorage.getItem(`lang-note:${listId}`);
    if (stashed) {
      setMixedLanguageNote(stashed);
      sessionStorage.removeItem(`lang-note:${listId}`);
    }
  }, [listId]);

  function generate() {
    setError(null);
    setMixedLanguageNote(null);
    startTransition(async () => {
      const r = await generateVariantsForList(listId);
      if (!r.ok) {
        setError(r.error ?? "Generation failed.");
        return;
      }
      if (r.mixedLanguageNote) {
        sessionStorage.setItem(`lang-note:${listId}`, r.mixedLanguageNote);
      }
      window.location.reload();
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      const r = await clearVariantsForList(listId);
      if (!r.ok) {
        setError(r.error ?? "Clear failed.");
        return;
      }
      setVariants(null);
    });
  }

  return (
    <>
      {/* HEADER (lives in the right grid cell) */}
      <div className="rounded-2xl border border-border-base bg-paper px-6 py-5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-forest mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-ink">AI variations</p>
              <p className="text-[12px] text-text-muted leading-snug mt-0.5">
                {hasVariants
                  ? `${variants!.length} ${channel} variants ready — each customer in this list gets a random one at send time.`
                  : "Generate 5 unique subject + body variants so each customer in this list gets a slightly different email — helps deliverability."}
              </p>
            </div>
          </div>
          {hasVariants && !readOnly && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={generate}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12.5px] font-medium text-text hover:bg-cream-deep disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
                {pending ? "Regenerating…" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={pending}
                title="Remove AI variants and send the default template instead"
                className="inline-flex items-center gap-1 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12.5px] font-medium text-text-soft hover:bg-cream-deep disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          )}
        </div>

        {!hasVariants && !readOnly && (
          <div className="mt-auto pt-5">
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {pending ? "Generating…" : "Generate variations"}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-[12px] text-alert">{error}</p>}
        {mixedLanguageNote && (
          <p className="mt-3 text-[12px] text-warn flex items-start gap-1.5">
            <span className="flex-shrink-0">⚠</span>
            <span>{mixedLanguageNote}</span>
          </p>
        )}
      </div>

      {/* CARDS ROW (spans both grid columns, wraps to next row) */}
      {hasVariants && (
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {variants!.map((v, i) => (
            <VariantCard
              key={i}
              index={i}
              variant={v}
              channel={channel}
              onClick={() => !readOnly && setEditingIndex(i)}
              clickable={!readOnly}
            />
          ))}
        </div>
      )}

      {editingIndex !== null && variants && (
        <EditVariantModal
          listId={listId}
          index={editingIndex}
          variant={variants[editingIndex]}
          channel={channel}
          onClose={() => setEditingIndex(null)}
          onSaved={(next) => {
            setVariants((prev) =>
              prev
                ? prev.map((x, j) =>
                    j === editingIndex ? { ...x, ...next } : x,
                  )
                : prev,
            );
            setEditingIndex(null);
          }}
        />
      )}
    </>
  );
}

function VariantCard({
  index,
  variant,
  channel,
  onClick,
  clickable,
}: {
  index: number;
  variant: ListVariant;
  channel: "email" | "sms";
  onClick: () => void;
  clickable: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`text-left rounded-xl border border-border-base bg-paper p-4 flex flex-col gap-2 transition ${
        clickable
          ? "hover:border-forest/40 hover:shadow-sm cursor-pointer"
          : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text-soft tracking-wide">
          Variant {index + 1}
        </span>
        {clickable && <Pencil className="h-3 w-3 text-text-muted" />}
      </div>
      <span className="inline-flex items-center self-start rounded-full bg-forest/10 px-2 py-0.5 text-[10.5px] font-medium text-forest">
        {TONE_LABEL[variant.tone] ?? variant.tone}
        {index === 0 && " · default"}
      </span>
      {channel === "email" && (
        <p className="text-[12.5px] font-medium text-ink line-clamp-2 leading-snug">
          {variant.subject}
        </p>
      )}
      <p className="text-[11.5px] text-text leading-relaxed line-clamp-7 whitespace-pre-wrap font-sans">
        {variant.body}
      </p>
    </button>
  );
}

function EditVariantModal({
  listId,
  index,
  variant,
  channel,
  onClose,
  onSaved,
}: {
  listId: string;
  index: number;
  variant: ListVariant;
  channel: "email" | "sms";
  onClose: () => void;
  onSaved: (next: { subject: string; body: string }) => void;
}) {
  const [subject, setSubject] = useState(variant.subject);
  const [body, setBody] = useState(variant.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const r = await updateVariantForList(listId, index, { subject, body });
      if (!r.ok) {
        setError(r.error ?? "Save failed.");
        return;
      }
      onSaved({ subject, body });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] rounded-2xl bg-paper shadow-2xl border border-border-base"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2.5">
            <span className="text-[11.5px] font-medium text-text-soft tracking-wide">
              Variant {index + 1}
            </span>
            <span className="inline-flex items-center rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-medium text-forest">
              {TONE_LABEL[variant.tone] ?? variant.tone}
              {index === 0 && " · default"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {channel === "email" && (
            <div>
              <label className="block text-[11.5px] uppercase tracking-[0.1em] text-text-muted font-medium mb-1.5">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-md border border-border-base bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>
          )}
          <div>
            <label className="block text-[11.5px] uppercase tracking-[0.1em] text-text-muted font-medium mb-1.5">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-border-base bg-paper px-3 py-2 font-sans text-[12.5px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
          </div>
          {error && <p className="text-[11.5px] text-alert">{error}</p>}
          <p className="text-[11px] text-text-muted italic">
            <code className="font-mono">{"{name}"}</code> is replaced with each
            customer&apos;s first name.{" "}
            <code className="font-mono">&lt;slug&gt;</code> and{" "}
            <code className="font-mono">&lt;token&gt;</code> become their
            tracking URL.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-soft bg-cream/30 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md border border-border-base bg-paper px-3 py-1.5 text-[12.5px] text-text-soft hover:bg-cream-deep disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md border border-forest/30 bg-forest/10 px-3 py-1.5 text-[12.5px] font-medium text-forest hover:bg-forest/15 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
