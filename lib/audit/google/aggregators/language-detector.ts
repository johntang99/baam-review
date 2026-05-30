import { franc } from "franc-min";

const FRANC_TO_ISO_639_1: Record<string, string> = {
  cmn: "zh",
  eng: "en",
  spa: "es",
  por: "pt",
  fra: "fr",
  deu: "de",
  ita: "it",
  rus: "ru",
  jpn: "ja",
  kor: "ko",
  vie: "vi",
  arb: "ar",
};

export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "other";

  if (hasCjkCharacters(text) && text.length < 20) return "zh";

  const francCode = franc(text, { minLength: 3 });
  if (francCode === "und") {
    return hasCjkCharacters(text) ? "zh" : "other";
  }
  return FRANC_TO_ISO_639_1[francCode] ?? "other";
}

export function hasCjkCharacters(text: string): boolean {
  return /[一-鿿㐀-䶿豈-﫿]/.test(text);
}

export function buildLanguageDistribution(
  texts: string[],
): Record<string, number> {
  if (texts.length === 0) return {};

  const counts: Record<string, number> = {};
  for (const text of texts) {
    const lang = detectLanguage(text);
    counts[lang] = (counts[lang] ?? 0) + 1;
  }

  const total = texts.length;
  const distribution: Record<string, number> = {};
  for (const [lang, count] of Object.entries(counts)) {
    distribution[lang] = count / total;
  }
  return distribution;
}
