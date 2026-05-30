import type { AuditGoogleData } from "../google/types";
import type { AuditLanguage } from "../templating/types";

export function decideLanguages(
  google: AuditGoogleData,
  override?: AuditLanguage | "both",
): AuditLanguage[] {
  if (override === "en") return ["en"];
  if (override === "zh") return ["zh"];
  if (override === "both") return ["en", "zh"];
  if (google.language.is_chinese_business) return ["en", "zh"];
  return ["en"];
}
