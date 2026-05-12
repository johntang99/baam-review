import type { WidgetConfig, WidgetLayout } from "@/lib/database.types";

export interface ResolvedWidgetConfig {
  layout: WidgetLayout;
  minRating: 4 | 5;
  maxCount: number;
  accentColor: string;
  showAggregate: boolean;
  showLeaveOwn: boolean;
  showReply: boolean;
}

export function resolveWidgetConfig(
  raw: WidgetConfig | null | undefined,
  fallbackAccent: string,
): ResolvedWidgetConfig {
  const c = raw ?? {};
  const maxCount = c.max_count ?? 6;
  return {
    layout: c.layout ?? "cards",
    minRating: c.min_rating ?? 4,
    maxCount: Math.max(3, Math.min(20, maxCount)),
    accentColor: c.accent_color ?? fallbackAccent,
    showAggregate: c.show_aggregate ?? true,
    showLeaveOwn: c.show_leave_own ?? true,
    showReply: c.show_reply ?? false,
  };
}
