"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LANGUAGE_LABEL, type Language } from "@/lib/i18n/review";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  current: Language;
  available: Language[];
}

export function LanguageSwitcher({ current, available }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (available.length < 2) return null;

  function set(lang: Language) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", lang);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-full bg-cream-deep p-0.5">
      {available.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => set(lang)}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            current === lang
              ? "bg-paper text-ink shadow-sm"
              : "text-text-soft hover:text-ink",
          )}
        >
          {LANGUAGE_LABEL[lang]}
        </button>
      ))}
    </div>
  );
}
