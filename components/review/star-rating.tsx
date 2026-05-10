"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (v: number) => void;
}

export function StarRating({ value, onChange }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div
      className="flex gap-1.5"
      onMouseLeave={() => setHover(0)}
      role="radiogroup"
      aria-label="Star rating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          aria-checked={value === n}
          role="radio"
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="p-0.5 focus:outline-none focus:ring-2 focus:ring-forest/30 rounded"
        >
          <Star filled={n <= display} size={36} />
        </button>
      ))}
    </div>
  );
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "#C9A961" : "none"}
      stroke={filled ? "#C9A961" : "#C5D2CB"}
      strokeWidth="1.5"
      className={cn("transition-colors")}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
      />
    </svg>
  );
}
