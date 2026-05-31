"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItemProps {
  href: string;
  label: string;
  /**
   * Pre-rendered icon element (server-component side). Passing the icon
   * *component* through props would fail with "Functions cannot be passed
   * directly to Client Components" — Lucide icons aren't serializable, but
   * the React element they produce is.
   */
  icon: React.ReactNode;
  /** Optional trailing count chip (e.g. active+pending Lists). Hidden when 0. */
  badge?: number;
  /** Force exact pathname match (no startsWith matching). */
  exact?: boolean;
}

export function NavItem({ href, label, icon, badge, exact }: NavItemProps) {
  const pathname = usePathname();

  // Exact match for /app (dashboard) to avoid matching every /app/* path.
  // Prefix match for everything else (so e.g. /app/locations/[id]/reviews
  // highlights the parent "Reviews" item if you choose to nest).
  const isActive = exact
    ? pathname === href
    : href === "/app"
      ? pathname === "/app"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] transition-colors",
        isActive
          ? "bg-gold/15 text-gold"
          : "text-cream/80 hover:bg-cream/[0.06] hover:text-cream",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] rounded-full bg-gold px-1.5 py-px text-center text-[10px] font-semibold tabular-nums text-ink">
          {badge}
        </span>
      )}
    </Link>
  );
}
