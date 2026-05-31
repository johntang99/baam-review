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

  const isActive = hasSelectedLocation
    ? pathname === `/app/locations/${selectedLocationId}` ||
      pathname.startsWith(`/app/locations/${selectedLocationId}/`)
    : pathname === "/app/locations";

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
