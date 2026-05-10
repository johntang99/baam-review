// Default chip sets per business_type, localized.
// If a location has prompt_questions set, that overrides these.
// New types fall through to "default".

import type { Language } from "@/lib/i18n/review";
import { STRINGS } from "@/lib/i18n/review";

type ChipSet = Record<Language, readonly string[]>;

// Normalize the free-text business_type to a known key.
export function normalizeBusinessType(input: string | null | undefined): string {
  if (!input) return "default";
  const lower = input.toLowerCase();
  if (lower.includes("acupunc")) return "acupuncture";
  if (lower.includes("dental") || lower.includes("dentist")) return "dental";
  if (lower.includes("clinic")) return "clinic";
  if (lower.includes("restaurant") || lower.includes("food")) return "restaurant";
  if (lower.includes("law") || lower.includes("attorney")) return "law";
  if (lower.includes("salon") || lower.includes("hair") || lower.includes("nail"))
    return "salon";
  if (lower.includes("school") || lower.includes("education")) return "education";
  if (lower.includes("agency") || lower.includes("marketing")) return "agency";
  return "default";
}

const SERVICE_CHIPS: Record<string, ChipSet> = {
  acupuncture: {
    en: ["Acupuncture", "Massage", "Cupping", "Herbs", "Consultation"],
    zh: ["针灸", "按摩", "拔罐", "中药", "咨询"],
    es: ["Acupuntura", "Masaje", "Ventosas", "Hierbas", "Consulta"],
  },
  dental: {
    en: ["Cleaning", "Filling", "Crown", "Whitening", "Consultation"],
    zh: ["洗牙", "补牙", "牙冠", "美白", "咨询"],
    es: ["Limpieza", "Empaste", "Corona", "Blanqueamiento", "Consulta"],
  },
  clinic: {
    en: ["Visit", "Consultation", "Treatment", "Checkup"],
    zh: ["就诊", "咨询", "治疗", "体检"],
    es: ["Visita", "Consulta", "Tratamiento", "Chequeo"],
  },
  restaurant: {
    en: ["Lunch", "Dinner", "Takeout", "Catering"],
    zh: ["午餐", "晚餐", "外卖", "宴会"],
    es: ["Almuerzo", "Cena", "Para llevar", "Catering"],
  },
  law: {
    en: ["Immigration", "Real estate", "Family", "Business", "Consultation"],
    zh: ["移民", "房地产", "家庭", "商业", "咨询"],
    es: ["Inmigración", "Inmobiliaria", "Familia", "Negocios", "Consulta"],
  },
  salon: {
    en: ["Haircut", "Color", "Styling", "Manicure", "Pedicure"],
    zh: ["理发", "染发", "造型", "美甲", "修脚"],
    es: ["Corte", "Color", "Peinado", "Manicura", "Pedicura"],
  },
  education: {
    en: ["Tutoring", "Class", "Test prep", "Consultation"],
    zh: ["辅导", "课程", "备考", "咨询"],
    es: ["Tutoría", "Clase", "Preparación", "Consulta"],
  },
  agency: {
    en: ["Project", "Consultation", "Strategy", "Build"],
    zh: ["项目", "咨询", "策略", "实施"],
    es: ["Proyecto", "Consulta", "Estrategia", "Implementación"],
  },
};

export interface PromptQuestions {
  service_chips?: Partial<Record<Language, string[]>>;
  descriptor_chips?: Partial<Record<Language, string[]>>;
}

export function getServiceChips(
  businessType: string | null | undefined,
  lang: Language,
  override?: PromptQuestions | null,
): readonly string[] {
  const customForLang = override?.service_chips?.[lang];
  if (customForLang && customForLang.length > 0) return customForLang;
  const key = normalizeBusinessType(businessType);
  const chips = SERVICE_CHIPS[key];
  if (chips) return chips[lang];
  return STRINGS[lang].default_service_chips;
}

export function getDescriptorChips(
  lang: Language,
  override?: PromptQuestions | null,
): readonly string[] {
  const customForLang = override?.descriptor_chips?.[lang];
  if (customForLang && customForLang.length > 0) return customForLang;
  return STRINGS[lang].default_descriptor_chips;
}

/**
 * Coerce arbitrary jsonb (could be old data, or invalid) into a typed
 * PromptQuestions shape. Returns null if the input doesn't look like ours.
 */
export function parsePromptQuestions(
  raw: unknown,
): PromptQuestions | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const result: PromptQuestions = {};

  const sc = obj.service_chips;
  if (sc && typeof sc === "object" && !Array.isArray(sc)) {
    result.service_chips = pickStringArrayMap(sc as Record<string, unknown>);
  }

  const dc = obj.descriptor_chips;
  if (dc && typeof dc === "object" && !Array.isArray(dc)) {
    result.descriptor_chips = pickStringArrayMap(dc as Record<string, unknown>);
  }

  return result.service_chips || result.descriptor_chips ? result : null;
}

function pickStringArrayMap(
  input: Record<string, unknown>,
): Partial<Record<Language, string[]>> {
  const out: Partial<Record<Language, string[]>> = {};
  for (const lang of ["en", "zh", "es"] as const) {
    const v = input[lang];
    if (Array.isArray(v)) {
      const cleaned = v
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      if (cleaned.length > 0) out[lang] = cleaned;
    }
  }
  return out;
}
