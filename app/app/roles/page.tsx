import { redirect } from "next/navigation";
import {
  ShieldCheck,
  UserPlus,
  Briefcase,
  Headphones,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getInternalContext } from "@/lib/auth/staff";
import { PageHeader } from "@/components/admin/page-header";
import type { OpsRole } from "@/lib/database.types";

export const metadata = { title: "Roles & access — BAAM Review" };
export const dynamic = "force-dynamic";

/**
 * In-app reference for the role system. Internal users land here from
 * the "Roles & access" sidebar item. Mirrors docs/USER_ROLES_AND_ASSIGNMENT.md
 * in a friendlier UI.
 *
 * Customer logins (no internal context) are redirected — the page is
 * about BAAM internal roles, which don't apply to them.
 */
export default async function RolesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/roles");

  const internal = await getInternalContext(supabase, user.id);
  if (!internal) redirect("/app");

  const myRole: OpsRole | null = internal.opsRole;

  return (
    <main className="px-10 py-10 max-w-5xl space-y-8">
      <PageHeader
        eyebrow="BAAM Operations"
        title="Roles & access"
        description="What each role can do inside BAAM Review. This page is for internal staff — customers don't see it."
      />

      <YourCard role={myRole} email={user.email ?? ""} />

      <section>
        <h2 className="font-display text-[22px] text-ink mb-3">
          The three roles
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <RoleCard
            role="admin"
            current={myRole === "admin"}
            icon={ShieldCheck}
            short="Sees everything. Manages staff."
            color="forest"
          >
            <li>Sees every client across the whole agency.</li>
            <li>Invites / promotes / removes staff and sets their role.</li>
            <li>Connects GBPs for Start Now customers using the shared <code>baamplatform@gmail.com</code> Google account.</li>
            <li>Assigns or reassigns any client to any account manager.</li>
            <li>Manages billing on any client.</li>
          </RoleCard>

          <RoleCard
            role="sales"
            current={myRole === "sales"}
            icon={Briefcase}
            short="Acquires clients. Adds managers to help."
            color="gold"
          >
            <li>Sees only clients they personally connected (forever — the connector tag never moves).</li>
            <li>Connects GBPs using their own gmail (Regular Sales flow) or via Onboarding queue (Start Now).</li>
            <li>Adds account managers to their clients so daily ops gets handled.</li>
            <li>Removes managers from their own clients.</li>
            <li>Manages billing on their own clients (the customer's card lives in their Stripe context).</li>
            <li>Does NOT see other sales' clients or invite staff.</li>
          </RoleCard>

          <RoleCard
            role="account_manager"
            current={myRole === "account_manager"}
            icon={Headphones}
            short="Handles daily ops on assigned clients."
            color="sage"
          >
            <li>Sees only clients explicitly assigned to them via the Assign button.</li>
            <li>Replies to reviews, runs review batches, configures rewards on assigned clients.</li>
            <li>Manages billing for assigned clients (e.g., update card if customer's expired).</li>
            <li>Does NOT connect new GBPs, does NOT assign or reassign other managers.</li>
            <li>Does NOT see the Onboarding queue or Staff access pages.</li>
          </RoleCard>
        </div>
      </section>

      <section>
        <h2 className="font-display text-[22px] text-ink mb-3">
          Assignment rules
        </h2>
        <p className="text-[13.5px] text-text-soft mb-3 max-w-2xl leading-relaxed">
          Who can add a manager to a client, who can be added, and what
          changes for everyone after the assignment lands.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border-base bg-paper">
          <table className="w-full text-[13.5px]">
            <thead className="bg-cream-deep/40 text-left text-[12px] uppercase tracking-[0.1em] text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Question</th>
                <th className="px-3 py-2.5 font-medium text-center">Admin</th>
                <th className="px-3 py-2.5 font-medium text-center">Sales</th>
                <th className="px-3 py-2.5 font-medium text-center">Account mgr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {ASSIGNMENT_ROWS.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2.5 text-ink align-top">{r.label}</td>
                  <td className="px-3 py-2.5 text-text align-top">{r.admin}</td>
                  <td className="px-3 py-2.5 text-text align-top">{r.sales}</td>
                  <td className="px-3 py-2.5 text-text align-top">{r.am}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-text-muted mt-2">
          Assignment is <em>additive</em>: adding a manager never removes
          the connector. A client can have 0, 1, or many account managers
          added over time. The connector (sales) always retains
          visibility.
        </p>
      </section>

      <section>
        <h2 className="font-display text-[22px] text-ink mb-3">
          What each role sees in the sidebar
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border-base bg-paper">
          <table className="w-full text-[13.5px]">
            <thead className="bg-cream-deep/40 text-left text-[12px] uppercase tracking-[0.1em] text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Sidebar item</th>
                <th className="px-3 py-2.5 font-medium text-center">Admin</th>
                <th className="px-3 py-2.5 font-medium text-center">Sales</th>
                <th className="px-3 py-2.5 font-medium text-center">Account mgr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {SIDEBAR_ROWS.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2.5 text-ink">{r.label}</td>
                  <Cell allow={r.admin} />
                  <Cell allow={r.sales} />
                  <Cell allow={r.am} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-text-muted mt-2">
          Workspace items appear for every role, but the data inside each
          page is filtered to only the locations you're allowed to see.
        </p>
      </section>

      <section>
        <h2 className="font-display text-[22px] text-ink mb-3">
          What you can do on each page
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border-base bg-paper">
          <table className="w-full text-[13.5px]">
            <thead className="bg-cream-deep/40 text-left text-[12px] uppercase tracking-[0.1em] text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Capability</th>
                <th className="px-3 py-2.5 font-medium text-center">Admin</th>
                <th className="px-3 py-2.5 font-medium text-center">Sales</th>
                <th className="px-3 py-2.5 font-medium text-center">Account mgr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base">
              {CAPABILITY_ROWS.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2.5 text-ink">{r.label}</td>
                  <ScopeCell value={r.admin} />
                  <ScopeCell value={r.sales} />
                  <ScopeCell value={r.am} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-text-muted mt-2">
          <strong>own</strong> = clients you personally connected (sales) or that
          have been assigned to you (account manager).{" "}
          <strong>any</strong> = every client in BAAM Operations.
        </p>
      </section>

      <section className="rounded-2xl border border-border-base bg-paper p-6">
        <h2 className="font-display text-[19px] text-ink flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-forest" />
          Adding new staff
        </h2>
        <p className="text-[13.5px] text-text-soft mt-1.5 max-w-2xl leading-relaxed">
          Admin only. On <a href="/app/admin/staff" className="text-forest hover:underline">/app/admin/staff</a>,{" "}
          <strong>Invite</strong> sends a magic-link email and drops the new
          user into BAAM Operations after they set a password.{" "}
          <strong>Promote</strong> moves someone who already signed up at
          /signup. Set their role (Admin / Sales / Account manager) at any
          time via the dropdown next to their row.
        </p>
      </section>

      <p className="text-[12.5px] text-text-muted">
        Full guide:{" "}
        <a
          href="https://github.com/baamplatform/baam-review/blob/main/docs/USER_ROLES_AND_ASSIGNMENT.md"
          target="_blank"
          rel="noreferrer"
          className="text-forest hover:underline"
        >
          docs/USER_ROLES_AND_ASSIGNMENT.md
        </a>{" "}
        — same content as this page plus edge cases, examples, and the FAQ.
      </p>
    </main>
  );
}

function YourCard({
  role,
  email,
}: {
  role: OpsRole | null;
  email: string;
}) {
  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "sales"
        ? "Sales"
        : role === "account_manager"
          ? "Account manager"
          : "Internal (no role set)";
  return (
    <div className="rounded-2xl bg-forest text-cream px-6 py-5">
      <p className="text-[11.5px] uppercase tracking-[0.14em] text-cream/60">
        You are signed in as
      </p>
      <p className="font-display text-[24px] mt-0.5">{roleLabel}</p>
      <p className="text-[13px] text-cream/70 mt-0.5">{email}</p>
    </div>
  );
}

function RoleCard({
  role,
  current,
  icon: Icon,
  short,
  color,
  children,
}: {
  role: OpsRole;
  current: boolean;
  icon: React.ComponentType<{ className?: string }>;
  short: string;
  color: "forest" | "gold" | "sage";
  children: React.ReactNode;
}) {
  const label =
    role === "admin"
      ? "Admin"
      : role === "sales"
        ? "Sales"
        : "Account manager";
  const ring = current ? "ring-2 ring-forest" : "";
  return (
    <div
      className={`rounded-2xl border border-border-base bg-paper p-5 ${ring}`}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-md bg-${color}/15 text-${color === "sage" ? "forest" : color === "gold" ? "gold-dark" : "forest"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-display text-[18px] text-ink">{label}</h3>
        {current && (
          <span className="ml-auto text-[11px] uppercase tracking-[0.12em] text-forest">
            you
          </span>
        )}
      </div>
      <p className="text-[13px] text-text-soft mb-2.5">{short}</p>
      <ul className="text-[12.5px] text-text leading-relaxed list-disc list-inside space-y-1">
        {children}
      </ul>
    </div>
  );
}

function Cell({ allow }: { allow: boolean }) {
  return (
    <td className="px-3 py-2.5 text-center">
      {allow ? (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-forest/10 text-forest">
          <Eye className="h-3 w-3" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-text-muted/10 text-text-muted">
          <X className="h-3 w-3" />
        </span>
      )}
    </td>
  );
}

function ScopeCell({ value }: { value: "any" | "own" | "no" }) {
  if (value === "no") {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-text-muted/10 text-text-muted">
          <X className="h-3 w-3" />
        </span>
      </td>
    );
  }
  const cls =
    value === "any"
      ? "bg-forest/10 text-forest"
      : "bg-gold/15 text-gold-dark";
  return (
    <td className="px-3 py-2.5 text-center">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${cls}`}
      >
        <Pencil className="h-2.5 w-2.5" />
        {value}
      </span>
    </td>
  );
}

const SIDEBAR_ROWS: { label: string; admin: boolean; sales: boolean; am: boolean }[] = [
  { label: "Dashboard", admin: true, sales: true, am: true },
  { label: "Send review request", admin: true, sales: true, am: true },
  { label: "Lists", admin: true, sales: true, am: true },
  { label: "Reviews Reply & Share", admin: true, sales: true, am: true },
  { label: "Reward & Referral", admin: true, sales: true, am: true },
  { label: "Widget & QR poster", admin: true, sales: true, am: true },
  { label: "Analytics & Review Revenue", admin: true, sales: true, am: true },
  { label: "Settings", admin: true, sales: true, am: true },
  { label: "Billing", admin: true, sales: true, am: true },
  { label: "Roles & access (this page)", admin: true, sales: true, am: true },
  { label: "BAAM Operations → Onboarding queue", admin: true, sales: true, am: false },
  { label: "BAAM Operations → Staff access", admin: true, sales: false, am: false },
];

const ASSIGNMENT_ROWS: {
  label: string;
  admin: string;
  sales: string;
  am: string;
}[] = [
  {
    label: "Can click Assign on a client card?",
    admin: "Yes, on any client",
    sales: "Yes, only on clients they connected",
    am: "No — button is hidden",
  },
  {
    label: "Who appears in the Assign dropdown?",
    admin: "Every user with ops_role = account_manager",
    sales: "Every user with ops_role = account_manager",
    am: "—",
  },
  {
    label: "Can be assigned as a manager?",
    admin: "No",
    sales: "No",
    am: "Yes — only role that's eligible",
  },
  {
    label: "Can remove an assigned manager?",
    admin: "Yes, on any client",
    sales: "Yes, only on clients they connected",
    am: "No",
  },
  {
    label: "Can reassign to a different manager?",
    admin: "Yes — remove + add in the same modal",
    sales: "Yes, only on clients they connected",
    am: "No",
  },
  {
    label: "What changes for them after an assignment?",
    admin: "Nothing — sees everything regardless",
    sales: "Nothing — still sees the client (connector forever)",
    am: "Client appears in their All locations; can do daily ops",
  },
  {
    label: "Notification when assigned?",
    admin: "—",
    sales: "—",
    am: "No automatic email — sales tells them in person",
  },
];

const CAPABILITY_ROWS: {
  label: string;
  admin: "any" | "own" | "no";
  sales: "any" | "own" | "no";
  am: "any" | "own" | "no";
}[] = [
  { label: "View clients on All locations", admin: "any", sales: "own", am: "own" },
  { label: "Connect a new Google Business Profile", admin: "any", sales: "own", am: "no" },
  { label: "Add account manager to a client (Assign)", admin: "any", sales: "own", am: "no" },
  { label: "Remove account manager from a client", admin: "any", sales: "own", am: "no" },
  { label: "Reply to Google reviews", admin: "any", sales: "own", am: "own" },
  { label: "Send review requests / build lists", admin: "any", sales: "own", am: "own" },
  { label: "Edit location settings, reward, widget, QR", admin: "any", sales: "own", am: "own" },
  { label: "View / manage billing", admin: "any", sales: "own", am: "own" },
  { label: "See Onboarding queue (Start Now)", admin: "any", sales: "any", am: "no" },
  { label: "Invite / promote / remove staff", admin: "any", sales: "no", am: "no" },
  { label: "Change another user's role", admin: "any", sales: "no", am: "no" },
];
