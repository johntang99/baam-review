"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Lock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Language } from "@/lib/i18n/review";
import { STRINGS } from "@/lib/i18n/review";
import { ChipGroup } from "./chip-group";
import { StarRating } from "./star-rating";
import { track, type TrackContext } from "./track";
import { DraftPicker, type Draft } from "./draft-picker";
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

type Phase = "input" | "loading" | "drafts" | "error";

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
  const [rating, setRating] = useState<number>(5);
  const [descriptor, setDescriptor] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("input");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    track(ctx, "page_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(field: string, value: unknown) {
    track(ctx, "question_answered", { field, value });
  }

  async function fetchDrafts(opts: { regenerate?: boolean } = {}) {
    setPhase(opts.regenerate ? "drafts" : "loading");
    setGenError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: ctx.locationId,
          request_id: ctx.requestId,
          service,
          rating,
          descriptor,
          language: lang,
          regenerate: !!opts.regenerate,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { drafts: Draft[] };
      setDrafts(json.drafts);
      setPhase("drafts");
    } catch (e) {
      console.error(e);
      setGenError(s.drafts_failed);
      setPhase("error");
    }
  }

  function fallbackToPlatform(
    platform: "google" | "yelp" | "custom",
    href: string,
  ) {
    track(ctx, "platform_clicked", {
      platform,
      service,
      rating,
      descriptor,
      skipped_drafts: true,
    });
    window.open(href, "_blank", "noopener,noreferrer");
    window.location.href = `/r/${slug}/thank-you?via=${platform}&lang=${lang}`;
  }

  if (phase === "drafts") {
    return (
      <DraftPicker
        ctx={ctx}
        lang={lang}
        slug={slug}
        googleReviewUrl={googleReviewUrl}
        drafts={drafts}
        inputsSummary={{ service, rating, descriptor }}
        onBack={() => setPhase("input")}
        onRegenerate={() => fetchDrafts({ regenerate: true })}
        isRegenerating={false}
      />
    );
  }

  if (phase === "loading") {
    return (
      <LoadingState lang={lang} />
    );
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
        <StarRating
          value={rating}
          onChange={(n) => {
            setRating(n);
            commit("rating", n);
          }}
        />
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
        {googleReviewUrl ? (
          <button
            type="button"
            onClick={() => fetchDrafts()}
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "w-full",
            )}
          >
            <Sparkles className="h-4 w-4" />
            {s.cta_generate}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}

        {phase === "error" && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-xl border border-alert/30 bg-alert/5 p-3 text-[13px] text-alert"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{genError}</p>
          </div>
        )}

        {/* Skip option — always visible, in case Claude is down or the customer
            already knows what to write. */}
        {googleReviewUrl && (
          <button
            type="button"
            onClick={() => fallbackToPlatform("google", googleReviewUrl)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "w-full",
            )}
          >
            {phase === "error" ? s.cta_google : s.drafts_skip}
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}

        {yelpUrl && (
          <button
            type="button"
            onClick={() => fallbackToPlatform("yelp", yelpUrl)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "w-full",
            )}
          >
            {s.cta_yelp}
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
        {customUrl && customUrlLabel && (
          <button
            type="button"
            onClick={() => fallbackToPlatform("custom", customUrl)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "w-full",
            )}
          >
            {customUrlLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
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

function LoadingState({ lang }: { lang: Language }) {
  const s = STRINGS[lang];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-forest" />
        </span>
        <p className="text-[14px] text-text">{s.cta_generating}</p>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border-base bg-paper p-4 space-y-2"
          >
            <div className="h-2 w-12 rounded bg-cream-deep animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-full rounded bg-cream-deep animate-pulse" />
              <div className="h-2.5 w-[90%] rounded bg-cream-deep animate-pulse" />
              <div className="h-2.5 w-[80%] rounded bg-cream-deep animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
