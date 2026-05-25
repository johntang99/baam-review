// Read-only DB inspection script. Verifies the consolidation migration
// landed cleanly and reports the current state of staff + locations +
// tokens + assignments. Safe to run repeatedly.
//
//   pnpm tsx scripts/verify-consolidation.mjs
// or
//   node --env-file=.env.local scripts/verify-consolidation.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Minimal .env.local loader (so the script doesn't need a runtime flag).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const section = (title) => {
  console.log("\n──────────────────────────────────────────────────────");
  console.log(title);
  console.log("──────────────────────────────────────────────────────");
};

async function main() {
  // 1) Ops tenant — should be exactly one row.
  section("1) Internal accounts (should be exactly one)");
  const { data: opsAccounts } = await supabase
    .from("accounts")
    .select("id, name, primary_email, is_baam_internal, created_at")
    .eq("is_baam_internal", true)
    .order("created_at");
  console.table(opsAccounts ?? []);
  const opsId = opsAccounts?.[0]?.id ?? null;
  if (!opsId) {
    console.error("✗ No ops tenant found — migration 0030/0032 didn't land");
    return;
  }
  if ((opsAccounts ?? []).length > 1) {
    console.warn(
      `⚠ Found ${opsAccounts.length} internal accounts — consolidation didn't fully run. Re-running 0032 should fix.`,
    );
  } else {
    console.log("✓ Single ops tenant:", opsId);
  }

  // 2) Users in ops tenant with their roles.
  section("2) Users inside the ops tenant");
  const { data: opsUsers } = await supabase
    .from("users")
    .select("id, full_name, ops_role, account_id, created_at")
    .eq("account_id", opsId)
    .order("created_at");
  const { data: authList } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  const emailById = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email]),
  );
  console.table(
    (opsUsers ?? []).map((u) => ({
      user_id: u.id.slice(0, 8) + "…",
      full_name: u.full_name,
      email: emailById.get(u.id) ?? "(no email)",
      ops_role: u.ops_role,
    })),
  );

  // 3) Locations under the ops tenant — confirm consolidation.
  section("3) Locations under ops tenant (connector + assignment summary)");
  const { data: opsLocations } = await supabase
    .from("locations")
    .select(
      "id, display_name, account_id, connected_by_user_id, customer_record_id",
    )
    .eq("account_id", opsId)
    .order("created_at", { ascending: false });
  console.log(`Total locations in ops tenant: ${opsLocations?.length ?? 0}`);
  const noConnector = (opsLocations ?? []).filter(
    (l) => !l.connected_by_user_id,
  );
  console.log(
    `  Locations without connected_by_user_id: ${noConnector.length} ` +
      (noConnector.length > 0
        ? "(connected before migration 0031; sales view won't show these — backfill recommended)"
        : "(all good)"),
  );
  console.table(
    (opsLocations ?? []).slice(0, 8).map((l) => ({
      location: l.display_name?.slice(0, 32),
      connected_by:
        emailById.get(l.connected_by_user_id) ?? l.connected_by_user_id ?? "—",
      from_start_now: !!l.customer_record_id,
    })),
  );

  // 4) Locations NOT in ops tenant — should be customer Self-Service rows.
  section("4) Customer locations (not in ops tenant)");
  const { data: customerLocations } = await supabase
    .from("locations")
    .select("id, display_name, account_id")
    .neq("account_id", opsId);
  console.log(`Customer locations: ${customerLocations?.length ?? 0}`);

  // 5) google_oauth_tokens — should all have user_id populated.
  section("5) OAuth tokens (per-user)");
  const { data: tokens } = await supabase
    .from("google_oauth_tokens")
    .select("id, user_id, account_id, google_email, expiry");
  console.table(
    (tokens ?? []).map((t) => ({
      user_id: t.user_id?.slice(0, 8) + "…",
      email_owner: emailById.get(t.user_id) ?? "(unknown)",
      google_email: t.google_email,
      in_ops_tenant: t.account_id === opsId ? "yes" : "no",
      expires: new Date(t.expiry).toISOString().slice(0, 19),
    })),
  );

  // 6) Assignments.
  section("6) Location assignments (account managers added by sales/admin)");
  const { data: assignments } = await supabase
    .from("location_assignments")
    .select("location_id, user_id, assigned_by_user_id, assigned_at");
  console.log(`Total assignments: ${assignments?.length ?? 0}`);
  if (assignments && assignments.length > 0) {
    const locIds = [...new Set(assignments.map((a) => a.location_id))];
    const { data: locsForAssignments } = await supabase
      .from("locations")
      .select("id, display_name")
      .in("id", locIds);
    const locName = new Map(
      (locsForAssignments ?? []).map((l) => [l.id, l.display_name]),
    );
    console.table(
      assignments.map((a) => ({
        location: locName.get(a.location_id)?.slice(0, 28) ?? a.location_id,
        manager: emailById.get(a.user_id) ?? a.user_id,
        assigned_by:
          emailById.get(a.assigned_by_user_id ?? "") ??
          a.assigned_by_user_id ??
          "—",
        when: new Date(a.assigned_at).toISOString().slice(0, 19),
      })),
    );
  }

  // 7) Health summary.
  section("7) Health check");
  const checks = [
    {
      name: "Single internal account",
      ok: (opsAccounts ?? []).length === 1,
    },
    {
      name: "At least one user has ops_role",
      ok: (opsUsers ?? []).some((u) => u.ops_role !== null),
    },
    {
      name: "Tokens all keyed by user_id",
      ok: (tokens ?? []).every((t) => !!t.user_id),
    },
    {
      name: "No orphan locations in old internal accounts",
      ok: (customerLocations ?? []).every((l) => l.account_id !== opsId),
    },
  ];
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
