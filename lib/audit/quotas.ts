import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// Defaults are effectively-unlimited during pre-launch testing. Tighten
// (e.g., 2/5 per the original Session 10 spec) when opening signup to
// the general public — the abuse-prevention rationale only applies once
// uninvited users can sign up.
const DEFAULT_MONTHLY_QUOTA = 999;
const DEFAULT_LIFETIME_QUOTA = 9999;

export interface QuotaCheck {
  allowed: boolean;
  reason: "monthly_limit" | "lifetime_limit" | null;
  monthly_remaining: number;
  lifetime_remaining: number;
  monthly_cap: number;
  lifetime_cap: number;
  quota_resets_at: string;
}

interface UserQuotaRow {
  audits_used_this_month: number;
  audits_used_lifetime: number;
  monthly_quota_override: number | null;
  lifetime_quota_override: number | null;
  quota_reset_at: string;
}

export async function canUserAudit(userId: string): Promise<QuotaCheck> {
  const row = await readQuotaRow(userId);
  if (!row) {
    return {
      allowed: false,
      reason: "lifetime_limit",
      monthly_remaining: 0,
      lifetime_remaining: 0,
      monthly_cap: 0,
      lifetime_cap: 0,
      quota_resets_at: new Date().toISOString(),
    };
  }

  const monthly_cap = row.monthly_quota_override ?? DEFAULT_MONTHLY_QUOTA;
  const lifetime_cap = row.lifetime_quota_override ?? DEFAULT_LIFETIME_QUOTA;

  const monthly_remaining = Math.max(0, monthly_cap - row.audits_used_this_month);
  const lifetime_remaining = Math.max(0, lifetime_cap - row.audits_used_lifetime);

  if (lifetime_remaining === 0) {
    return {
      allowed: false,
      reason: "lifetime_limit",
      monthly_remaining,
      lifetime_remaining,
      monthly_cap,
      lifetime_cap,
      quota_resets_at: row.quota_reset_at,
    };
  }

  if (monthly_remaining === 0) {
    return {
      allowed: false,
      reason: "monthly_limit",
      monthly_remaining,
      lifetime_remaining,
      monthly_cap,
      lifetime_cap,
      quota_resets_at: row.quota_reset_at,
    };
  }

  return {
    allowed: true,
    reason: null,
    monthly_remaining,
    lifetime_remaining,
    monthly_cap,
    lifetime_cap,
    quota_resets_at: row.quota_reset_at,
  };
}

export async function incrementAuditCount(userId: string): Promise<void> {
  const supabase = createServiceClient();
  await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    }
  ).rpc("increment_audit_count", { user_id_in: userId });
}

export async function decrementAuditCount(userId: string): Promise<void> {
  const supabase = createServiceClient();
  await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    }
  ).rpc("decrement_audit_count", { user_id_in: userId });
}

async function readQuotaRow(userId: string): Promise<UserQuotaRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: UserQuotaRow | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("users")
    .select(
      "audits_used_this_month,audits_used_lifetime,monthly_quota_override,lifetime_quota_override,quota_reset_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[quotas] read failed:", error);
    return null;
  }
  return data;
}
