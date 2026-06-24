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

    // "Start now" → signup first, then collect billing inside the app.
    // This guarantees the email Stripe charges matches the BAAM Review
    // account email (no typos, no orphaned customer_records rows). The
    // billing checkout pre-fills the Stripe customer_email server-side
    // once the user is signed in. Event-delegated so it survives SPA
    // navigation between marketing pages.
    const onStartNow = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(
        "[data-start-now-fullservice]",
      );
      if (!button) return;
      e.preventDefault();
      window.location.assign("/signup?plan=full");
    };
    document.addEventListener("click", onStartNow);

    // Scroll-spy on the marketing-home nav. The header has anchor links
    // like #why / #pricing / #faq — observe each target section and add
    // .active to the matching link as it scrolls into view. Falls back
    // silently on pages that don't have these elements (e.g. /pricing).
    const navAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        '.nav-links a[href^="#"]',
      ),
    );
    const sectionToLink = new Map<Element, HTMLAnchorElement>();
    for (const a of navAnchors) {
      const id = a.getAttribute("href")?.slice(1);
      if (!id) continue;
      const section = document.getElementById(id);
      if (section) sectionToLink.set(section, a);
    }
    let spy: IntersectionObserver | null = null;
    if (sectionToLink.size > 0 && "IntersectionObserver" in window) {
      const visible = new Set<Element>();
      spy = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) visible.add(e.target);
            else visible.delete(e.target);
          }
          // Pick the section closest to the top of the viewport — that's
          // what the user is currently reading.
          let topSection: Element | null = null;
          let topY = Infinity;
          for (const s of visible) {
            const y = s.getBoundingClientRect().top;
            if (y >= -80 && y < topY) {
              topY = y;
              topSection = s;
            }
          }
          for (const a of navAnchors) a.classList.remove("active");
          if (topSection) {
            const link = sectionToLink.get(topSection);
            link?.classList.add("active");
          }
        },
        { rootMargin: "-80px 0px -55% 0px", threshold: 0 },
      );
      for (const s of sectionToLink.keys()) spy.observe(s);
    }

    // Hero message rotator (homepage only): one message at a time,
    // auto-advance every ~5.5s, pause on hover/touch/focus, and
    // disable autoplay when reduced-motion is requested.
    const heroRotator = document.querySelector<HTMLElement>("[data-hero-rotator]");
    const heroSlides = heroRotator
      ? Array.from(heroRotator.querySelectorAll<HTMLElement>("[data-hero-slide]"))
      : [];
    const heroDots = heroRotator
      ? Array.from(heroRotator.querySelectorAll<HTMLButtonElement>("[data-hero-dot]"))
      : [];
    const heroPrevButton =
      heroRotator?.querySelector<HTMLButtonElement>("[data-hero-prev]") ?? null;
    const heroNextButton =
      heroRotator?.querySelector<HTMLButtonElement>("[data-hero-next]") ?? null;
    const heroCount =
      heroRotator?.querySelector<HTMLElement>("[data-hero-count]") ?? null;

    const heroReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let heroCurrent = 0;
    let heroAutoTimer: number | null = null;
    const heroDotHandlers: Array<() => void> = [];

    const heroSetSlide = (index: number) => {
      if (heroSlides.length === 0) return;
      const total = heroSlides.length;
      heroCurrent = ((index % total) + total) % total;
      heroSlides.forEach((slide, i) => {
        slide.classList.toggle("is-active", i === heroCurrent);
      });
      heroDots.forEach((dot, i) => {
        const active = i === heroCurrent;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-current", active ? "true" : "false");
      });
      if (heroCount) heroCount.textContent = `${heroCurrent + 1} / ${total}`;
    };

    const heroStopAuto = () => {
      if (heroAutoTimer !== null) {
        window.clearInterval(heroAutoTimer);
        heroAutoTimer = null;
      }
    };
    const heroStartAuto = () => {
      if (heroSlides.length <= 1 || heroReducedMotion.matches || heroAutoTimer !== null) {
        return;
      }
      heroAutoTimer = window.setInterval(() => {
        heroSetSlide(heroCurrent + 1);
      }, 5500);
    };
    const heroRestartAuto = () => {
      heroStopAuto();
      heroStartAuto();
    };
    const onHeroPrev = () => {
      heroSetSlide(heroCurrent - 1);
      heroRestartAuto();
    };
    const onHeroNext = () => {
      heroSetSlide(heroCurrent + 1);
      heroRestartAuto();
    };
    const onHeroPointerEnter = () => heroStopAuto();
    const onHeroPointerLeave = () => heroStartAuto();
    const onHeroTouchStart = () => heroStopAuto();
    const onHeroTouchEnd = () => heroStartAuto();
    const onHeroFocusIn = () => heroStopAuto();
    const onHeroFocusOut = () => {
      if (!heroRotator?.contains(document.activeElement)) heroStartAuto();
    };
    const onHeroReducedMotionChange = () => {
      if (heroReducedMotion.matches) heroStopAuto();
      else heroStartAuto();
    };

    if (heroRotator && heroSlides.length > 0) {
      heroSetSlide(0);
      heroStartAuto();

      heroPrevButton?.addEventListener("click", onHeroPrev);
      heroNextButton?.addEventListener("click", onHeroNext);
      for (const dot of heroDots) {
        const onHeroDotClick = () => {
          const raw = dot.getAttribute("data-hero-index");
          const target = raw ? Number.parseInt(raw, 10) : Number.NaN;
          if (!Number.isNaN(target)) {
            heroSetSlide(target);
            heroRestartAuto();
          }
        };
        heroDotHandlers.push(onHeroDotClick);
        dot.addEventListener("click", onHeroDotClick);
      }

      heroRotator.addEventListener("mouseenter", onHeroPointerEnter);
      heroRotator.addEventListener("mouseleave", onHeroPointerLeave);
      heroRotator.addEventListener("touchstart", onHeroTouchStart, { passive: true });
      heroRotator.addEventListener("touchend", onHeroTouchEnd, { passive: true });
      heroRotator.addEventListener("focusin", onHeroFocusIn);
      heroRotator.addEventListener("focusout", onHeroFocusOut);
      heroReducedMotion.addEventListener("change", onHeroReducedMotionChange);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (recalc) {
        cvSlider?.removeEventListener("input", recalc);
        cmSlider?.removeEventListener("input", recalc);
        liftSlider?.removeEventListener("input", recalc);
      }
      document.removeEventListener("click", onStartNow);
      spy?.disconnect();

      heroStopAuto();
      heroPrevButton?.removeEventListener("click", onHeroPrev);
      heroNextButton?.removeEventListener("click", onHeroNext);
      for (const [index, dot] of heroDots.entries()) {
        const handler = heroDotHandlers[index];
        if (handler) dot.removeEventListener("click", handler);
      }
      heroRotator?.removeEventListener("mouseenter", onHeroPointerEnter);
      heroRotator?.removeEventListener("mouseleave", onHeroPointerLeave);
      heroRotator?.removeEventListener("touchstart", onHeroTouchStart);
      heroRotator?.removeEventListener("touchend", onHeroTouchEnd);
      heroRotator?.removeEventListener("focusin", onHeroFocusIn);
      heroRotator?.removeEventListener("focusout", onHeroFocusOut);
      heroReducedMotion.removeEventListener("change", onHeroReducedMotionChange);
    };
  }, []);

  return null;
}
