"use client";

import { useState, useTransition } from "react";
import { Check, Save } from "lucide-react";
import type {
  OfferImageAspect,
  RewardConfig,
} from "@/lib/database.types";
import { Field } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogoUploader } from "@/components/locations/logo-uploader";
import { cn } from "@/lib/utils";
import { ReviewerRewardCard } from "@/components/review/reviewer-reward-card";
import { saveRewardConfig } from "./reward-actions";

interface RewardSetupProps {
  locationId: string;
  /** Account ID — used for the storage upload path (logos bucket RLS). */
  accountId: string;
  brandColor: string;
  bookingFallback: string | null;
  displayName: string;
  initialConfig: RewardConfig;
}

interface Draft {
  enabled: boolean;
  title: string;
  subtitle: string;
  code: string;
  expires_at: string; // YYYY-MM-DD or ""
  booking_enabled: boolean;
  booking_url: string;
  booking_cta_label: string;
  image_url: string | null;
  image_aspect: OfferImageAspect;
  description: string;
  accent_color: string;
}

const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: "#C9A961", label: "Gold (default)" },
  { value: "#A88847", label: "Bronze" },
  { value: "#1F4D3F", label: "Forest" },
  { value: "#962D22", label: "Clinic red" },
  { value: "#5E3F76", label: "Aubergine" },
  { value: "#3F6A8E", label: "Sapphire" },
];

const ASPECT_OPTIONS: { value: OfferImageAspect; label: string; hint: string }[] = [
  { value: "4:3", label: "4:3", hint: "Classic landscape (default)" },
  { value: "16:9", label: "16:9", hint: "Wide landscape" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "3:4", label: "3:4", hint: "Portrait" },
];

