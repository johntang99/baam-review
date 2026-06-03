import Link from "next/link";
import { markRequestReviewActivated } from "./actions/onboarding";
import type { ReviewPlan } from "@/lib/onboarding/status";

type StepState = "done" | "active" | "pending";

type CtaConfig =
  | { kind: "link"; href: string; label: string; prefetch?: false }
  | { kind: "form"; label: string }
  | { kind: "passive"; label: string };

interface StepConfig {
  index: number;
  label: string;
  done: boolean;
  cta: CtaConfig;
}

interface OnboardingProgressProps {
  plan: ReviewPlan;
  hasLocation: boolean;
  hasBilling: boolean;
  hasActivatedRequest: boolean;
}

/**
 * Three-step "Getting started" bar shown until all three onboarding
 * milestones are met. The step order and CTAs differ by plan:
 *
 *   Self Service (or no plan picked yet):
 *     1. Connect Google location  (user does it via OAuth)
 *     2. Set up billing
 *     3. Start Review Request
 *
 *   Full Service:
 *     1. Set up billing  (user pays for trial — comes first)
 *     2. BAAM connects your GBP  (passive — no CTA, staff does it)
 *     3. Start Review Request
 *
 * Bar hides entirely once all three are done.
 */
export function OnboardingProgress({
  plan,
  hasLocation,
  hasBilling,
  hasActivatedRequest,
}: OnboardingProgressProps) {
  if (hasLocation && hasBilling && hasActivatedRequest) return null;

  const steps: StepConfig[] =
    plan === "full_service"
      ? [
          {
            index: 1,
            label: "Set up billing",
            done: hasBilling,
            cta: {
              kind: "link",
              href: "/app/billing",
              label: "Set up billing →",
            },
          },
          {
            index: 2,
            label: "BAAM connects your GBP",
            done: hasLocation,
            cta: {
              kind: "passive",
              label: "Usually within 1 business day after billing setup.",
            },
          },
          {
            index: 3,
            label: "Start Review Request",
            done: hasActivatedRequest,
            cta: { kind: "form", label: "Start Review Request →" },
          },
        ]
      : [
          {
            index: 1,
            label: "Connect Google location",
            done: hasLocation,
            cta: {
              kind: "link",
              href: "/api/auth/google/start",
              label: "Connect Google Business Profile →",
              prefetch: false,
            },
          },
          {
            index: 2,
            label: "Set up billing",
            done: hasBilling,
            cta: {
              kind: "link",
              href: "/app/billing",
              label: "Set up billing →",
            },
          },
          {
            index: 3,
            label: "Start Review Request",
            done: hasActivatedRequest,
            cta: { kind: "form", label: "Start Review Request →" },
          },
        ];

  const doneCount = steps.filter((s) => s.done).length;
  const activeIndex = steps.findIndex((s) => !s.done);

  return (
    <section className="rounded-2xl border border-border-base bg-paper px-7 py-6">
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-gold-dark font-semibold">
          Getting started
          {plan && (
            <>
              <span className="mx-2 text-text-muted">·</span>
              <span className="text-text-soft">
                {plan === "full_service" ? "Full Service" : "Self-Service"}
              </span>
            </>
          )}
        </span>
        <span className="text-[11px] text-text-muted font-mono">
          {doneCount} of 3 complete
        </span>
      </div>

      <div className="grid grid-cols-3 gap-0 relative mb-5">
        {steps.map((step, i) => (
          <StepDisplay
            key={step.index}
            step={step}
            state={
              step.done
                ? "done"
                : i === activeIndex
                  ? "active"
                  : "pending"
            }
            isLast={i === steps.length - 1}
          />
        ))}
      </div>

      {activeIndex !== -1 && <CtaRow cta={steps[activeIndex].cta} />}
    </section>
  );
}

function StepDisplay({
  step,
  state,
  isLast,
}: {
  step: StepConfig;
  state: StepState;
  isLast: boolean;
}) {
  const circleClass =
    state === "done"
      ? "bg-success border-success text-cream"
      : state === "active"
        ? "bg-gold border-gold text-ink ring-[6px] ring-gold/20"
        : "bg-paper border-border text-text-muted";

  const labelClass =
    state === "pending"
      ? "text-text-muted"
      : state === "done"
        ? "text-ink font-normal"
        : "text-ink";

  const connectorClass = state === "done" ? "bg-success" : "bg-border";

  return (
    <div className="flex flex-col items-center text-center relative px-2">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] font-display text-[14px] font-medium relative z-[2] ${circleClass}`}
      >
        {state === "done" ? (
          <span className="font-sans font-bold text-[15px] leading-none">
            ✓
          </span>
        ) : (
          step.index
        )}
      </div>
      <div
        className={`mt-2.5 text-[13px] font-medium leading-tight ${labelClass}`}
      >
        {step.label}
      </div>
      {!isLast && (
        <span
          className={`absolute top-[17px] h-[2px] z-[1] ${connectorClass}`}
          style={{
            left: "calc(50% + 22px)",
            right: "calc(-50% + 22px)",
          }}
        />
      )}
    </div>
  );
}

function CtaRow({ cta }: { cta: CtaConfig }) {
  if (cta.kind === "passive") {
    return (
      <div className="flex flex-col items-center gap-2 pt-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-cream-deep px-4 py-2 text-[13px] font-medium text-text-soft">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
          {cta.label}
        </span>
      </div>
    );
  }

  if (cta.kind === "link") {
    return (
      <div className="flex flex-col items-center gap-2 pt-1">
        <Link
          href={cta.href}
          prefetch={cta.prefetch}
          className="inline-flex items-center gap-2 rounded-full bg-forest text-cream px-5 py-2.5 text-[13.5px] font-medium hover:bg-forest-dark"
        >
          {cta.label}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <form action={markRequestReviewActivated}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-forest text-cream px-5 py-2.5 text-[13.5px] font-medium hover:bg-forest-dark"
        >
          {cta.label}
        </button>
      </form>
    </div>
  );
}
