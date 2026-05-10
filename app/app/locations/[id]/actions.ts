"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";

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

  const promptQuestionsRaw = formData.get("prompt_questions");
  let promptQuestions: Json | null = null;
  if (typeof promptQuestionsRaw === "string" && promptQuestionsRaw.trim() !== "") {
    try {
      promptQuestions = JSON.parse(promptQuestionsRaw);
    } catch {
      throw new Error("Custom prompts: invalid JSON");
    }
  }

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
    custom_url_label: getJsonbPerLang(formData, "custom_url_label", supported),
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
