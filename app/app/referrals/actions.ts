"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReferralConfig } from "@/lib/database.types";

const TITLE_MAX = 80;
const SUBTITLE_MAX = 240;
const DESCRIPTION_MAX = 1500;
const CODE_MAX = 30;
const CTA_LABEL_MAX = 60;

export async function saveReferralConfig(
  locationId: string,
  config: ReferralConfig,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clean: ReferralConfig = {};
  if (typeof config.enabled === "boolean") clean.enabled = config.enabled;
  if (typeof config.offer_title === "string") {
    const t = config.offer_title.trim().slice(0, TITLE_MAX);
    clean.offer_title = t || null;
  } else if (config.offer_title === null) {
    clean.offer_title = null;
  }
  if (typeof config.offer_subtitle === "string") {
    const t = config.offer_subtitle.trim().slice(0, SUBTITLE_MAX);
    clean.offer_subtitle = t || null;
  } else if (config.offer_subtitle === null) {
    clean.offer_subtitle = null;
  }
  if (typeof config.offer_description === "string") {
    const t = config.offer_description.slice(0, DESCRIPTION_MAX);
    clean.offer_description = t.trim() ? t : null;
  } else if (config.offer_description === null) {
    clean.offer_description = null;
  }
  if (typeof config.offer_code === "string") {
    const c = config.offer_code
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, CODE_MAX);
    clean.offer_code = c || null;
  } else if (config.offer_code === null) {
    clean.offer_code = null;
  }
  if (typeof config.offer_image_url === "string") {
    const u = config.offer_image_url.trim();
    clean.offer_image_url =
      u && /^https?:\/\//i.test(u) ? u.slice(0, 600) : null;
  } else if (config.offer_image_url === null) {
    clean.offer_image_url = null;
  }
  if (
    config.offer_image_aspect === "16:9" ||
    config.offer_image_aspect === "4:3" ||
    config.offer_image_aspect === "1:1" ||
    config.offer_image_aspect === "21:9" ||
    config.offer_image_aspect === "3:4"
  ) {
    clean.offer_image_aspect = config.offer_image_aspect;
  }
  if (typeof config.accent_color === "string") {
    const t = config.accent_color.trim();
    clean.accent_color = /^#[0-9a-fA-F]{6}$/.test(t) ? t : null;
  } else if (config.accent_color === null) {
    clean.accent_color = null;
  }
  if (typeof config.cta_label === "string") {
    const t = config.cta_label.trim().slice(0, CTA_LABEL_MAX);
    clean.cta_label = t || null;
  }
  if (typeof config.cta_url === "string") {
    const u = config.cta_url.trim();
    clean.cta_url = u && /^https?:\/\//i.test(u) ? u.slice(0, 600) : null;
  } else if (config.cta_url === null) {
    clean.cta_url = null;
  }
  if (typeof config.expires_at === "string") {
    const t = config.expires_at.trim();
    if (!t) {
      clean.expires_at = null;
    } else {
      const d = new Date(t);
      clean.expires_at = isNaN(d.getTime()) ? null : d.toISOString();
    }
  } else if (config.expires_at === null) {
    clean.expires_at = null;
  }

  const { error } = await supabase
    .from("locations")
    .update({ referral_config: clean })
    .eq("id", locationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/referrals");
  return { ok: true };
}
