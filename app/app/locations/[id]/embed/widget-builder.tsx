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

  // Live preview URL — bumps a key on changes so the iframe reloads with
  // the latest preview config. preview=1 disables widget_events writes.
  const previewUrl = useMemo(() => {
    const u = new URL(`${appUrl}/widget/${slug}`);
    u.searchParams.set("preview", "1");
    u.searchParams.set("v", `${draft.layout}-${draft.min_rating}-${draft.max_count}-${draft.show_aggregate}-${draft.show_leave_own}-${draft.show_reply}-${encodeURIComponent(draft.accent_color)}`);
    return u.toString();
  }, [appUrl, slug, draft]);

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
    <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
      <div className="space-y-6">
        <Field label="Layout">
          <div className="grid grid-cols-2 gap-2">
            <LayoutTile
              active={draft.layout === "cards"}
              title="Card grid"
              desc="Three-up grid on desktop, single column on mobile."
              onClick={() => setDraft({ ...draft, layout: "cards" })}
            />
            <LayoutTile
              active={draft.layout === "compact"}
              title="Compact list"
              desc="Single column. Great for sidebars and footers."
              onClick={() => setDraft({ ...draft, layout: "compact" })}
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

function LayoutTile({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-forest bg-forest/[0.04]"
          : "border-border-base bg-paper hover:bg-hover",
      )}
    >
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      <p className="text-[11.5px] text-text-soft mt-0.5">{desc}</p>
    </button>
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
