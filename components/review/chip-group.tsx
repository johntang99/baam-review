"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ChipGroupProps {
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
  otherLabel: string;
  otherPlaceholder: string;
  multiline?: boolean;
}

export function ChipGroup({
  options,
  value,
  onChange,
  otherLabel,
  otherPlaceholder,
}: ChipGroupProps) {
  const isPreset = value !== null && options.includes(value);
  const [otherOpen, setOtherOpen] = useState(value !== null && !isPreset);
  const [otherValue, setOtherValue] = useState(
    value !== null && !isPreset ? value : "",
  );

  function pickPreset(v: string) {
    setOtherOpen(false);
    onChange(v);
  }

  function openOther() {
    setOtherOpen(true);
    onChange(otherValue || null);
  }

  function setOther(v: string) {
    setOtherValue(v);
    onChange(v.trim() ? v.trim() : null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => pickPreset(opt)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors",
              isPreset && value === opt
                ? "border-forest bg-forest text-cream"
                : "border-border-base bg-paper text-text hover:bg-hover",
            )}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          onClick={openOther}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors",
            otherOpen
              ? "border-forest bg-forest text-cream"
              : "border-border-base bg-paper text-text-soft hover:bg-hover",
          )}
        >
          + {otherLabel}
        </button>
      </div>
      {otherOpen && (
        <input
          type="text"
          autoFocus
          value={otherValue}
          onChange={(e) => setOther(e.target.value)}
          placeholder={otherPlaceholder}
          className="block w-full rounded-lg border border-border-base bg-paper px-3 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
        />
      )}
    </div>
  );
}
