import Link from "next/link";
import { markRequestReviewActivated } from "./actions/onboarding";

type StepState = "done" | "active" | "pending";

interface Step {
  index: number;
  label: string;
  state: StepState;
}

interface OnboardingProgressProps {
  hasLocation: boolean;
  hasBilling: boolean;
  hasActivatedRequest: boolean;
}

/**
 * Three-step "Getting started" bar shown on the dashboard until all three
 * onboarding milestones are met. Once all three are done the bar hides
 * permanently (driven by accounts.onboarding_request_activated_at being
 * set — see markRequestReviewActivated server action).
 *
 * Existing customers adding a second location skip this entirely because
 * `hasLocation` will already be true and the third flag is permanent.
 */
export function OnboardingProgress({
  hasLocation,
  hasBilling,
  hasActivatedRequest,
}: OnboardingProgressProps) {
  if (hasLocation && hasBilling && hasActivatedRequest) return null;

  const stepDone = [hasLocation, hasBilling, hasActivatedRequest];
  const doneCount = stepDone.filter(Boolean).length;
  const activeIndex = stepDone.findIndex((d) => !d);

  const steps: Step[] = [
    { index: 1, label: "Connect Google location", state: stateFor(0) },
    { index: 2, label: "Set up billing", state: stateFor(1) },
    { index: 3, label: "Start Review Request", state: stateFor(2) },
  ];

  function stateFor(i: number): StepState {
    if (stepDone[i]) return "done";
    if (i === activeIndex) return "active";
    return "pending";
  }

  return (
    <section className="rounded-2xl border border-border-base bg-paper px-7 py-6">
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-gold-dark font-semibold">
          Getting started
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
            isLast={i === steps.length - 1}
          />
        ))}
      </div>

      <CtaRow
        activeIndex={activeIndex}
        hasLocation={hasLocation}
        hasBilling={hasBilling}
      />
    </section>
  );
}

function StepDisplay({ step, isLast }: { step: Step; isLast: boolean }) {
  const circleClass =
    step.state === "done"
      ? "bg-success border-success text-cream"
      : step.state === "active"
        ? "bg-gold border-gold text-ink ring-[6px] ring-gold/20"
        : "bg-paper border-border text-text-muted";

  const labelClass =
    step.state === "pending"
      ? "text-text-muted"
      : step.state === "done"
        ? "text-ink font-normal"
        : "text-ink";

  const connectorClass =
    step.state === "done" ? "bg-success" : "bg-border";

  return (
    <div className="flex flex-col items-center text-center relative px-2">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] font-display text-[14px] font-medium relative z-[2] ${circleClass}`}
      >
        {step.state === "done" ? (
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

function CtaRow({
  activeIndex,
  hasLocation,
  hasBilling,
}: {
  activeIndex: number;
  hasLocation: boolean;
  hasBilling: boolean;
}) {
  if (activeIndex === -1) return null;

  if (!hasLocation) {
    return (
      <CtaWrap>
        <Link
          href="/api/auth/google/start"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full bg-forest text-cream px-5 py-2.5 text-[13.5px] font-medium hover:bg-forest-dark"
        >
          Connect Google Business Profile →
        </Link>
      </CtaWrap>
    );
  }

  if (!hasBilling) {
    return (
      <CtaWrap>
        <Link
          href="/app/billing"
          className="inline-flex items-center gap-2 rounded-full bg-forest text-cream px-5 py-2.5 text-[13.5px] font-medium hover:bg-forest-dark"
        >
          Set up billing →
        </Link>
      </CtaWrap>
    );
  }

  return (
    <CtaWrap>
      <form action={markRequestReviewActivated}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-forest text-cream px-5 py-2.5 text-[13.5px] font-medium hover:bg-forest-dark"
        >
          Start Review Request →
        </button>
      </form>
    </CtaWrap>
  );
}

function CtaWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-1">{children}</div>
  );
}
