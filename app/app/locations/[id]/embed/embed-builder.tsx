"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/section";
import { cn } from "@/lib/utils";

interface EmbedBuilderProps {
  slug: string;
  appUrl: string;
  brandColor: string;
  supportedLanguages: string[];
  defaultLanguage: string;
}

const LANG_LABEL: Record<string, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

export function EmbedBuilder({
  slug,
  appUrl,
  brandColor,
  supportedLanguages,
  defaultLanguage,
}: EmbedBuilderProps) {
  const [color, setColor] = useState<string>(brandColor || "#1F4D3F");
  const [label, setLabel] = useState<string>("Leave a review");
  const [lang, setLang] = useState<string>(defaultLanguage);
  const [position, setPosition] = useState<"inline" | "fixed">("inline");
  const [copied, setCopied] = useState(false);

  const snippet = buildSnippet({
    appUrl,
    slug,
    color,
    label,
    lang: lang && supportedLanguages.includes(lang) ? lang : "",
    position,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user can still copy manually
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Field
          label="Button label"
          htmlFor="embed_label"
          hint="Shown on the button. Keep it short."
        >
          <Input
            id="embed_label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Leave a review"
          />
        </Field>

        <Field label="Button color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Button color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-border-base bg-paper p-1"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-28 font-mono uppercase"
            />
          </div>
        </Field>

        {supportedLanguages.length > 1 && (
          <div className="space-y-2">
            <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
              Open the review page in
            </p>
            <p className="text-[11.5px] text-text-muted">
              Leave blank to detect from the customer&apos;s browser.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLang("")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                  lang === ""
                    ? "border-forest bg-forest text-cream"
                    : "border-border-base bg-paper text-text-soft hover:bg-hover",
                )}
              >
                Auto
              </button>
              {supportedLanguages.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                    lang === code
                      ? "border-forest bg-forest text-cream"
                      : "border-border-base bg-paper text-text-soft hover:bg-hover",
                  )}
                >
                  {LANG_LABEL[code] ?? code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Position
          </p>
          <div className="grid grid-cols-2 gap-2">
            <PositionToggle
              active={position === "inline"}
              onClick={() => setPosition("inline")}
              title="Inline"
              desc="Renders where you paste the snippet."
            />
            <PositionToggle
              active={position === "fixed"}
              onClick={() => setPosition("fixed")}
              title="Floating"
              desc="Fixed in the bottom-right corner of every page."
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
              Copy & paste this anywhere on your site
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
            Works on WordPress, Squarespace, Webflow, Wix, Shopify, raw HTML —
            anywhere you can paste a script tag.
          </p>
        </div>
      </div>

      <aside className="space-y-3">
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
          Live preview
        </p>
        <div
          className={cn(
            "rounded-2xl border border-border-base p-8 flex items-center justify-center min-h-[200px]",
            position === "fixed" ? "bg-cream-deep/40 relative" : "bg-paper",
          )}
        >
          {position === "fixed" && (
            <p className="absolute top-3 left-4 text-[11px] text-text-muted">
              (page content here)
            </p>
          )}
          <a
            href="#preview"
            onClick={(e) => e.preventDefault()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 18px",
              background: color,
              color: "#FAF7F2",
              border: 0,
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              textDecoration: "none",
              cursor: "pointer",
              lineHeight: "1",
              boxShadow:
                position === "fixed"
                  ? "0 6px 18px rgba(15, 31, 26, 0.18)"
                  : "0 1px 2px rgba(15, 31, 26, 0.06)",
              position: position === "fixed" ? "absolute" : "static",
              bottom: position === "fixed" ? "16px" : undefined,
              right: position === "fixed" ? "16px" : undefined,
            }}
          >
            {label || "Leave a review"}
          </a>
        </div>
        <p className="text-[11.5px] text-text-muted text-center">
          Click logs as <code className="font-mono">source=embed</code> in
          analytics.
        </p>
      </aside>
    </div>
  );
}

function PositionToggle({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
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

function buildSnippet(opts: {
  appUrl: string;
  slug: string;
  color: string;
  label: string;
  lang: string;
  position: "inline" | "fixed";
}): string {
  const attrs = [
    `src="${opts.appUrl}/api/embed.js"`,
    `data-slug="${escapeAttr(opts.slug)}"`,
    `data-color="${escapeAttr(opts.color)}"`,
    `data-label="${escapeAttr(opts.label)}"`,
  ];
  if (opts.lang) attrs.push(`data-lang="${escapeAttr(opts.lang)}"`);
  if (opts.position === "fixed") attrs.push(`data-position="fixed"`);
  return `<script ${attrs.join(" ")} async></script>`;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
