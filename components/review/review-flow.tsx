"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Lock } from "lucide-react";
import type { Language } from "@/lib/i18n/review";
import { STRINGS } from "@/lib/i18n/review";
import { ChipGroup } from "./chip-group";
import { StarRating } from "./star-rating";
import { track, type TrackContext } from "./track";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReviewFlowProps {
  ctx: TrackContext;
  lang: Language;
  slug: string;
  serviceChips: readonly string[];
  descriptorChips: readonly string[];
  googleReviewUrl: string | null;
  yelpUrl: string | null;
  customUrl: string | null;
  customUrlLabel: string | null;
  privateFeedbackHref: string;
}

export function ReviewFlow({
  ctx,
  lang,
  slug,
  serviceChips,
  descriptorChips,
  googleReviewUrl,
  yelpUrl,
  customUrl,
  customUrlLabel,
  privateFeedbackHref,
}: ReviewFlowProps) {
  const s = STRINGS[lang];

  const [service, setService] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [descriptor, setDescriptor] = useState<string | null>(null);

  // Fire page_view on mount.
  useEffect(() => {
    track(ctx, "page_view");
    // Intentionally only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(field: string, value: unknown) {
    track(ctx, "question_answered", { field, value });
  }

  function clickPlatform(platform: "google" | "yelp" | "custom", href: string) {
    track(ctx, "platform_clicked", {
      platform,
      service,
      rating,
      descriptor,
    });
    window.open(href, "_blank", "noopener,noreferrer");
    window.location.href = `/r/${slug}/thank-you?via=${platform}&lang=${lang}`;
  }

  return (
    <div className="space-y-8">
      <Section title={s.step_service}>
        <ChipGroup
          options={serviceChips}
          value={service}
          onChange={(v) => {
            setService(v);
            if (v) commit("service", v);
          }}
          otherLabel={s.other_chip}
          otherPlaceholder={s.other_placeholder}
        />
      </Section>

      <Section title={s.step_rating}>
        <div className="space-y-2">
          <StarRating
            value={rating}
            onChange={(n) => {
              setRating(n);
              commit("rating", n);
            }}
          />
          {rating === 0 && (
            <p className="text-[12px] text-text-muted">{s.rating_helper}</p>
          )}
        </div>
      </Section>

      <Section title={s.step_descriptor}>
        <ChipGroup
          options={descriptorChips}
          value={descriptor}
          onChange={(v) => {
            setDescriptor(v);
            if (v) commit("descriptor", v);
          }}
          otherLabel={s.other_chip}
          otherPlaceholder={s.other_placeholder}
        />
      </Section>

      <div className="space-y-3 pt-2">
        {googleReviewUrl && (
          <PlatformButton
            primary
            href={googleReviewUrl}
            label={s.cta_google}
            onClick={() => clickPlatform("google", googleReviewUrl)}
          />
        )}
        {yelpUrl && (
          <PlatformButton
            href={yelpUrl}
            label={s.cta_yelp}
            onClick={() => clickPlatform("yelp", yelpUrl)}
          />
        )}
        {customUrl && customUrlLabel && (
          <PlatformButton
            href={customUrl}
            label={customUrlLabel}
            onClick={() => clickPlatform("custom", customUrl)}
          />
        )}
      </div>

      <div className="border-t border-border-base pt-5">
        <Link
          href={privateFeedbackHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-text-soft hover:text-text"
        >
          <Lock className="h-3.5 w-3.5" />
          {s.private_link}
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-text-muted">
        {title}
      </h2>
      {children}
    </div>
  );
}

function PlatformButton({
  primary,
  label,
  onClick,
}: {
  primary?: boolean;
  href: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        buttonVariants({
          variant: primary ? "primary" : "secondary",
          size: "lg",
        }),
        "w-full",
      )}
    >
      {label}
      {primary ? (
        <ArrowRight className="h-4 w-4" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
    </button>
  );
}
