// Tests audit RLS with a CONTROLLED temp user given a real Supabase session.
// We flip the temp user's role in the DB and re-query PostgREST with the same
// genuine JWT — RLS reads users.ops_role / accounts.is_baam_internal live — to
// exercise every branch. Temp user + account are deleted at the end.
// Run: node --env-file=.env.local scripts/test-audit-rls.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });

// --- Ground truth (RLS bypassed via service role) ---
const { data: audits } = await svc.from("audits").select("user_id, is_public");
const totalAudits = audits.length;
const publicAudits = audits.filter((a) => a.is_public).length;
console.log("=== Ground truth ===");
console.log(`total audits: ${totalAudits} (public: ${publicAudits})`);

async function countAsUser(jwt) {
  const res = await fetch(`${URL}/rest/v1/audits?select=id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 200)}` };
  const cr = res.headers.get("content-range");
  return { total: cr ? Number(cr.split("/")[1]) : null };
}

// --- Create controlled temp user ---
const email = `rls-test-${totalAudits}-${publicAudits}@baam-rls-test.invalid`;
const password = "Rls-Test-" + Buffer.from(SERVICE).toString("hex").slice(0, 24);

let createdUserId = null;
let accountId = null;
let pass = true;
try {
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr) throw cErr;
  createdUserId = created.user.id;

  // Read the auto-created public.users row (trigger) to capture account_id.
  const { data: urow } = await svc
    .from("users")
    .select("id, account_id, ops_role")
    .eq("id", createdUserId)
    .single();
  accountId = urow.account_id;

  // Real session token for the temp user.
  const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signin, error: sErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  const jwt = signin.session.access_token;

  const ownPublic = audits.filter((a) => a.user_id === createdUserId || a.is_public).length; // 0 own + public

  console.log("\n=== RLS branches (same temp user, role flipped in DB) ===");

  // Branch 1: external signup (ops_role null, is_baam_internal false)
  let r = await countAsUser(jwt);
  let ok = r.total === ownPublic;
  pass &&= ok;
  console.log(`- external signup    sees ${r.total} / expected ${ownPublic} (own+public)            ${ok ? "✅" : "❌"}`);

  // Branch 2: admin → sees ALL
  await svc.from("users").update({ ops_role: "admin" }).eq("id", createdUserId);
  r = await countAsUser(jwt);
  ok = r.total === totalAudits;
  pass &&= ok;
  console.log(`- admin              sees ${r.total} / expected ${totalAudits} (ALL)                    ${ok ? "✅" : "❌"}`);

  // Branch 3: internal staff (sales, is_baam_internal=true, NOT admin) → own+public only
  await svc.from("users").update({ ops_role: "sales" }).eq("id", createdUserId);
  await svc.from("accounts").update({ is_baam_internal: true }).eq("id", accountId);
  r = await countAsUser(jwt);
  ok = r.total === ownPublic;
  pass &&= ok;
  console.log(`- internal staff(sales) sees ${r.total} / expected ${ownPublic} (own+public, NOT all)  ${ok ? "✅" : "❌"}`);
  if (r.total === totalAudits) {
    console.log("   ⚠️  staff sees ALL → migration 0050 is NOT applied yet (old audits_select_internal still active).");
  }
} catch (e) {
  console.error("\nTest error:", e.message || e);
  pass = false;
} finally {
  // --- Cleanup ---
  try {
    if (createdUserId) await svc.auth.admin.deleteUser(createdUserId);
  } catch {}
  try {
    if (accountId) await svc.from("accounts").delete().eq("id", accountId);
  } catch {}
  console.log("\n(cleanup) temp user + account removed");
}

console.log(`\n${pass ? "✅ ALL CHECKS PASS — RLS matches the requirement" : "❌ CHECKS FAILED"}`);
process.exit(pass ? 0 : 1);
