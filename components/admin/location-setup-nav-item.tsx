"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface LocationSetupNavItemProps {
  label: string;
  icon: React.ReactNode;
  selectedLocationId: string | null;
  locationsCount: number;
}

export function LocationSetupNavItem({
  label,
  icon,
  selectedLocationId,
  locationsCount,
}: LocationSetupNavItemProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasSelectedLocation = Boolean(selectedLocationId);

  // Only active when an actual location is selected and we're on its setup
  // page. With no location selected this item is a no-op (it just prompts to
  // connect one), so it must not highlight on /app/locations — that path
  // belongs to "Manage all locations" (which would otherwise both light up).
  const isActive = hasSelectedLocation
    ? pathname === `/app/locations/${selectedLocationId}` ||
      pathname.startsWith(`/app/locations/${selectedLocationId}/`)
    : false;

  function onClick() {
    if (hasSelectedLocation && selectedLocationId) {
      router.push(`/app/locations/${selectedLocationId}`);
      return;
    }
    if (locationsCount === 0) {
      window.alert("Connect a new location.");
      return;
    }
    router.push("/app/locations");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] transition-colors",
        isActive
          ? "bg-gold/15 text-gold"
          : "text-cream/80 hover:bg-cream/[0.06] hover:text-cream",
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
