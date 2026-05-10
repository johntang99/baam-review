import { STRINGS, type Language, type StringsForLang } from "./review";

export function t(lang: Language): StringsForLang {
  return STRINGS[lang];
}
