"use client";

import { useEffect } from "react";

/**
 * Faithful re-implementation of public/baam-review-zh.html's inline <script>
 * (readMarketingDoc strips the original). The shared MarketingScripts is for
 * the EN home/pricing prototypes (#nav scroll + ROI calculator) and does NOT
 * cover this page — without this component the `.reveal` sections never get
 * the IntersectionObserver and the page renders blank below the hero.
 */
export function MarketingZhScripts() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // ── Mobile menu toggle ──
    const menuToggle = document.querySelector<HTMLElement>(".menu-toggle");
    const navLinks = document.querySelector<HTMLElement>(".nav-links");
    if (menuToggle && navLinks) {
      const close = () => {
        menuToggle.classList.remove("open");
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      };
      const onToggle = (e: Event) => {
        e.stopPropagation();
        const isOpen = menuToggle.classList.toggle("open");
        navLinks.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      };
      const onOutside = (e: MouseEvent) => {
        const t = e.target as Node;
        if (!navLinks.contains(t) && !menuToggle.contains(t)) close();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") close();
      };
      const linkEls = Array.from(navLinks.querySelectorAll("a"));

      menuToggle.addEventListener("click", onToggle);
      linkEls.forEach((l) => l.addEventListener("click", close));
      document.addEventListener("click", onOutside);
      document.addEventListener("keydown", onKey);

      cleanups.push(() => {
        menuToggle.removeEventListener("click", onToggle);
        linkEls.forEach((l) => l.removeEventListener("click", close));
        document.removeEventListener("click", onOutside);
        document.removeEventListener("keydown", onKey);
      });
    }

    // ── FAQ accordion ──
    const faqHandlers: Array<{ el: Element; fn: () => void }> = [];
    document.querySelectorAll<HTMLElement>(".faq-q").forEach((btn) => {
      const fn = () => btn.parentElement?.classList.toggle("open");
      btn.addEventListener("click", fn);
      faqHandlers.push({ el: btn, fn });
    });
    cleanups.push(() =>
      faqHandlers.forEach(({ el, fn }) => el.removeEventListener("click", fn)),
    );

    // ── Reveal on scroll ──
    const reveals = document.querySelectorAll<HTMLElement>(".reveal");
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15 },
      );
      reveals.forEach((r) => obs.observe(r));
      cleanups.push(() => obs.disconnect());
    } else {
      // No IO support: show everything so nothing is stuck hidden.
      reveals.forEach((r) => r.classList.add("in"));
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
