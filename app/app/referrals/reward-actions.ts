"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RewardConfig } from "@/lib/database.types";

const TITLE_MAX = 100;
const SUBTITLE_MAX = 240;
const CODE_MAX = 30;
const DESCRIPTION_MAX = 1500;
const BOOKING_LABEL_MAX = 80;

export async function saveRewardConfig(
  locationId: string,
  config: RewardConfig,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clean: RewardConfig = {};
  if (typeof config.enabled === "boolean") clean.enabled = config.enabled;
  if (typeof config.title === "string") {
    const t = config.title.trim().slice(0, TITLE_MAX);
    clean.title = t || null;
  } else if (config.title === null) {
    clean.title = null;
  }
  if (typeof config.subtitle === "string") {
    const t = config.subtitle.trim().slice(0, SUBTITLE_MAX);
    clean.subtitle = t || null;
  } else if (config.subtitle === null) {
    clean.subtitle = null;
  }
  if (typeof config.code === "string") {
    const c = config.code
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, CODE_MAX);
    clean.code = c || null;
  } else if (config.code === null) {
    clean.code = null;
  }
  if (typeof config.image_url === "string") {
    const u = config.image_url.trim();
    clean.image_url =
      u && /^https?:\/\//i.test(u) ? u.slice(0, 600) : null;
  } else if (config.image_url === null) {
    clean.image_url = null;
  }
  if (
    config.image_aspect === "16:9" ||
    config.image_aspect === "4:3" ||
    config.image_aspect === "1:1" ||
    config.image_aspect === "21:9" ||
    config.image_aspect === "3:4"
  ) {
    clean.image_aspect = config.image_aspect;
  }
  if (typeof config.description === "string") {
    const t = config.description.slice(0, DESCRIPTION_MAX);
    clean.description = t.trim() ? t : null;
  } else if (config.description === null) {
    clean.description = null;
  }
  if (typeof config.booking_enabled === "boolean") {
    clean.booking_enabled = config.booking_enabled;
  }
  if (typeof config.booking_url === "string") {
    const u = config.booking_url.trim();
    clean.booking_url = u && /^https?:\/\//i.test(u) ? u.slice(0, 600) : null;
  } else if (config.booking_url === null) {
    clean.booking_url = null;
  }
  if (typeof config.booking_cta_label === "string") {
    const t = config.booking_cta_label.trim().slice(0, BOOKING_LABEL_MAX);
    clean.booking_cta_label = t || null;
  } else if (config.booking_cta_label === null) {
    clean.booking_cta_label = null;
  }
  if (typeof config.accent_color === "string") {
    const t = config.accent_color.trim();
    clean.accent_color = /^#[0-9a-fA-F]{6}$/.test(t) ? t : null;
  } else if (config.accent_color === null) {
    clean.accent_color = null;
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
    .update({ reward_config: clean })
    .eq("id", locationId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/referrals");
  return { ok: true };
}
