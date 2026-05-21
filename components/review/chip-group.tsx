"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Multi-select chip group.
 *
 * `value` is an array of selected chips. Tapping a preset chip toggles it
 * in/out of the array. "+ Other" opens an inline text input; submitting
 * non-empty text adds it as a custom chip (and lets the user keep adding
 * more by clicking "+ Other" again to enter another).
 *
 * Order of values in the returned array follows the order the user
 * selected them (insertion order), so AI prompt construction stays
 * deterministic.
 */
interface ChipGroupProps {
  options: readonly string[];
  value: readonly string[];
  onChange: (v: string[]) => void;
  otherLabel: string;
  otherPlaceholder: string;
}

export function ChipGroup({
  options,
  value,
  onChange,
  otherLabel,
  otherPlaceholder,
}: ChipGroupProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");

  function togglePreset(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  function commitOther() {
    const trimmed = otherDraft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setOtherDraft("");
    setOtherOpen(false);
  }

  function removeChip(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  // Custom chips = anything in value that's not in the preset options.
  const customChips = value.filter((v) => !options.includes(v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => togglePreset(opt)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors",
                selected
                  ? "border-forest bg-forest text-cream"
                  : "border-border-base bg-paper text-text hover:bg-hover",
              )}
              aria-pressed={selected}
            >
              {opt}
            </button>
          );
        })}

        {/* Show custom chips (entered via "+ Other") as removable selected pills. */}
        {customChips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => removeChip(c)}
            className="rounded-full border border-forest bg-forest text-cream px-3.5 py-1.5 text-[13.5px] inline-flex items-center gap-1.5"
            title="Remove"
            aria-label={`Remove ${c}`}
          >
            <span>{c}</span>
            <span aria-hidden="true" className="opacity-70">×</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOtherOpen((v) => !v)}
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
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            value={otherDraft}
            onChange={(e) => setOtherDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitOther();
              }
              if (e.key === "Escape") {
                setOtherDraft("");
                setOtherOpen(false);
              }
            }}
            placeholder={otherPlaceholder}
            className="block flex-1 rounded-lg border border-border-base bg-paper px-3 py-2 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
            maxLength={40}
          />
          <button
            type="button"
            onClick={commitOther}
            disabled={!otherDraft.trim()}
            className="rounded-lg bg-forest text-cream px-3 py-2 text-[13.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
