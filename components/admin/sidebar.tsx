import Link from "next/link";
import {
  LayoutDashboard,
  Send,
  Star,
  BarChart3,
  Settings,
  MapPin,
} from "lucide-react";
import { UserCard } from "./user-card";

const navSections = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/send", label: "Send request", icon: Send },
      { href: "/app/reviews", label: "Reviews", icon: Star },
      { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/app/locations", label: "Locations", icon: MapPin },
      { href: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  fullName: string | null;
  email: string;
}

export function Sidebar({ fullName, email }: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-[240px] flex-col bg-ink text-cream/90 px-4 py-6">
      <Link href="/app" className="flex items-center gap-2.5 px-2 pb-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gold text-ink font-semibold text-[13px]">
          B
        </span>
        <span className="font-display text-[17px] font-medium tracking-tight text-cream">
          BAAM Review
        </span>
      </Link>

      <nav className="flex-1 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-cream/40">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] text-cream/80 hover:bg-cream/[0.06] hover:text-cream transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <UserCard fullName={fullName} email={email} />
    </aside>
  );
}
