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
} from "lucide-react";
import { UserCard } from "./user-card";
import { NavItem } from "./nav-item";
import {
  LocationSwitcher,
  type LocationSwitcherLocation,
} from "./location-switcher";

interface SidebarProps {
  fullName: string | null;
  email: string;
  locations: LocationSwitcherLocation[];
  selectedLocationId: string | null;
  /** Count of active+pending lists, shown as a badge on the Lists item. */
  listsBadge?: number;
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

export function Sidebar({
  fullName,
  email,
  locations,
  selectedLocationId,
  listsBadge,
}: SidebarProps) {
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

      <nav className="flex-1 space-y-5">
        <NavSection
          label="Workspace"
          items={workspaceItems}
          listsBadge={listsBadge}
        />
        <NavSection label="Account" items={accountItems} />
      </nav>

      <UserCard fullName={fullName} email={email} />
    </aside>
  );
}

function NavSection({
  label,
  items,
  listsBadge,
}: {
  label: string;
  items: WorkspaceItem[];
  listsBadge?: number;
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
      </ul>
    </div>
  );
}
