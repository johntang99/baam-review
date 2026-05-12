"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help: string;
}

export function ConsentCheckbox({
  checked,
  onChange,
  label,
  help,
}: ConsentCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-cream-deep p-3.5 transition-colors hover:border-border-base">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        aria-label={label}
      />
      <span
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
          checked
            ? "border-forest bg-forest"
            : "border-border-base bg-paper",
        )}
        aria-hidden="true"
      >
        {checked && <Check className="h-3 w-3 text-cream stroke-[3.5]" />}
      </span>
      <span className="space-y-1 text-left">
        <span className="block text-[13.5px] font-medium leading-snug text-ink">
          {label}
        </span>
        <span className="block text-[12px] leading-relaxed text-text-soft">
          {help}
        </span>
      </span>
    </label>
  );
}
