"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Copy, Save } from "lucide-react";
import type { WidgetConfig, WidgetLayout } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveWidgetConfig } from "./actions";

interface WidgetBuilderProps {
  locationId: string;
  slug: string;
  appUrl: string;
  brandColor: string;
  initialConfig: WidgetConfig;
}

interface Draft {
  layout: WidgetLayout;
  min_rating: 4 | 5;
  max_count: number;
  accent_color: string;
  show_aggregate: boolean;
  show_leave_own: boolean;
  show_reply: boolean;
}

export function WidgetBuilder({
  locationId,
  slug,
  appUrl,
  brandColor,
  initialConfig,
}: WidgetBuilderProps) {
  const [draft, setDraft] = useState<Draft>({
    layout: initialConfig.layout ?? "cards",
    min_rating: (initialConfig.min_rating ?? 4) as 4 | 5,
    max_count: initialConfig.max_count ?? 6,
    accent_color: initialConfig.accent_color ?? brandColor ?? "#1F4D3F",
    show_aggregate: initialConfig.show_aggregate ?? true,
    show_leave_own: initialConfig.show_leave_own ?? true,
    show_reply: initialConfig.show_reply ?? false,
  });

  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState(420);

  // Preview pulls from the current admin origin (localhost during dev,
  // review.baamplatform.com in prod). This guarantees a fresh deploy is
  // visible immediately rather than waiting for the production app's
  // widget route to ship.
  const [previewOrigin, setPreviewOrigin] = useState(appUrl);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreviewOrigin(window.location.origin);
    }
  }, []);

  // Live preview URL — each draft field rides as a query param so the widget
  // page can render the unsaved config without persisting anything. The page
  // only honors these overrides when preview=1.
  const previewUrl = useMemo(() => {
    const u = new URL(`${previewOrigin}/widget/${slug}`);
    u.searchParams.set("preview", "1");
    u.searchParams.set("layout", draft.layout);
    u.searchParams.set("accent", draft.accent_color);
    u.searchParams.set("min_rating", String(draft.min_rating));
    u.searchParams.set("max", String(draft.max_count));
    u.searchParams.set("aggregate", draft.show_aggregate ? "1" : "0");
    u.searchParams.set("leave_own", draft.show_leave_own ? "1" : "0");
    u.searchParams.set("reply", draft.show_reply ? "1" : "0");
    return u.toString();
  }, [previewOrigin, slug, draft]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e?.data || e.data.type !== "baam-widget-resize") return;
      const h = Number(e.data.height);
      if (Number.isFinite(h) && h > 0) setIframeHeight(h);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const snippet = useMemo(() => {
    const attrs = [
      `src="${appUrl}/api/embed.js"`,
      `data-slug="${slug}"`,
      `data-mode="widget"`,
      `data-color="${draft.accent_color}"`,
    ];
    return `<script ${attrs.join(" ")} async></script>`;
  }, [appUrl, draft.accent_color, slug]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user can copy manually
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveWidgetConfig(locationId, draft);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  // The preview iframe needs to bust its cache on draft changes so it
  // re-fetches the SSR page (the preview URL already has a versioned `v`
  // param — that's enough).
  const previewSrc = previewUrl;

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="space-y-5">
        <Field label="Layout">
          <div className="grid grid-cols-2 gap-1.5">
            <LayoutPill
              active={draft.layout === "cards"}
              title="Grid"
              hint="Three-up cards"
              onClick={() => setDraft({ ...draft, layout: "cards" })}
              icon={<GridIcon />}
            />
            <LayoutPill
              active={draft.layout === "carousel"}
              title="Carousel"
              hint="Horizontal scroll"
              onClick={() => setDraft({ ...draft, layout: "carousel" })}
              icon={<CarouselIcon />}
            />
            <LayoutPill
              active={draft.layout === "single"}
              title="Single"
              hint="One at a time"
              onClick={() => setDraft({ ...draft, layout: "single" })}
              icon={<SingleIcon />}
            />
            <LayoutPill
              active={draft.layout === "compact"}
              title="Compact"
              hint="Short clips list"
              onClick={() => setDraft({ ...draft, layout: "compact" })}
              icon={<CompactIcon />}
            />
          </div>
        </Field>

        <Field
          label="Minimum rating"
          hint="Only reviews at or above this star count appear in the widget. Negative reviews still appear in your inbox."
        >
          <div className="flex gap-2">
            <RatingPill
              value={4}
              active={draft.min_rating === 4}
              onClick={() => setDraft({ ...draft, min_rating: 4 })}
            />
            <RatingPill
              value={5}
              active={draft.min_rating === 5}
              onClick={() => setDraft({ ...draft, min_rating: 5 })}
            />
          </div>
        </Field>

        <Field
          label="How many reviews to show"
          htmlFor="max_count"
          hint="3 to 20. Most sites look best at 6 or 9."
        >
          <Input
            id="max_count"
            type="number"
            min={3}
            max={20}
            value={draft.max_count}
            onChange={(e) =>
              setDraft({
                ...draft,
                max_count: Math.max(
                  3,
                  Math.min(20, Number(e.target.value) || 6),
                ),
              })
            }
            className="w-24"
          />
        </Field>

        <Field
          label="Accent color"
          hint="Used for stars and the “Leave your own review” button."
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Accent color"
              value={draft.accent_color}
              onChange={(e) =>
                setDraft({ ...draft, accent_color: e.target.value })
              }
              className="h-9 w-12 cursor-pointer rounded-md border border-border-base bg-paper p-1"
            />
            <Input
              value={draft.accent_color}
              onChange={(e) =>
                setDraft({ ...draft, accent_color: e.target.value })
              }
              className="w-28 font-mono uppercase"
            />
          </div>
        </Field>

        <div className="space-y-2.5">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            What to include
          </p>
          <Toggle
            label="Show aggregate rating header"
            checked={draft.show_aggregate}
            onChange={(v) => setDraft({ ...draft, show_aggregate: v })}
          />
          <Toggle
            label="Show “Leave your own review” CTA"
            checked={draft.show_leave_own}
            onChange={(v) => setDraft({ ...draft, show_leave_own: v })}
          />
          <Toggle
            label="Show owner replies on each card"
            checked={draft.show_reply}
            onChange={(v) => setDraft({ ...draft, show_reply: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-base pt-5">
          <div className="flex items-center gap-3 text-[13px]">
            {savedAt && !pending && !error && (
              <p className="text-success">Saved.</p>
            )}
            {error && (
              <p role="alert" className="text-alert">
                {error}
              </p>
            )}
          </div>
          <Button type="button" onClick={save} disabled={pending}>
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save widget settings"}
          </Button>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
              Embed this widget on your website
            </p>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-base bg-paper px-2.5 py-1 text-[12.5px] font-medium text-text hover:bg-hover transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-border-base bg-ink p-4 text-[12px] text-cream font-mono leading-relaxed">
            {snippet}
          </pre>
          <p className="text-[11.5px] text-text-muted">
            Save your settings first — the embed snippet reads the saved
            config when the widget renders.
          </p>
        </div>
      </div>

      <aside className="space-y-3">
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
          Live preview
        </p>
        <div className="overflow-hidden rounded-2xl border border-border-base bg-cream-deep/40">
          <iframe
            key={previewSrc}
            ref={iframeRef}
            src={previewSrc}
            title="Widget preview"
            className="block w-full border-0 bg-transparent"
            style={{ height: iframeHeight }}
            scrolling="no"
          />
        </div>
        <p className="text-[11.5px] text-text-muted text-center">
          Preview reflects the unsaved settings. Save to publish.
        </p>
      </aside>
    </div>
  );
}

function LayoutPill({
  active,
  title,
  hint,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-forest bg-forest/[0.04] text-ink"
          : "border-border-base bg-paper text-text-soft hover:bg-hover",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
          active
            ? "bg-forest text-cream"
            : "bg-cream-deep text-text-soft",
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-tight">
          {title}
        </span>
        <span className="block truncate text-[11px] text-text-muted">
          {hint}
        </span>
      </span>
    </button>
  );
}

/* Inline SVG glyphs — small enough to keep inline. Each conveys the layout
   shape at a glance. */
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="0" width="6" height="6" rx="1" />
      <rect x="8" y="0" width="6" height="6" rx="1" />
      <rect x="0" y="8" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  );
}
function CarouselIcon() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="2" width="10" height="10" rx="1.5" fill="currentColor" />
      <rect x="0.5" y="3" width="2" height="8" rx="0.8" opacity="0.4" />
      <rect x="13.5" y="3" width="2" height="8" rx="0.8" opacity="0.4" />
    </svg>
  );
}
function SingleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="3" width="12" height="8" rx="1.5" />
      <circle cx="5" cy="13.2" r="0.6" opacity="0.45" />
      <circle cx="7" cy="13.2" r="0.6" />
      <circle cx="9" cy="13.2" r="0.6" opacity="0.45" />
    </svg>
  );
}
function CompactIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="1" width="14" height="3" rx="1" />
      <rect x="0" y="5.5" width="14" height="3" rx="1" />
      <rect x="0" y="10" width="14" height="3" rx="1" />
    </svg>
  );
}

function RatingPill({
  value,
  active,
  onClick,
}: {
  value: 4 | 5;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-1.5 text-[13.5px] transition-colors",
        active
          ? "border-forest bg-forest text-cream"
          : "border-border-base bg-paper text-text-soft hover:bg-hover",
      )}
    >
      {value === 5 ? "★★★★★ only" : "★★★★ and up"}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-soft bg-paper px-3 py-2.5 transition-colors hover:bg-cream-deep">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
          checked
            ? "border-forest bg-forest"
            : "border-border-base bg-paper",
        )}
        aria-hidden="true"
      >
        {checked && <Check className="h-3 w-3 text-cream stroke-[3.5]" />}
      </span>
      <span className="text-[13.5px] text-ink">{label}</span>
    </label>
  );
}
