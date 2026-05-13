"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Save } from "lucide-react";
import type { ReferralConfig } from "@/lib/database.types";
import { Field } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogoUploader } from "@/components/locations/logo-uploader";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { saveReferralConfig } from "./actions";

interface ReferralSetupProps {
  locationId: string;
  locationSlug: string;
  brandColor: string;
  bookingFallback: string | null;
  appUrl: string;
  initialConfig: ReferralConfig;
}

interface Draft {
  enabled: boolean;
  offer_title: string;
  offer_subtitle: string;
  offer_code: string;
  offer_image_url: string | null;
  cta_label: string;
  cta_url: string;
  expires_at: string; // YYYY-MM-DD or ""
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ReferralSetup({
  locationId,
  locationSlug,
  brandColor,
  bookingFallback,
  appUrl,
  initialConfig,
}: ReferralSetupProps) {
  const [draft, setDraft] = useState<Draft>({
    enabled: initialConfig.enabled !== false,
    offer_title: initialConfig.offer_title ?? "",
    offer_subtitle: initialConfig.offer_subtitle ?? "",
    offer_code: initialConfig.offer_code ?? "",
    offer_image_url: initialConfig.offer_image_url ?? null,
    cta_label: initialConfig.cta_label ?? "Book with this offer",
    cta_url: initialConfig.cta_url ?? "",
    expires_at: toDateInput(initialConfig.expires_at),
  });

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Preview URL needs a REAL review_request id for this location; we fetch
  // the most recent one once on mount. If the location has no requests yet
  // we render a no-token placeholder.
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("review_requests")
        .select("id")
        .eq("location_id", locationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setPreviewToken(data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  // Resolve admin origin so localhost dev hits its own /s/[token] route.
  const [previewOrigin, setPreviewOrigin] = useState(appUrl);
  useEffect(() => {
    if (typeof window !== "undefined")
      setPreviewOrigin(window.location.origin);
  }, []);

  const previewUrl = useMemo(() => {
    if (!previewToken) return null;
    const u = new URL(`${previewOrigin}/s/${previewToken}`);
    u.searchParams.set("preview", "1");
    u.searchParams.set("enabled", draft.enabled ? "1" : "0");
    u.searchParams.set("offer_title", draft.offer_title);
    u.searchParams.set("offer_subtitle", draft.offer_subtitle);
    u.searchParams.set("offer_code", draft.offer_code);
    if (draft.offer_image_url)
      u.searchParams.set("offer_image", draft.offer_image_url);
    u.searchParams.set("cta_label", draft.cta_label);
    u.searchParams.set("cta_url", draft.cta_url);
    u.searchParams.set("expires_at", draft.expires_at);
    return u.toString();
  }, [previewOrigin, previewToken, draft]);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveReferralConfig(locationId, {
        enabled: draft.enabled,
        offer_title: draft.offer_title || null,
        offer_subtitle: draft.offer_subtitle || null,
        offer_code: draft.offer_code || null,
        offer_image_url: draft.offer_image_url,
        cta_label: draft.cta_label || null,
        cta_url: draft.cta_url || null,
        expires_at: draft.expires_at || null,
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
            onChange={(e) =>
              setDraft({ ...draft, enabled: e.target.checked })
            }
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
            {draft.enabled && <Check className="h-3 w-3 text-cream stroke-[3.5]" />}
          </span>
          <div className="text-left">
            <div className="text-[13.5px] font-medium text-ink">
              Show the referral offer on share landing pages
            </div>
            <div className="text-[12px] text-text-soft">
              Turning this off hides the offer block but keeps the
              recommendation card.
            </div>
          </div>
        </label>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            Offer
          </h3>

          <Field
            label="Offer title"
            htmlFor="ref_title"
            hint="The headline that hooks the friend. e.g. “$20 off your first visit”."
          >
            <Input
              id="ref_title"
              value={draft.offer_title}
              onChange={(e) =>
                setDraft({ ...draft, offer_title: e.target.value.slice(0, 80) })
              }
              maxLength={80}
              placeholder="$20 off your first visit"
            />
          </Field>

          <Field
            label="Offer subtitle"
            htmlFor="ref_subtitle"
            hint="One supporting line. Restrictions, eligibility, the small print."
          >
            <textarea
              id="ref_subtitle"
              value={draft.offer_subtitle}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  offer_subtitle: e.target.value.slice(0, 240),
                })
              }
              rows={2}
              maxLength={240}
              placeholder="Use this code at booking. Valid for new patients only."
              className="w-full rounded-md border border-border-base bg-paper px-3 py-2 text-[14px] text-text shadow-sm transition-colors focus:border-forest focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Discount code"
              htmlFor="ref_code"
              hint="Auto-uppercased, no spaces."
            >
              <Input
                id="ref_code"
                value={draft.offer_code}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    offer_code: e.target.value
                      .replace(/\s+/g, "")
                      .toUpperCase()
                      .slice(0, 30),
                  })
                }
                placeholder="FRIEND10"
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Expires" htmlFor="ref_expires" hint="Optional.">
              <Input
                id="ref_expires"
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
            Visual
          </h3>
          <Field
            label="Hero image"
            hint="Optional. Shown above the offer title — service photo, product shot, etc. 1200×630 recommended."
          >
            <LogoUploader
              accountId={locationId}
              initialUrl={draft.offer_image_url}
              brandColor={brandColor}
              fallbackInitial="📷"
              fieldName="offer_image_url"
              onChange={(url) =>
                setDraft({ ...draft, offer_image_url: url })
              }
            />
          </Field>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-[17px] font-medium text-ink">
            Call to action
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button label" htmlFor="ref_cta_label">
              <Input
                id="ref_cta_label"
                value={draft.cta_label}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    cta_label: e.target.value.slice(0, 60),
                  })
                }
                maxLength={60}
                placeholder="Book with this offer"
              />
            </Field>
            <Field
              label="Button URL"
              htmlFor="ref_cta_url"
              hint={
                bookingFallback
                  ? `Defaults to your booking URL`
                  : "Required if no booking URL is set on the location"
              }
            >
              <Input
                id="ref_cta_url"
                type="url"
                value={draft.cta_url}
                onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
                placeholder={
                  bookingFallback ?? "https://book.example.com/..."
                }
                className="font-mono text-[12.5px]"
              />
            </Field>
          </div>
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
          Public share-landing URL pattern:{" "}
          <code className="rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[11.5px]">
            {previewOrigin || appUrl}/s/&lt;reviewer_id&gt;
          </code>
          . Friends arrive here when an existing reviewer shares their card.
        </p>
      </div>

      {/* LIVE PREVIEW */}
      <aside className="space-y-3">
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
          Live preview — share landing
        </p>
        {previewUrl ? (
          <div className="overflow-hidden rounded-2xl border border-border-base bg-cream-deep/40">
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="Share landing preview"
              className="block w-full border-0 bg-transparent"
              style={{ height: 900 }}
              scrolling="auto"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border-base bg-paper p-6 text-center">
            <p className="text-[13px] text-text-soft">
              No review requests yet for this location — preview becomes
              available after the first send.
            </p>
          </div>
        )}
        <p className="text-[11.5px] text-text-muted text-center">
          Preview uses your latest reviewer record. Save to publish changes.
          Slug: <span className="font-mono">{locationSlug}</span>
        </p>
      </aside>
    </div>
  );
}
