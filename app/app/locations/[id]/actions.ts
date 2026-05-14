"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json, SocialHandles } from "@/lib/database.types";

type LocationUpdate = Database["public"]["Tables"]["locations"]["Update"];

const SUPPORTED_LANGS = ["en", "zh", "es"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function isLang(s: string): s is Lang {
  return (SUPPORTED_LANGS as readonly string[]).includes(s);
}

function getString(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function getJsonbPerLang(fd: FormData, prefix: string, langs: Lang[]): Json {
  const result: Record<string, string> = {};
  for (const lang of langs) {
    const v = fd.get(`${prefix}_${lang}`);
    if (typeof v === "string" && v.trim() !== "") {
      result[lang] = v.trim();
    }
  }
  return result;
}

export async function updateLocation(locationId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const supportedRaw = formData.getAll("supported_languages");
  const supported: Lang[] = supportedRaw
    .filter((v): v is string => typeof v === "string")
    .filter(isLang);
  if (supported.length === 0) supported.push("en");

  let defaultLang: Lang = "en";
  const defaultRaw = formData.get("default_language");
  if (typeof defaultRaw === "string" && isLang(defaultRaw) && supported.includes(defaultRaw)) {
    defaultLang = defaultRaw;
  } else {
    defaultLang = supported[0];
  }

  const serviceChips = collectChipsByLang(formData, "service_chips", supported);
  const descriptorChips = collectChipsByLang(formData, "descriptor_chips", supported);
  const promptQuestions = buildPromptQuestions(serviceChips, descriptorChips);

  const senderEmail = getString(formData, "sender_email")?.toLowerCase() ?? null;
  const senderName = getString(formData, "sender_name");

  // If sender_email changed, reset verification so BAAM Studio admin re-verifies
  // in Resend before sends use it. Look up current to compare.
  let resetSenderVerification = false;
  if (senderEmail !== null) {
    const { data: current } = await supabase
      .from("locations")
      .select("sender_email")
      .eq("id", locationId)
      .maybeSingle();
    if (current && current.sender_email !== senderEmail) {
      resetSenderVerification = true;
    }
  } else {
    // Cleared the sender email; clear verification too.
    resetSenderVerification = true;
  }

  const socialHandles = collectSocialHandles(formData);

  const update: LocationUpdate = {
    display_name: getString(formData, "display_name") ?? "Untitled",
    address: getString(formData, "address"),
    business_type: getString(formData, "business_type"),
    brand_color: getString(formData, "brand_color") ?? "#1F4D3F",
    logo_url: getString(formData, "logo_url"),
    default_language: defaultLang,
    supported_languages: supported,
    welcome_message: getJsonbPerLang(formData, "welcome", supported),
    prompt_questions: promptQuestions,
    yelp_url: getString(formData, "yelp_url"),
    custom_url: getString(formData, "custom_url"),
    website_url: getString(formData, "website_url"),
    custom_url_label: getJsonbPerLang(formData, "custom_url_label", supported),
    sender_email: senderEmail,
    sender_name: senderName,
    booking_url: getString(formData, "booking_url"),
    social_handles: socialHandles,
    ...(resetSenderVerification ? { sender_verified_at: null } : {}),
  };

  const { error } = await supabase
    .from("locations")
    .update(update)
    .eq("id", locationId);

  if (error) {
    throw new Error(`Save failed: ${error.message}`);
  }

  revalidatePath(`/app/locations/${locationId}`);
  revalidatePath("/app/locations");
}

function collectChipsByLang(
  fd: FormData,
  prefix: string,
  langs: Lang[],
): Partial<Record<Lang, string[]>> {
  const result: Partial<Record<Lang, string[]>> = {};
  for (const lang of langs) {
    const v = fd.get(`${prefix}_${lang}`);
    if (typeof v !== "string") continue;
    const items = v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) result[lang] = items;
  }
  return result;
}

const SOCIAL_KEYS = ["fb", "ig", "xhs", "wechat_mp", "tiktok"] as const;

function collectSocialHandles(fd: FormData): SocialHandles {
  const out: SocialHandles = {};
  for (const key of SOCIAL_KEYS) {
    const v = getString(fd, `social_${key}`);
    if (v) out[key] = v;
  }
  return out;
}

function buildPromptQuestions(
  service: Partial<Record<Lang, string[]>>,
  descriptor: Partial<Record<Lang, string[]>>,
): Json | null {
  const out: Record<string, Json> = {};
  if (Object.keys(service).length > 0) {
    out.service_chips = service as Json;
  }
  if (Object.keys(descriptor).length > 0) {
    out.descriptor_chips = descriptor as Json;
  }
  return Object.keys(out).length > 0 ? (out as Json) : null;
}

export async function deleteLocation(locationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", locationId);

  if (error) throw new Error(`Delete failed: ${error.message}`);

  redirect("/app/locations");
}
