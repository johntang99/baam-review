// Walk every sidebar item and report, per role, whether the underlying
// page applies the visibility filter / role gate correctly. Reads each
// page.tsx file and grep-detects the patterns.

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/johntang/Desktop/clients/baam-review/app/app";

// Each sidebar destination → which page file backs it.
const SIDEBAR = [
  { label: "Dashboard", href: "/app", file: `${ROOT}/page.tsx` },
  { label: "Send review request", href: "/app/send", file: `${ROOT}/send/page.tsx` },
  { label: "Lists", href: "/app/lists", file: `${ROOT}/lists/page.tsx` },
  { label: "Reviews Reply & Share", href: "/app/reviews", file: `${ROOT}/reviews/page.tsx` },
  { label: "Reward & Referral Settings", href: "/app/referrals", file: `${ROOT}/referrals/page.tsx` },
  { label: "Widget & QR poster", href: "/app/share", file: `${ROOT}/share/page.tsx` },
  { label: "Analytics & Review Revenue", href: "/app/analytics", file: `${ROOT}/analytics/page.tsx` },
  { label: "Settings", href: "/app/settings", file: `${ROOT}/settings/page.tsx` },
  { label: "Billing", href: "/app/billing", file: `${ROOT}/billing/page.tsx` },
  // BAAM Operations (role-gated visibility in sidebar)
  { label: "Onboarding queue", href: "/app/onboarding", file: `${ROOT}/onboarding/page.tsx`, opsSection: true, expectedRoles: ["admin", "sales"] },
  { label: "Staff access", href: "/app/admin/staff", file: `${ROOT}/admin/staff/page.tsx`, opsSection: true, expectedRoles: ["admin"] },
];

function inspect(file) {
  const src = fs.readFileSync(file, "utf8");
  return {
    callsGetInternalContext: src.includes("getInternalContext"),
    appliesVisibilityFilter:
      src.includes("getVisibleLocationIds") || src.includes("canAccessLocation"),
    hasRoleRedirect:
      /redirect\("\/app"\)/.test(src) && src.includes("opsRole"),
  };
}

console.log("\n══ SIDEBAR AUDIT — per-page visibility / gate behaviour ══\n");
console.log(
  `${"Item".padEnd(28)}  ${"Path".padEnd(20)}  ${"role-aware?".padEnd(11)}  ${"filtered?".padEnd(10)}  ${"role gate?".padEnd(10)}`,
);
console.log(
  `${"-".padEnd(28, "-")}  ${"-".padEnd(20, "-")}  ${"-".padEnd(11, "-")}  ${"-".padEnd(10, "-")}  ${"-".padEnd(10, "-")}`,
);
for (const item of SIDEBAR) {
  if (!fs.existsSync(item.file)) {
    console.log(`${item.label.padEnd(28)}  ${item.href.padEnd(20)}  MISSING FILE: ${item.file}`);
    continue;
  }
  const r = inspect(item.file);
  console.log(
    `${item.label.padEnd(28)}  ${item.href.padEnd(20)}  ${(r.callsGetInternalContext ? "yes" : "no").padEnd(11)}  ${(r.appliesVisibilityFilter ? "yes" : "no").padEnd(10)}  ${(r.hasRoleRedirect ? "yes" : "no").padEnd(10)}`,
  );
}

console.log("\n══ Per-role sidebar VISIBILITY (which items appear) ══\n");
const ROLE_SIDEBAR = {
  admin: {
    Workspace: ["Dashboard", "Send review request", "Lists", "Reviews Reply & Share", "Reward & Referral Settings", "Widget & QR poster", "Analytics & Review Revenue"],
    "BAAM Operations": ["Onboarding queue", "Staff access"],
    Account: ["Settings", "Billing"],
  },
  sales: {
    Workspace: ["Dashboard", "Send review request", "Lists", "Reviews Reply & Share", "Reward & Referral Settings", "Widget & QR poster", "Analytics & Review Revenue"],
    "BAAM Operations": ["Onboarding queue"],
    Account: ["Settings", "Billing"],
  },
  account_manager: {
    Workspace: ["Dashboard", "Send review request", "Lists", "Reviews Reply & Share", "Reward & Referral Settings", "Widget & QR poster", "Analytics & Review Revenue"],
    Account: ["Settings", "Billing"],
  },
};
for (const [role, sections] of Object.entries(ROLE_SIDEBAR)) {
  console.log(`  ${role.toUpperCase()}`);
  for (const [section, items] of Object.entries(sections)) {
    console.log(`    ${section.padEnd(18)} → ${items.length} item(s): ${items.join(", ")}`);
  }
  console.log("");
}
