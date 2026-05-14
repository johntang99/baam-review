"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SaveRevenueInputsArgs {
  locationId: string;
  ticketDollars: number;
  ltvDollars: number;
  closeRatePct: number;          // 0-100 from the UI
  attributionSharePct: number;   // 0-100 from the UI
}

export async function saveRevenueInputs(
  args: SaveRevenueInputsArgs,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Clamp and validate. Negative numbers and >100% rates are nonsense.
  const ticket = Math.max(0, Math.round(args.ticketDollars * 100));
  const ltv = Math.max(0, Math.round(args.ltvDollars * 100));
  const close = Math.max(0, Math.min(1, args.closeRatePct / 100));
  const attr = Math.max(0, Math.min(1, args.attributionSharePct / 100));

  const { error } = await supabase
    .from("locations")
    .update({
      avg_customer_value_cents: ticket || null,
      ltv_per_customer_cents: ltv || null,
      referral_close_rate: close,
      review_attribution_share: attr,
    })
    .eq("id", args.locationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/analytics");
  return { ok: true };
}
