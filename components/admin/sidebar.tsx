import Link from "next/link";
import {
  LayoutDashboard,
  LayoutGrid,
  Plus,
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
  Building2,
  BookOpen,
} from "lucide-react";
import { UserCard } from "./user-card";
import { NavItem } from "./nav-item";
import { SignOutNavItem } from "./sign-out-nav-item";
import { LocationSetupNavItem } from "./location-setup-nav-item";
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
  /**
   * True when the viewer is a Full-Service customer (not BAAM staff).
   * Full Service customers don't operate the request/lists pipeline —
   * BAAM staff does, on their behalf. Hides "Request a Review" entirely
   * and locks Bulk Review Requests into a read-only showcase mode (see
   * the page-level guards in /app/lists/* for the rest of the gating).
   */
  isFullServiceCustomer?: boolean;
}

interface WorkspaceItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "lists";
  kind?: "location_setup";
  exact?: boolean;
}

const workspaceItems: WorkspaceItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/api/auth/google/start", label: "Connect a new location", icon: Plus },
  {
    href: "/app/locations",
    label: "Manage all locations",
    icon: LayoutGrid,
    exact: true,
  },
  {
    href: "/app/locations",
    label: "Location Setup",
    icon: Settings,
    kind: "location_setup",
  },
  { href: "/app/send", label: "Request a Review", icon: Send },
  { href: "/app/lists", label: "Bulk Review Requests", icon: ClipboardCheck, badgeKey: "lists" },
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

// Help section — all SOPs and setup guides. Visible to everyone.
// One item for now ("Setup guides"); section can grow later (FAQ,
// Contact support, Video tutorials, etc.) without re-architecting.
const helpItems: WorkspaceItem[] = [
  { href: "/app/help", label: "Setup guides", icon: BookOpen },
];

const customersItem: WorkspaceItem = {
  href: "/app/customers",
  label: "Customers",
  icon: Building2,
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
  if (role === "admin")
    return [customersItem, onboardingItem, staffAccessItem];
  if (role === "sales") return [customersItem, onboardingItem];
  if (role === "account_manager") return [customersItem];
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
  isFullServiceCustomer,
}: SidebarProps) {
  // Filter operational items for Full-Service customers — BAAM staff
  // does the operational work on their behalf, so these items are hidden:
  //   • "Request a Review" (/app/send) — single-send is BAAM's job
  //   • "Connect a new location" — BAAM connects the GBP for them; once
  //     connected, the location appears under "Manage all locations"
  const hiddenForFullService = new Set([
    "/app/send",
    "/api/auth/google/start",
  ]);
  const workspaceItemsForViewer = isFullServiceCustomer
    ? workspaceItems.filter((i) => !hiddenForFullService.has(i.href))
    : workspaceItems;
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
          items={workspaceItemsForViewer}
          listsBadge={listsBadge}
          selectedLocationId={selectedLocationId}
          locationsCount={locations.length}
        />
        {operationsItems.length > 0 && (
          <NavSection label="BAAM Operations" items={operationsItems} />
        )}
        <NavSection label="Help" items={helpItems} />
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
  selectedLocationId,
  locationsCount,
}: {
  label: string;
  items: WorkspaceItem[];
  listsBadge?: number;
  /** Optional non-link entry rendered at the end of the section (e.g. Sign out). */
  trailing?: React.ReactNode;
  selectedLocationId?: string | null;
  locationsCount?: number;
}) {
  return (
    <div>
      <p className="px-2 pb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-cream/40">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.kind === "location_setup") {
            return (
              <li key={`${item.href}:${item.label}`}>
                <LocationSetupNavItem
                  label={item.label}
                  icon={<Icon className="h-4 w-4" />}
                  selectedLocationId={selectedLocationId ?? null}
                  locationsCount={locationsCount ?? 0}
                />
              </li>
            );
          }
          return (
            <li key={item.href}>
              <NavItem
                href={item.href}
                label={item.label}
                icon={<Icon className="h-4 w-4" />}
                badge={item.badgeKey === "lists" ? listsBadge : undefined}
                exact={item.exact}
              />
            </li>
          );
        })}
        {trailing && <li>{trailing}</li>}
      </ul>
    </div>
  );
}
