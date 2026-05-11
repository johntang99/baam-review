"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/section";
import { cn } from "@/lib/utils";

interface QrBuilderProps {
  slug: string;
  supportedLanguages: string[];
  defaultLanguage: string;
  appUrl: string;
}

const PRESET_VENUES: { id: string; label: string }[] = [
  { id: "front_desk", label: "Front desk" },
  { id: "receipt", label: "Receipt" },
  { id: "business_card", label: "Business card" },
  { id: "table_tent", label: "Table tent" },
  { id: "window", label: "Window decal" },
];

const LANG_LABEL: Record<string, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

export function QrBuilder({
  slug,
  supportedLanguages,
  defaultLanguage,
  appUrl,
}: QrBuilderProps) {
  const [venue, setVenue] = useState<string>("front_desk");
  const [customVenue, setCustomVenue] = useState<string>("");
  const [language, setLanguage] = useState<string>(defaultLanguage);

  const sourceId =
    venue === "custom"
      ? customVenue.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
      : venue;

  const targetUrl = useMemo(() => {
    const u = new URL(`${appUrl}/r/${slug}`);
    if (sourceId) u.searchParams.set("source", sourceId);
    if (language && supportedLanguages.includes(language)) {
      u.searchParams.set("lang", language);
    }
    return u.toString();
  }, [appUrl, slug, sourceId, language, supportedLanguages]);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (sourceId) params.set("source", sourceId);
    if (language && supportedLanguages.includes(language)) {
      params.set("lang", language);
    }
    if (venue === "custom" && customVenue.trim()) {
      params.set("venue_label", customVenue.trim());
    }
    return `/api/qr/${slug}?${params.toString()}`;
  }, [slug, sourceId, language, supportedLanguages, venue, customVenue]);

  // Live preview: generate the QR PNG on the client via the same library
  // (qrcode) running in the browser. Lazy-import to avoid SSR bundling.
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QR = (await import("qrcode")).default;
      const dataUrl = await QR.toDataURL(targetUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
        color: { dark: "#0F1F1A", light: "#FFFFFFFF" },
      });
      if (!cancelled) setQrPreview(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUrl]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
            Where will this QR go?
          </p>
          <p className="text-[12px] text-text-muted">
            Tracked separately so you can see in analytics which surface
            converts best.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_VENUES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVenue(v.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                  venue === v.id
                    ? "border-forest bg-forest text-cream"
                    : "border-border-base bg-paper text-text-soft hover:bg-hover",
                )}
              >
                {v.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setVenue("custom")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                venue === "custom"
                  ? "border-forest bg-forest text-cream"
                  : "border-border-base bg-paper text-text-soft hover:bg-hover",
              )}
            >
              + Custom
            </button>
          </div>

          {venue === "custom" && (
            <Field
              label="Custom venue name"
              htmlFor="custom_venue"
              hint='Becomes "?source=<this>" on the URL. e.g., "Sticker on the door".'
            >
              <Input
                id="custom_venue"
                value={customVenue}
                onChange={(e) => setCustomVenue(e.target.value)}
                placeholder="Door sticker"
              />
            </Field>
          )}
        </div>

        {supportedLanguages.length > 1 && (
          <div className="space-y-2">
            <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
              Open in this language
            </p>
            <p className="text-[12px] text-text-muted">
              Customers can switch on the review page, but pre-selecting matches
              your venue&apos;s audience.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {supportedLanguages.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                    language === code
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
            Encoded URL
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-paper border border-border-base px-3 py-2">
            <code className="flex-1 truncate text-[12px] font-mono text-text-soft">
              {targetUrl}
            </code>
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-forest hover:underline whitespace-nowrap"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="pt-2">
          <a
            href={downloadUrl}
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "w-full sm:w-auto",
            )}
            download
          >
            <Download className="h-4 w-4" />
            Download printable PDF
          </a>
          <p className="mt-2 text-[11.5px] text-text-muted">
            Letter size (8.5″ × 11″). Designed for the front desk; reduce to
            business-card size if you choose that venue.
          </p>
        </div>
      </div>

      <aside className="space-y-3">
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft">
          Preview
        </p>
        <div className="rounded-2xl border border-border-base bg-paper p-6 flex items-center justify-center">
          {qrPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrPreview}
              alt="QR code preview"
              className="h-56 w-56"
            />
          ) : (
            <Loader2 className="h-6 w-6 text-text-muted animate-spin" />
          )}
        </div>
        <p className="text-[11.5px] text-text-muted text-center">
          This is just the QR. The printable PDF wraps it with your business
          name + instructions.
        </p>
      </aside>
    </div>
  );
}
