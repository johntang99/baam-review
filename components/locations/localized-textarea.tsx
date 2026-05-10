"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const LANG_LABEL: Record<string, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
};

interface LocalizedFieldProps {
  name: string; // form field name; we'll emit `${name}_${lang}` for each language
  languages: string[];
  initialValues: Record<string, string>;
  placeholder?: Record<string, string>;
  rows?: number;
  variant?: "textarea" | "input";
  className?: string;
}

export function LocalizedField({
  name,
  languages,
  initialValues,
  placeholder,
  rows = 3,
  variant = "textarea",
  className,
}: LocalizedFieldProps) {
  const [active, setActive] = useState(languages[0] ?? "en");

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-1 rounded-lg bg-cream-deep p-1 w-fit">
        {languages.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActive(lang)}
            className={cn(
              "px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors",
              active === lang
                ? "bg-paper text-ink shadow-sm"
                : "text-text-soft hover:text-ink",
            )}
          >
            {LANG_LABEL[lang] ?? lang.toUpperCase()}
          </button>
        ))}
      </div>

      {languages.map((lang) =>
        variant === "textarea" ? (
          <Textarea
            key={lang}
            name={`${name}_${lang}`}
            defaultValue={initialValues[lang] ?? ""}
            placeholder={placeholder?.[lang]}
            rows={rows}
            className={cn(active === lang ? "" : "hidden")}
          />
        ) : (
          <Input
            key={lang}
            name={`${name}_${lang}`}
            defaultValue={initialValues[lang] ?? ""}
            placeholder={placeholder?.[lang]}
            className={cn(active === lang ? "" : "hidden")}
          />
        ),
      )}
    </div>
  );
}
