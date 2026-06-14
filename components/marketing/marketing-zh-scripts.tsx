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

    // ── "Start now — we'll set it up" → Stripe Checkout ──
    // Event-delegated so it survives mid-page DOM changes and SPA
    // navigation — attaching per-button via querySelectorAll on mount
    // missed clicks when the button rendered after the effect ran.
    // 「立即开始」 → 先注册账号,再在系统内收款。保证 Stripe 扣款邮箱
    // 与 BAAM Review 账号邮箱一致,避免输入错误造成的孤立记录。
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
    cleanups.push(() => document.removeEventListener("click", onStartNow));

    // ── Audit sample card: count-up score, fill competitor bars, draw
    //    trajectory. Faithful port of the page's stripped #audit-report inline
    //    script. Without it the score stays "0" and the bars/trajectory (which
    //    start at width:0 / undrawn) never animate in.
    const auditReport = document.getElementById("audit-report");
    if (auditReport) {
      const animateAudit = () => {
        const scoreEl =
          auditReport.querySelector<HTMLElement>(".audit-score-number");
        if (scoreEl) {
          const target = parseInt(scoreEl.dataset.count || "0", 10) || 0;
          const dur = 1100;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            scoreEl.textContent = String(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
        // Competitor bars — staggered fill (CSS width transition).
        auditReport
          .querySelectorAll<HTMLElement>(".cbar-fill")
          .forEach((el, i) => {
            const t = window.setTimeout(() => {
              el.style.width = `${el.dataset.w || 0}%`;
            }, 150 + i * 90);
            cleanups.push(() => window.clearTimeout(t));
          });
        // Trajectory line draw + dots.
        auditReport
          .querySelectorAll<SVGGeometryElement>(".traj-line")
          .forEach((line) => {
            const len = line.getTotalLength();
            line.style.strokeDasharray = String(len);
            line.style.strokeDashoffset = String(len);
            void line.getBoundingClientRect();
            line.classList.add("draw");
          });
        const dotsT = window.setTimeout(() => {
          auditReport
            .querySelectorAll(".traj-dot")
            .forEach((d) => d.classList.add("show"));
        }, 1500);
        cleanups.push(() => window.clearTimeout(dotsT));
      };

      if ("IntersectionObserver" in window) {
        const aObs = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                animateAudit();
                aObs.unobserve(e.target);
              }
            });
          },
          { threshold: 0.3 },
        );
        aObs.observe(auditReport);
        cleanups.push(() => aObs.disconnect());
      } else {
        animateAudit();
      }
    }

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
