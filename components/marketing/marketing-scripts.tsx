"use client";

import { useEffect } from "react";

/**
 * Faithful re-implementation of the marketing prototypes' inline <script>
 * (lib/marketing/render.ts strips the original). Operates on the IDs in the
 * server-injected prototype markup. The ROI block is homepage-only and no-ops
 * gracefully when those elements aren't present (pricing pages).
 */
export function MarketingScripts() {
  useEffect(() => {
    // Nav border-on-scroll (both home + pricing prototypes use #nav).
    const nav = document.getElementById("nav");
    const onScroll = () => {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // ROI calculator (homepage only).
    const cvSlider = document.getElementById("roi-cv") as HTMLInputElement | null;
    const cmSlider = document.getElementById("roi-cm") as HTMLInputElement | null;
    const liftSlider = document.getElementById("roi-lift") as HTMLInputElement | null;
    const cvVal = document.getElementById("roi-cv-val");
    const cmVal = document.getElementById("roi-cm-val");
    const liftVal = document.getElementById("roi-lift-val");
    const out = document.getElementById("roi-out");
    const extraCustomersEl = document.getElementById("roi-extra-customers");
    const multipleEl = document.getElementById("roi-multiple");

    const fmt = (n: number) =>
      n.toLocaleString("en-US", { maximumFractionDigits: 0 });

    let recalc: (() => void) | null = null;
    if (cvSlider && cmSlider && liftSlider) {
      recalc = () => {
        const cv = parseInt(cvSlider.value);
        const cm = parseInt(cmSlider.value);
        const lift = parseInt(liftSlider.value);
        if (cvVal) cvVal.textContent = fmt(cv);
        if (cmVal) cmVal.textContent = fmt(cm);
        if (liftVal) liftVal.textContent = String(lift);

        const extraCustomers = Math.round(cm * (lift / 100));
        const monthlyImpact = extraCustomers * cv;
        if (out) out.textContent = fmt(monthlyImpact);
        if (extraCustomersEl)
          extraCustomersEl.textContent = String(extraCustomers);

        const multiple = Math.round(monthlyImpact / 99);
        if (multipleEl)
          multipleEl.textContent = (multiple >= 1 ? multiple : 1) + "×";
      };
      cvSlider.addEventListener("input", recalc);
      cmSlider.addEventListener("input", recalc);
      liftSlider.addEventListener("input", recalc);
      recalc();
    }

    // "Start now" → Stripe Checkout. POSTs to /api/billing/start-fullservice
    // and redirects to the hosted Stripe URL. The inline <script> in
    // marketing-pricing.html is stripped at render time (see
    // lib/marketing/render.ts), so the handler lives here. Errors surface as
    // an alert; richer error UI is a TODO.
    const startNowButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-start-now-fullservice]",
      ),
    );
    const onStartNow = async (e: Event) => {
      e.preventDefault();
      const button = e.currentTarget as HTMLButtonElement;
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "Loading Stripe…";
      try {
        const res = await fetch("/api/billing/start-fullservice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval: "month" }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Could not start checkout");
        }
        window.location.assign(data.url);
      } catch (err) {
        button.disabled = false;
        button.textContent = original;
        alert(
          "Sorry — could not start checkout. Please try again, or email support@baamplatform.com.",
        );
        console.error(err);
      }
    };
    startNowButtons.forEach((b) =>
      b.addEventListener("click", onStartNow),
    );

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (recalc) {
        cvSlider?.removeEventListener("input", recalc);
        cmSlider?.removeEventListener("input", recalc);
        liftSlider?.removeEventListener("input", recalc);
      }
      startNowButtons.forEach((b) =>
        b.removeEventListener("click", onStartNow),
      );
    };
  }, []);

  return null;
}
