"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WidgetConfig } from "@/lib/database.types";

export async function saveWidgetConfig(
  locationId: string,
  config: WidgetConfig,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Strip undefineds and clamp numbers before persisting.
  const clean: WidgetConfig = {};
  if (config.layout === "cards" || config.layout === "compact") {
    clean.layout = config.layout;
  }
  if (config.min_rating === 4 || config.min_rating === 5) {
    clean.min_rating = config.min_rating;
  }
  if (typeof config.max_count === "number") {
    clean.max_count = Math.max(3, Math.min(20, Math.floor(config.max_count)));
  }
  if (
    typeof config.accent_color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(config.accent_color)
  ) {
    clean.accent_color = config.accent_color;
  }
  if (typeof config.show_aggregate === "boolean") {
    clean.show_aggregate = config.show_aggregate;
  }
  if (typeof config.show_leave_own === "boolean") {
    clean.show_leave_own = config.show_leave_own;
  }
  if (typeof config.show_reply === "boolean") {
    clean.show_reply = config.show_reply;
  }
  if (config.max_width === null) {
    clean.max_width = null;
  } else if (typeof config.max_width === "number") {
    clean.max_width = Math.max(
      320,
      Math.min(1920, Math.floor(config.max_width)),
    );
  }
  if (
    config.comment_lang_pref === "auto" ||
    config.comment_lang_pref === "translated" ||
    config.comment_lang_pref === "original"
  ) {
    clean.comment_lang_pref = config.comment_lang_pref;
  }

  const { error } = await supabase
    .from("locations")
    .update({ widget_config: clean })
    .eq("id", locationId);

  if (error) {
    throw new Error(`Save failed: ${error.message}`);
  }

  revalidatePath(`/app/locations/${locationId}/embed`);
}
