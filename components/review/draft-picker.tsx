"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Pencil,
  Check,
  X,
  ClipboardCheck,
} from "lucide-react";
import { STRINGS, type Language } from "@/lib/i18n/review";
import { buttonVariants, Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ConsentCheckbox } from "./consent-checkbox";
import { track, type TrackContext } from "./track";

export interface Draft {
  tone: string;
  text: string;
}

interface DraftPickerProps {
  ctx: TrackContext;
  lang: Language;
  slug: string;
  googleReviewUrl: string | null;
  drafts: Draft[];
  inputsSummary: {
    service: string | null;
    rating: number;
    descriptor: string | null;
  };
  onRegenerate: () => Promise<void>;
  onBack: () => void;
  isRegenerating: boolean;
  consentDisplayEnabled: boolean;
  consentDisplay: boolean;
  onConsentDisplayChange: (next: boolean) => void;
  trackingToken: string | null;
}

const TONE_LABEL_KEYS: Record<string, "drafts_tone_warm" | "drafts_tone_specific" | "drafts_tone_brief"> = {
  warm: "drafts_tone_warm",
  specific: "drafts_tone_specific",
  brief: "drafts_tone_brief",
};

export function DraftPicker({
  ctx,
  lang,
  slug,
  googleReviewUrl,
  drafts,
  inputsSummary,
  onRegenerate,
  onBack,
  isRegenerating,
  consentDisplayEnabled,
  consentDisplay,
  onConsentDisplayChange,
  trackingToken,
}: DraftPickerProps) {
  const s = STRINGS[lang];

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState<string>(drafts[0]?.text ?? "");
  const [posting, setPosting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  // Reset + auto-copy when drafts change (initial render + regenerate).
  useEffect(() => {
    setSelectedIndex(0);
    const first = drafts[0]?.text ?? "";
    setEditedText(first);
    setEditing(false);
    if (first) void copyToClipboard(first);
  }, [drafts]);

  function pick(i: number) {
    setSelectedIndex(i);
    const text = drafts[i]?.text ?? "";
    setEditedText(text);
    setEditing(false);
    if (text) void copyToClipboard(text);
  }

  function startEdit() {
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function saveEdit() {
    track(ctx, "draft_edited", { tone: drafts[selectedIndex]?.tone });
    setEditing(false);
    if (editedText) void copyToClipboard(editedText);
  }

  function cancelEdit() {
    setEditedText(drafts[selectedIndex]?.text ?? "");
    setEditing(false);
  }

  async function postToGoogle() {
    if (!googleReviewUrl) return;
    setPosting(true);

    // Final guarantee — text is already on clipboard from pick/edit, but the
    // user may have copied something else between selection and post.
    await copyToClipboard(editedText);

    track(ctx, "platform_clicked", {
      platform: "google",
      service: inputsSummary.service,
      rating: inputsSummary.rating,
      descriptor: inputsSummary.descriptor,
      tone: drafts[selectedIndex]?.tone,
      edited: editedText !== drafts[selectedIndex]?.text,
      consent_display: consentDisplay,
    });

    window.open(googleReviewUrl, "_blank", "noopener,noreferrer");
    const consentParam = consentDisplay ? "&consent=1" : "";
    const tokenParam = trackingToken ? `&t=${trackingToken}` : "";
    window.location.href = `/r/${slug}/thank-you?via=google&lang=${lang}${consentParam}${tokenParam}`;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-[19px] text-ink leading-tight">
          {s.drafts_heading}
        </h2>
        <p className="text-[13px] text-text-soft">{s.drafts_subtitle}</p>
      </header>

      <InputsSummary
        lang={lang}
        service={inputsSummary.service}
        rating={inputsSummary.rating}
        descriptor={inputsSummary.descriptor}
        onBack={onBack}
      />

      <ul className="space-y-3">
        {drafts.map((d, i) => {
          const isSelected = i === selectedIndex;
          const toneKey = TONE_LABEL_KEYS[d.tone.toLowerCase()] ?? null;
          const toneLabel = toneKey ? s[toneKey] : d.tone;

          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(i)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-colors",
                  isSelected
                    ? "border-forest bg-forest/[0.04]"
                    : "border-border-base bg-paper hover:bg-hover",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 mt-0.5",
                      isSelected
                        ? "border-forest bg-forest"
                        : "border-border-base bg-paper",
                    )}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 text-cream stroke-[3]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-muted">
                        {toneLabel}
                      </p>
                      {isSelected && copyState === "copied" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-medium text-success">
                          <ClipboardCheck className="h-3 w-3" />
                          {s.drafts_copied}
                        </span>
                      )}
                      {isSelected && copyState === "failed" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10.5px] font-medium text-warn">
                          {s.drafts_copy_failed}
                        </span>
                      )}
                    </div>
                    {isSelected && editing ? null : (
                      <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">
                        {isSelected ? editedText : d.text}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={6}
            className="text-[14px] leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={saveEdit}>
              <Check className="h-3.5 w-3.5" />
              {s.cta_edit_save}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={cancelEdit}
            >
              <X className="h-3.5 w-3.5" />
              {s.cta_edit_cancel}
            </Button>
          </div>
        </div>
      )}

      <p className="text-[13px] text-text italic leading-relaxed">
        {s.ai_disclosure}
      </p>

      <div className="space-y-2">
        {consentDisplayEnabled && googleReviewUrl && (
          <ConsentCheckbox
            checked={consentDisplay}
            onChange={onConsentDisplayChange}
            label={s.consent_display_label}
            help={s.consent_display_help}
          />
        )}

        {googleReviewUrl && (
          <button
            type="button"
            disabled={posting}
            onClick={postToGoogle}
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "w-full",
            )}
          >
            {s.cta_post}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className={cn(
                buttonVariants({ variant: "secondary", size: "md" }),
                "flex-1",
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              {s.cta_edit}
            </button>
          )}
          <button
            type="button"
            disabled={isRegenerating}
            onClick={onRegenerate}
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "flex-1",
            )}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")}
            />
            {isRegenerating ? s.cta_generating : s.cta_regenerate}
          </button>
        </div>

        <p className="text-[13px] text-text text-center pt-1">
          {s.drafts_helper}
        </p>
      </div>
    </div>
  );
}

function InputsSummary({
  lang,
  service,
  rating,
  descriptor,
  onBack,
}: {
  lang: Language;
  service: string | null;
  rating: number;
  descriptor: string | null;
  onBack: () => void;
}) {
  const s = STRINGS[lang];
  const ratingLabel = s.drafts_summary_rating.replace("{n}", String(rating));
  const parts = [service, ratingLabel, descriptor].filter(
    (p): p is string => !!p && p.length > 0,
  );

  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-[12px] text-text-soft hover:text-ink transition-colors"
    >
      <ArrowLeft className="h-3 w-3" />
      {parts.length > 0 ? parts.join(" · ") : s.cta_change_inputs}
    </button>
  );
}