const DEFAULT_ACCENT = "#C9A961";

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function RewardSetup({
  locationId,
  accountId,
  brandColor,
  bookingFallback,
  displayName,
  initialConfig,
}: RewardSetupProps) {
  const [draft, setDraft] = useState<Draft>({
    enabled: initialConfig.enabled === true,
    title: initialConfig.title ?? "",
    subtitle: initialConfig.subtitle ?? "",
    code: initialConfig.code ?? "",
    expires_at: toDateInput(initialConfig.expires_at),
    booking_enabled: initialConfig.booking_enabled !== false,
    booking_url: initialConfig.booking_url ?? "",
    booking_cta_label: initialConfig.booking_cta_label ?? "",
    image_url: initialConfig.image_url ?? null,
    image_aspect: initialConfig.image_aspect ?? "4:3",
    description: initialConfig.description ?? "",
    accent_color: initialConfig.accent_color ?? DEFAULT_ACCENT,
  });

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveRewardConfig(locationId, {
        enabled: draft.enabled,
        title: draft.title || null,
        subtitle: draft.subtitle || null,
        code: draft.code || null,
        expires_at: draft.expires_at || null,
        booking_enabled: draft.booking_enabled,
        booking_url: draft.booking_url || null,
        booking_cta_label: draft.booking_cta_label || null,
        image_url: draft.image_url,
        image_aspect: draft.image_aspect,
        description: draft.description || null,
        accent_color:
          draft.accent_color && draft.accent_color !== DEFAULT_ACCENT
            ? draft.accent_color
            : null,
      });
      if (res.ok) {
        setSavedAt(Date.now());
      } else {
        setError(res.error ?? "Save failed");
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
      {/* FORM */}
      <div className="space-y-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-base bg-cream-deep p-3.5 transition-colors hover:bg-paper">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            className="sr-only"
          />
          <span
            className={cn(
              "mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-2",
              draft.enabled
                ? "border-forest bg-forest"
                : "border-border-base bg-paper",
            )}
          >
            {draft.enabled && (
              <Check className="h-3 w-3 text-cream stroke-[3.5]" />
            )}
          </span>
          <div className="text-left">
            <div className="text-[13.5px] font-medium text-ink">
              Show the reward on the thank-you page
            </div>
            <div className="text-[12px] text-text-soft">
              Turning this off hides the reward card. The share card still
              renders below.
            </div>
          </div>
        </label>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            1. Reward title
            <span className="ml-2 font-sans text-[12px] font-normal text-text-muted">
              — what the reviewer earns
            </span>
          </h3>

          <Field
            label="Reward title"
            htmlFor="rw_title"
            hint="Works for any business — visit, purchase, service, repair. e.g. “You earned $20 off your next visit”, “Free oil change with your next service”, “10% off any product”."
          >
            <Input
              id="rw_title"
              value={draft.title}
              onChange={(e) =>
                setDraft({ ...draft, title: e.target.value.slice(0, 100) })
              }
              maxLength={100}
              placeholder="You earned $20 off your next visit"
            />
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            2. Reward subtitle
            <span className="ml-2 font-sans text-[12px] font-normal text-text-muted">
              — how to redeem
            </span>
          </h3>

          <Field
            label="Reward subtitle"
            htmlFor="rw_subtitle"
            hint="e.g. “Show this page at next appointment”, “Mention this code at checkout”, “Apply at our online store”. Keep it warm and clear."
          >
            <textarea
              id="rw_subtitle"
              value={draft.subtitle}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subtitle: e.target.value.slice(0, 240),
                })
              }
              rows={2}
              maxLength={240}
              placeholder="Show this page at your next visit, or mention the code when you call."
              className="w-full rounded-md border border-border-base bg-paper px-3 py-2 text-[14px] text-text shadow-sm transition-colors focus:border-forest focus:outline-none"
            />
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            3. Discount code &amp; expiration
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Discount code"
              htmlFor="rw_code"
              hint="Auto-uppercased, no spaces. Can be the same as the friend's code or different."
            >
              <Input
                id="rw_code"
                value={draft.code}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    code: e.target.value
                      .replace(/\s+/g, "")
                      .toUpperCase()
                      .slice(0, 30),
                  })
                }
                placeholder="THANKS20"
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Expires" htmlFor="rw_expires" hint="Optional.">
              <Input
                id="rw_expires"
                type="date"
                value={draft.expires_at}
                onChange={(e) =>
                  setDraft({ ...draft, expires_at: e.target.value })
                }
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            4. Make appointment
          </h3>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-base bg-paper p-3.5">
            <input
              type="checkbox"
              checked={draft.booking_enabled}
              onChange={(e) =>
                setDraft({ ...draft, booking_enabled: e.target.checked })
              }
              className="sr-only"
            />
            <span
              className={cn(
                "mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-2",
                draft.booking_enabled
                  ? "border-forest bg-forest"
                  : "border-border-base bg-paper",
              )}
            >
              {draft.booking_enabled && (
                <Check className="h-3 w-3 text-cream stroke-[3.5]" />
              )}
            </span>
            <div className="text-left">
              <div className="text-[13.5px] font-medium text-ink">
                Customer can book an appointment for this reward
              </div>
              <div className="text-[12px] text-text-soft">
                Adds a “Book now &amp; apply this code” button to the reward
                card. Uncheck for stores, product sales, or walk-in services.
              </div>
            </div>
          </label>

          {draft.booking_enabled && (
            <>
              <Field
                label="Booking URL"
                htmlFor="rw_booking_url"
                hint={
                  bookingFallback
                    ? "Optional. Defaults to your location's booking URL when blank."
                    : "Required to enable the booking button. Set a booking URL on the location or paste one here."
                }
              >
                <Input
                  id="rw_booking_url"
                  type="url"
                  value={draft.booking_url}
                  onChange={(e) =>
                    setDraft({ ...draft, booking_url: e.target.value })
                  }
                  placeholder={bookingFallback ?? "https://book.example.com/..."}
                  className="font-mono text-[12.5px]"
                />
              </Field>

              <Field
                label="Booking button text"
                htmlFor="rw_booking_cta_label"
                hint='Customize the button label to match how your booking flow handles coupons. e.g. "Book now — show your coupon when you visit" (for booking sites without a coupon field), "Book now & apply this code" (default), or "Reserve now". Leave blank to use the default.'
              >
                <Input
                  id="rw_booking_cta_label"
                  value={draft.booking_cta_label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      booking_cta_label: e.target.value.slice(0, 80),
                    })
                  }
                  maxLength={80}
                  placeholder="Book now — show your coupon when you visit"
                />
              </Field>
            </>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            5. Reward image
            <span className="ml-2 font-sans text-[12px] font-normal text-text-muted">
              — optional
            </span>
          </h3>

          <Field
            label="Image"
            hint="JPEG, PNG, WebP, GIF, or SVG. Up to 4MB. Use this to show the reward visually — a coupon mock, a product photo, a service banner, a gift card."
          >
            <LogoUploader
              accountId={accountId}
              initialUrl={draft.image_url}
              brandColor={draft.accent_color}
              fallbackInitial="🎁"
              fieldName="reward_image_url"
              onChange={(url) => setDraft({ ...draft, image_url: url })}
            />
          </Field>

          <Field
            label="Image shape"
            hint="Card width is fixed — the height adjusts to match this ratio. Image is centered and cropped to fill."
          >
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_OPTIONS.map((opt) => {
                const active = draft.image_aspect === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, image_aspect: opt.value })
                    }
                    title={opt.hint}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "border-forest bg-forest/[0.04] text-ink"
                        : "border-border-base bg-paper text-text-soft hover:bg-hover",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "block flex-shrink-0 rounded-sm",
                        active ? "bg-forest" : "bg-text-muted/40",
                      )}
                      style={{
                        width: 26,
                        aspectRatio: opt.value.replace(":", " / "),
                      }}
                    />
                    <span className="font-mono text-[12px] font-medium">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            6. Reward description
            <span className="ml-2 font-sans text-[12px] font-normal text-text-muted">
              — optional, plain text with line breaks
            </span>
          </h3>

          <Field
            label="Description"
            htmlFor="rw_description"
            hint="Add the fine print — what's included, restrictions, contact info. Markdown-lite: **bold**, *italic*, and bullet lines starting with “-” are rendered. Shown below the image."
          >
            <textarea
              id="rw_description"
              value={draft.description}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  description: e.target.value.slice(0, 1500),
                })
              }
              rows={6}
              maxLength={1500}
              placeholder={"**Includes:**\n- $20 off any service over $80\n- Valid for 90 days\n\n*Questions? Call us at (555) 123-4567.*"}
              className="w-full rounded-md border border-border-base bg-paper px-3 py-2 font-mono text-[13px] text-text leading-relaxed shadow-sm transition-colors focus:border-forest focus:outline-none"
            />
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            7. Visual
          </h3>

          <Field
            label="Accent color"
            hint="Drives the reward card gradient, icon background, and code pill styling. Default gold differentiates the reward from the referral card."
          >
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((p) => {
                const active =
                  draft.accent_color.toLowerCase() === p.value.toLowerCase();
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, accent_color: p.value })
                    }
                    title={p.label}
                    aria-label={p.label}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      active ? "border-ink" : "border-transparent",
                    )}
                    style={{ background: p.value }}
                  />
                );
              })}
              <span className="mx-2 h-6 w-px bg-border-base" aria-hidden="true" />
              <input
                type="color"
                aria-label="Custom accent color"
                value={draft.accent_color}
                onChange={(e) =>
                  setDraft({ ...draft, accent_color: e.target.value })
                }
                className="h-9 w-12 cursor-pointer rounded-md border border-border-base bg-paper p-1"
              />
              <Input
                value={draft.accent_color}
                onChange={(e) =>
                  setDraft({ ...draft, accent_color: e.target.value })
                }
                className="w-28 font-mono uppercase"
              />
              {draft.accent_color.toLowerCase() !== DEFAULT_ACCENT.toLowerCase() && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, accent_color: DEFAULT_ACCENT })
                  }
                  className="text-[12px] text-text-soft hover:underline"
                >
                  Reset to gold
                </button>
              )}
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-base pt-5">
          <div className="text-[13px]">
            {savedAt && !pending && !error && (
              <p className="text-success">✓ Saved.</p>
            )}
            {error && (
              <p role="alert" className="text-alert">
                {error}
              </p>
            )}
          </div>
          <Button type="button" onClick={save} disabled={pending}>
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <p className="text-[12px] text-text-muted">
          The reward card appears on{" "}
          <code className="rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[11.5px]">
            /r/&lt;slug&gt;/thank-you
          </code>{" "}
          after a customer posts a review.
        </p>
      </div>

      {/* LIVE PREVIEW */}
      <aside className="space-y-3">
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
          Live preview — thank-you page
        </p>
        <div className="rounded-2xl border border-border-base bg-cream-deep/40 p-4">
          {draft.enabled && draft.title ? (
            <ReviewerRewardCard
              lang="en"
              reward={{
                title: draft.title,
                subtitle: draft.subtitle || null,
                code: draft.code || null,
                imageUrl: draft.image_url,
                imageAspect: draft.image_aspect,
                description: draft.description || null,
                bookingEnabled: draft.booking_enabled,
                bookingUrl:
                  draft.booking_url ||
                  (draft.booking_enabled ? bookingFallback : null),
                bookingCtaLabel: draft.booking_cta_label || null,
                accentColor: draft.accent_color || DEFAULT_ACCENT,
                expiresAt: draft.expires_at
                  ? new Date(draft.expires_at).toISOString()
                  : null,
                isExpired: draft.expires_at
                  ? new Date(draft.expires_at).getTime() < Date.now()
                  : false,
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border-base bg-paper p-6 text-center text-[13px] text-text-soft">
              {!draft.enabled
                ? "Reward is disabled — toggle it on to see the preview."
                : "Add a reward title to see the preview."}
            </div>
          )}
        </div>
        <p className="text-center text-[11px] text-text-muted">
          Live preview reflects unsaved edits. Save to publish.
          {brandColor && (
            <>
              <br />
              Location:{" "}
              <span className="font-medium text-text-soft">{displayName}</span>
            </>
          )}
        </p>
      </aside>
    </div>
  );
}
