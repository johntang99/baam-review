"use client";

import { useState } from "react";

const PRESETS = [
  "#1F4D3F", // forest (default)
  "#2A6B57",
  "#0F1F1A",
  "#3B82F6",
  "#7C3AED",
  "#C9A961", // gold
  "#B5443A",
  "#D4924A",
];

export function BrandColorPicker({
  name,
  initial,
}: {
  name: string;
  initial: string;
}) {
  const [color, setColor] = useState(initial);

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={name} value={color} />

      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick brand color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border-base bg-paper p-1"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          className="h-9 w-28 rounded-md border border-border-base bg-paper px-2 text-[13px] font-mono uppercase focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setColor(p)}
            aria-label={`Use ${p}`}
            className="h-6 w-6 rounded-md border border-border-base"
            style={{ backgroundColor: p }}
          />
        ))}
      </div>
    </div>
  );
}
