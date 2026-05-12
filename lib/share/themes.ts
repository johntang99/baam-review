// Share-card themes for /og/review/[id]. Each theme defines the gradient
// background, foreground text color, the accent (stars + mark pill), and the
// font weight feel. Themes are intentionally limited — 5 well-considered
// options beats 20 mediocre ones.

export type ShareSize = "og" | "square" | "story";
export type ShareThemeKey =
  | "warm-clinic"
  | "forest-pro"
  | "gold-luxe"
  | "quiet-cream"
  | "bold-dark";

export interface ShareTheme {
  key: ShareThemeKey;
  label: string;
  description: string;
  /** Returns the gradient CSS string. Accent param is the location brand color. */
  background(accent: string): string;
  /** Foreground text color. */
  fg: string;
  /** Star color and small mark pill background. */
  accent(brand: string): string;
  /** Subtle text (attribution, footer). */
  fgMuted: string;
  /** Mark pill text color. */
  markText: string;
  /** Logo background. */
  logoBg: string;
  /** Logo text color. */
  logoColor(brand: string): string;
}

export const SHARE_THEMES: Record<ShareThemeKey, ShareTheme> = {
  "warm-clinic": {
    key: "warm-clinic",
    label: "Warm clinic",
    description: "Brand-color gradient, gold stars. The default.",
    background: (accent) =>
      `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.25)} 100%)`,
    fg: "white",
    accent: () => "#FFD56A",
    fgMuted: "rgba(255,255,255,0.75)",
    markText: "white",
    logoBg: "white",
    logoColor: (brand) => brand,
  },
  "forest-pro": {
    key: "forest-pro",
    label: "Forest pro",
    description: "BAAM forest with cream type. Confident, clinical.",
    background: () => "linear-gradient(160deg, #1F4D3F 0%, #163A30 100%)",
    fg: "#FAF7F2",
    accent: () => "#C9A961",
    fgMuted: "rgba(250,247,242,0.72)",
    markText: "#FAF7F2",
    logoBg: "#FAF7F2",
    logoColor: () => "#1F4D3F",
  },
  "gold-luxe": {
    key: "gold-luxe",
    label: "Gold luxe",
    description: "Ink background with gold type. Premium feel.",
    background: () => "linear-gradient(160deg, #0F1F1A 0%, #1A1F1C 100%)",
    fg: "#FAF7F2",
    accent: () => "#C9A961",
    fgMuted: "rgba(250,247,242,0.65)",
    markText: "#C9A961",
    logoBg: "#C9A961",
    logoColor: () => "#0F1F1A",
  },
  "quiet-cream": {
    key: "quiet-cream",
    label: "Quiet cream",
    description: "Light background, restrained. For minimalist brands.",
    background: () => "linear-gradient(160deg, #FAF7F2 0%, #F0EBE0 100%)",
    fg: "#0F1F1A",
    accent: (brand) => brand,
    fgMuted: "rgba(15,31,26,0.62)",
    markText: "#0F1F1A",
    logoBg: "#0F1F1A",
    logoColor: () => "#FAF7F2",
  },
  "bold-dark": {
    key: "bold-dark",
    label: "Bold dark",
    description: "Pure ink with location-accent stars. High contrast.",
    background: () => "linear-gradient(180deg, #0F1F1A 0%, #163A30 100%)",
    fg: "#FAF7F2",
    accent: (brand) => brand,
    fgMuted: "rgba(250,247,242,0.62)",
    markText: "#FAF7F2",
    logoBg: "#FAF7F2",
    logoColor: (brand) => brand,
  },
};

export const SHARE_THEME_LIST: ShareTheme[] = Object.values(SHARE_THEMES);

export function resolveTheme(
  key: string | null | undefined,
): ShareTheme {
  if (key && key in SHARE_THEMES) {
    return SHARE_THEMES[key as ShareThemeKey];
  }
  return SHARE_THEMES["warm-clinic"];
}

export const SHARE_SIZES: Record<
  ShareSize,
  { width: number; height: number; label: string; usage: string }
> = {
  og: { width: 1200, height: 630, label: "OG / FB", usage: "Open Graph, Facebook, Twitter / X, LinkedIn link previews" },
  square: { width: 1080, height: 1080, label: "Square", usage: "Instagram feed, Xiaohongshu, WeChat Moments" },
  story: { width: 1080, height: 1920, label: "Story", usage: "Instagram Stories, Reels, TikTok, WhatsApp Status" },
};

export function resolveSize(s: string | null | undefined): ShareSize {
  if (s === "og" || s === "square" || s === "story") return s;
  return "og";
}

// Small darken helper used by themes that take a brand color in.
function darken(hex: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
