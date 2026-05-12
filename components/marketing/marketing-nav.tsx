"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/#loop", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#roi", label: "ROI" },
  { href: "/#languages", label: "Languages" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent bg-cream/85 py-6 backdrop-blur-md backdrop-saturate-150 transition-colors",
        scrolled && "border-border-base",
      )}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-forest text-[14px] font-semibold text-cream">
            B
          </span>
          <span className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
            BAAM Review
          </span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[14.5px] text-text-soft transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-full px-5 py-2.5 text-[14.5px] font-medium text-text transition-colors hover:bg-cream-deep sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-forest px-5 py-2.5 text-[14.5px] font-medium text-cream transition-all hover:-translate-y-px hover:bg-forest-dark hover:shadow-md"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
}
