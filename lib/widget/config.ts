import type {
  WidgetCommentLangPref,
  WidgetConfig,
  WidgetLayout,
} from "@/lib/database.types";

export interface ResolvedWidgetConfig {
  layout: WidgetLayout;
  minRating: 4 | 5;
  maxCount: number;
  accentColor: string;
  showAggregate: boolean;
  showLeaveOwn: boolean;
  showReply: boolean;
  maxWidth: number | null;
  commentLangPref: WidgetCommentLangPref;
  title: string | null;
  subtitle: string | null;
}

const TITLE_MAX = 120;
const SUBTITLE_MAX = 240;

export function resolveWidgetConfig(
  raw: WidgetConfig | null | undefined,
  fallbackAccent: string,
): ResolvedWidgetConfig {
  const c = raw ?? {};
  const maxCount = c.max_count ?? 6;
  const maxWidth =
    typeof c.max_width === "number" && c.max_width > 0
      ? Math.max(320, Math.min(1920, Math.floor(c.max_width)))
      : null;
  return {
    layout: c.layout ?? "cards",
    minRating: c.min_rating ?? 4,
    maxCount: Math.max(3, Math.min(20, maxCount)),
    accentColor: c.accent_color ?? fallbackAccent,
    showAggregate: c.show_aggregate ?? true,
    showLeaveOwn: c.show_leave_own ?? true,
    showReply: c.show_reply ?? false,
    maxWidth,
    commentLangPref: c.comment_lang_pref ?? "auto",
    title: cleanHeaderString(c.title, TITLE_MAX),
    subtitle: cleanHeaderString(c.subtitle, SUBTITLE_MAX),
  };
}

function cleanHeaderString(
  raw: string | null | undefined,
  max: number,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
