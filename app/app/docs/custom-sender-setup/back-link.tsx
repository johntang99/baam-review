"use client";

import { useRouter } from "next/navigation";

/**
 * Browser-back button. Used in place of next/link because there's no
 * fixed parent route — the SOP page can be reached from any location's
 * settings page (and is typically opened in a new tab anyway, in which
 * case this button just closes nothing — that's fine; the X button on
 * the tab is the primary close affordance).
 */
export function BackLink({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.04em] text-text-muted font-medium hover:text-ink mb-7"
    >
      {children}
    </button>
  );
}
