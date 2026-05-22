"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";

interface LogoUploaderProps {
  accountId: string;
  initialUrl: string | null;
  brandColor: string;
  fallbackInitial: string;
  /** Hidden form field name carrying the URL on submit */
  fieldName: string;
  /** Optional callback fired whenever the URL changes (upload or remove). */
  onChange?: (url: string | null) => void;
}

export function LogoUploader({
  accountId,
  initialUrl,
  brandColor,
  fallbackInitial,
  fieldName,
  onChange: onUrlChange,
}: LogoUploaderProps) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function commitUrl(next: string | null) {
    setUrl(next);
    onUrlChange?.(next);
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${accountId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setError(uploadError.message);
      setPending(false);
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    commitUrl(data.publicUrl);
    setPending(false);
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name={fieldName} value={url ?? ""} />

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-16 w-16 rounded-lg object-cover border border-border-base bg-paper"
        />
      ) : (
        <span
          className="flex h-16 w-16 items-center justify-center rounded-lg text-cream font-display text-[26px]"
          style={{ backgroundColor: brandColor }}
        >
          {fallbackInitial}
        </span>
      )}

      <div className="space-y-2">
        <label
          className={buttonVariants({ variant: "secondary", size: "sm" }) + " cursor-pointer"}
        >
          <Upload className="h-3.5 w-3.5" />
          {pending ? "Uploading…" : url ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onChange}
            disabled={pending}
          />
        </label>
        {url && !pending && (
          <button
            type="button"
            onClick={() => commitUrl(null)}
            className="inline-flex items-center gap-1 text-[12px] text-text-soft hover:text-alert"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
        {error && (
          <p className="text-[11.5px] text-alert" role="alert">
            {error}
          </p>
        )}
        <p className="text-[11px] text-text-muted">
          PNG, JPG, WebP, or SVG · up to 4MB
        </p>
      </div>
    </div>
  );
}
