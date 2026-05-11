/**
 * Small, pure helpers for aggregating analytics records on the server.
 * Kept here so dashboard / reviews / analytics pages can share the math.
 */

export interface CountedRow {
  key: string;
  label: string;
  count: number;
  share: number; // 0..1
}

export function countBy<T>(
  rows: readonly T[],
  keyFn: (row: T) => string | null | undefined,
  labelFn: (key: string) => string = (k) => k,
): CountedRow[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const k = keyFn(row);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    total += 1;
  }
  const result: CountedRow[] = [];
  for (const [key, count] of counts) {
    result.push({
      key,
      label: labelFn(key),
      count,
      share: total === 0 ? 0 : count / total,
    });
  }
  return result.sort((a, b) => b.count - a.count);
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Conversion from the previous step (0..1). Step 0 is always 1. */
  conversion: number;
}

export function buildFunnel(steps: { key: string; label: string; count: number }[]): FunnelStep[] {
  return steps.map((s, i) => ({
    ...s,
    conversion:
      i === 0
        ? 1
        : steps[i - 1].count === 0
          ? 0
          : s.count / steps[i - 1].count,
  }));
}

export function pctFormat(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  if (ms < 30 * 86_400_000) return `${Math.floor(ms / (7 * 86_400_000))}w ago`;
  return new Date(iso).toLocaleDateString();
}

export const PLATFORM_LABEL: Record<string, string> = {
  google: "Google",
  yelp: "Yelp",
  custom: "Custom URL",
  private_feedback: "Private feedback",
};

export const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Direct / SMS / Email";
  const map: Record<string, string> = {
    front_desk: "Front desk",
    receipt: "Receipt",
    business_card: "Business card",
    table_tent: "Table tent",
    window: "Window decal",
    embed: "Website embed",
  };
  return map[source] ?? source.replace(/_/g, " ");
}
