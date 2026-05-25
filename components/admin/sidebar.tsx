import Link from "next/link";
import {
  LayoutDashboard,
  Send,
  ClipboardCheck,
  Star,
  BarChart3,
  Settings,
  Share2,
  CreditCard,
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { UserCard } from "./user-card";
import { NavItem } from "./nav-item";
import { SignOutNavItem } from "./sign-out-nav-item";
import {
  LocationSwitcher,
  type LocationSwitcherLocation,
} from "./location-switcher";
import type { OpsRole } from "@/lib/database.types";

interface SidebarProps {
  fullName: string | null;
  email: string;
  locations: LocationSwitcherLocation[];
  selectedLocationId: string | null;
  /** Count of active+pending lists, shown as a badge on the Lists item. */
  listsBadge?: number;
  /**
   * Ops role of the current user. Drives which items in the BAAM
   * Operations section render:
   *   • admin            → Onboarding queue + Staff access
   *   • sales            → Onboarding queue only
   *   • account_manager  → no BAAM Operations section at all
   *   • null / customer  → no BAAM Operations section
   */
  opsRole?: OpsRole | null;
  /**
   * True for any user whose account is `is_baam_internal=true` —
   * including legacy users with `ops_role = null`. Used to gate items
   * that should appear for ALL internal staff regardless of role
   * (e.g. the Roles & access reference page).
   */
  isBaamInternal?: boolean;
}

interface WorkspaceItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "lists";
}

const workspaceItems: WorkspaceItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/send", label: "Send review request", icon: Send },
  { href: "/app/lists", label: "Lists", icon: ClipboardCheck, badgeKey: "lists" },
  { href: "/app/reviews", label: "Reviews Reply & Share", icon: Star },
  { href: "/app/referrals", label: "Reward & Referral Settings", icon: Users },
  { href: "/app/share", label: "Widget & QR poster", icon: Share2 },
  { href: "/app/analytics", label: "Analytics & Review Revenue", icon: BarChart3 },
];

const accountItems: WorkspaceItem[] = [
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

// Shown below Billing for any internal user (admin / sales / account_manager).
// Customers don't see it — the role system doesn't apply to them.
const rolesItem: WorkspaceItem = {
  href: "/app/roles",
  label: "Roles & access",
  icon: KeyRound,
};

const onboardingItem: WorkspaceItem = {
  href: "/app/onboarding",
  label: "Onboarding queue",
  icon: UserPlus,
};
const staffAccessItem: WorkspaceItem = {
  href: "/app/admin/staff",
  label: "Staff access",
  icon: ShieldCheck,
};

function operationsItemsForRole(
  role: OpsRole | null | undefined,
): WorkspaceItem[] {
  if (role === "admin") return [onboardingItem, staffAccessItem];
  if (role === "sales") return [onboardingItem];
  return [];
}

export function Sidebar({
  fullName,
  email,
  locations,
  selectedLocationId,
  listsBadge,
  opsRole,
  isBaamInternal,
}: SidebarProps) {
  const operationsItems = operationsItemsForRole(opsRole);
  // Roles & access is for any internal staff (includes role=null legacy
  // users who haven't been assigned a role yet). Customers don't see it.
  const accountSection = isBaamInternal
    ? [...accountItems, rolesItem]
    : accountItems;
  return (
    <aside className="sticky top-0 flex h-screen w-[270px] flex-col bg-ink text-cream/90 px-4 py-6">
      <Link href="/app" className="flex items-center gap-2.5 px-2 pb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold text-ink font-semibold text-[13px]">
          B
        </span>
        <span className="font-display text-[17px] font-medium tracking-tight text-cream">
          BAAM Review
        </span>
      </Link>

      <div className="pb-5">
        <LocationSwitcher
          locations={locations}
          selectedId={selectedLocationId}
        />
      </div>

      {/* flex-1 + overflow-y-auto so the nav scrolls when its content
          exceeds the viewport. Without this the bottom items get
          clipped behind the UserCard on shorter screens. */}
      <nav className="flex-1 space-y-5 overflow-y-auto pr-1 -mr-1">
        <NavSection
          label="Workspace"
          items={workspaceItems}
          listsBadge={listsBadge}
        />
        {operationsItems.length > 0 && (
          <NavSection label="BAAM Operations" items={operationsItems} />
        )}
        <NavSection
          label="Account"
          items={accountSection}
          trailing={<SignOutNavItem />}
        />
      </nav>

      <UserCard fullName={fullName} email={email} />
    </aside>
  );
}

function NavSection({
  label,
  items,
  listsBadge,
  trailing,
}: {
  label: string;
  items: WorkspaceItem[];
  listsBadge?: number;
  /** Optional non-link entry rendered at the end of the section (e.g. Sign out). */
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <p className="px-2 pb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-cream/40">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <NavItem
                href={item.href}
                label={item.label}
                icon={<Icon className="h-4 w-4" />}
                badge={item.badgeKey === "lists" ? listsBadge : undefined}
              />
            </li>
          );
        })}
        {trailing && <li>{trailing}</li>}
      </ul>
    </div>
  );
}
