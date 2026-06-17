import type { VerticalKey } from "@/lib/audit/google/types";

const WINDOW_TREATMENT_SIGNAL_PATTERN =
  /\b(curtains?|blinds?|shutters?|drapery|window treatments?|window coverings?)\b/i;

const SUPPORTED_VERTICALS: readonly VerticalKey[] = [
  "contractor",
  "general_smb",
  "apparel",
];

export function hasWindowTreatmentSignalText(text: string | null | undefined) {
  if (!text) return false;
  return WINDOW_TREATMENT_SIGNAL_PATTERN.test(text);
}

export function inferWindowTreatmentService({
  text,
  vertical,
}: {
  text: string | null | undefined;
  vertical?: string | null;
}) {
  if (!hasWindowTreatmentSignalText(text)) return "";
  if (!vertical) return "window treatment store";
  if (SUPPORTED_VERTICALS.includes(vertical as VerticalKey)) {
    return "window treatment store";
  }
  return "";
}
