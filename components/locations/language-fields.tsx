"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const ALL_LANGS = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
] as const;

interface LanguageFieldsProps {
  initialDefault: string;
  initialSupported: string[];
  /** Children rendered with the current supported list, so per-language fields can react. */
  children: (supported: string[], defaultLang: string) => React.ReactNode;
}

export function LanguageFields({
  initialDefault,
  initialSupported,
  children,
}: LanguageFieldsProps) {
  const [supported, setSupported] = useState<string[]>(
    initialSupported.length > 0 ? initialSupported : ["en"],
  );
  const [defaultLang, setDefaultLang] = useState<string>(
    initialSupported.includes(initialDefault) ? initialDefault : supported[0] ?? "en",
  );

  function toggleLang(code: string) {
    if (supported.includes(code)) {
      if (supported.length === 1) return; // require at least one
      const next = supported.filter((l) => l !== code);
      setSupported(next);
      if (defaultLang === code) {
        setDefaultLang(next[0]);
      }
    } else {
      setSupported([...supported, code]);
    }
  }

  return (
    <div className="space-y-5">
      <input type="hidden" name="default_language" value={defaultLang} />
      {supported.map((s) => (
        <input key={s} type="hidden" name="supported_languages" value={s} />
      ))}

      <div>
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft mb-2">
          Supported languages
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGS.map((lang) => {
            const isOn = supported.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLang(lang.code)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                  isOn
                    ? "border-forest bg-forest text-cream"
                    : "border-border-base bg-paper text-text-soft hover:bg-hover",
                )}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[12.5px] font-medium tracking-tight text-text-soft mb-2">
          Default language
        </p>
        <p className="text-[11.5px] text-text-muted mb-2">
          Used when we can&apos;t detect the customer&apos;s language from the link or browser.
        </p>
        <div className="flex flex-wrap gap-2">
          {supported.map((code) => {
            const lang = ALL_LANGS.find((l) => l.code === code);
            const isOn = defaultLang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setDefaultLang(code)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                  isOn
                    ? "border-forest bg-forest/10 text-forest"
                    : "border-border-base bg-paper text-text-soft hover:bg-hover",
                )}
              >
                {lang?.label ?? code}
              </button>
            );
          })}
        </div>
      </div>

      {children(supported, defaultLang)}
    </div>
  );
}
