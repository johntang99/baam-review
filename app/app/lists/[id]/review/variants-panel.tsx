"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
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
}: VariantsPanelProps) {
  const [variants, setVariants] = useState<ListVariant[] | null>(initialVariants);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mixedLanguageNote, setMixedLanguageNote] = useState<string | null>(null);

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
      // Stash the mixed-language warning (if any) into sessionStorage so it
      // survives the reload below — otherwise the post-reload server-rendered
      // state has the new variants but loses the in-memory notice.
      if (r.mixedLanguageNote) {
        sessionStorage.setItem(
          `lang-note:${listId}`,
          r.mixedLanguageNote,
        );
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
      setExpanded(false);
    });
  }

  return (
    <div className="rounded-2xl border border-border-base bg-paper px-6 py-5 mb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-forest" />
          <div>
            <p className="text-[14px] font-medium text-ink">AI variations</p>
            <p className="text-[12px] text-text-muted leading-snug">
              {hasVariants
                ? `${variants!.length} ${channel} variants ready — each customer gets a random one at send time.`
                : "Generate 5 unique subject + body variants so each customer in this list gets a slightly different email — helps deliverability."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasVariants && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-border-base bg-paper px-3 py-1.5 text-[12.5px] font-medium text-text hover:bg-cream-deep"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {expanded ? "Hide" : "Preview"}
              </button>
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
            </>
          )}
          {!hasVariants && (
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-[13px] font-medium text-cream hover:bg-forest-dark disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {pending ? "Generating…" : "Generate variations"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-alert">{error}</p>
      )}

      {mixedLanguageNote && (
        <p className="mt-3 text-[12px] text-warn flex items-start gap-1.5">
          <span className="flex-shrink-0">⚠</span>
          <span>{mixedLanguageNote}</span>
        </p>
      )}

      {expanded && hasVariants && (
        <div className="mt-5 space-y-3 border-t border-border-soft pt-5">
          {variants!.map((v, i) => (
            <VariantRow
              key={i}
              listId={listId}
              index={i}
              variant={v}
              channel={channel}
              onSaved={(next) =>
                setVariants((prev) =>
                  prev
                    ? prev.map((x, j) => (j === i ? { ...x, ...next } : x))
                    : prev,
                )
              }
            />
          ))}
          <p className="text-[11.5px] text-text-muted italic pt-1">
            <code className="font-mono">{"{name}"}</code> is replaced with each
            customer&apos;s first name. <code className="font-mono">&lt;slug&gt;</code>{" "}
            and <code className="font-mono">&lt;token&gt;</code> are replaced
            with their tracking URL.
          </p>
        </div>
      )}
    </div>
  );
}

function VariantRow({
  listId,
  index,
  variant,
  channel,
  onSaved,
}: {
  listId: string;
  index: number;
  variant: ListVariant;
  channel: "email" | "sms";
  onSaved: (next: { subject: string; body: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(variant.subject);
  const [body, setBody] = useState(variant.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setSubject(variant.subject);
    setBody(variant.body);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

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
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-soft bg-cream/30 p-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-medium text-text-soft">
            Variant {index + 1}
          </span>
          <span className="inline-flex items-center rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-medium text-forest">
            {TONE_LABEL[variant.tone] ?? variant.tone}
            {index === 0 && " · default"}
          </span>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 text-[11.5px] text-text-soft hover:text-ink"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md border border-border-base bg-paper px-2 py-1 text-[11.5px] text-text-soft hover:bg-cream-deep disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md border border-forest/30 bg-forest/10 px-2 py-1 text-[11.5px] font-medium text-forest hover:bg-forest/15 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {channel === "email" && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-md border border-border-base bg-paper px-3 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-border-base bg-paper px-3 py-2 font-sans text-[12.5px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
          {error && <p className="text-[11.5px] text-alert">{error}</p>}
        </div>
      ) : (
        <>
          {channel === "email" && (
            <p className="text-[13px] text-ink mb-2 font-medium">
              {variant.subject}
            </p>
          )}
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-text">
            {variant.body}
          </pre>
        </>
      )}
    </div>
  );
}
