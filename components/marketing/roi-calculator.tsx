"use client";

import { useMemo, useState } from "react";

const GROWTH_PRICE = 99;

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function RoiCalculator() {
  const [avgValue, setAvgValue] = useState(300);
  const [monthlyCustomers, setMonthlyCustomers] = useState(80);
  const [lift, setLift] = useState(5);

  const { extraCustomers, monthlyImpact, multiple } = useMemo(() => {
    const extra = monthlyCustomers * (lift / 100);
    const impact = extra * avgValue;
    const mult = impact / GROWTH_PRICE;
    return {
      extraCustomers: extra,
      monthlyImpact: impact,
      multiple: mult,
    };
  }, [avgValue, monthlyCustomers, lift]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border-base bg-paper shadow-xl">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-7 p-8 sm:p-10">
          <SliderField
            label="Average customer value"
            value={avgValue}
            onChange={setAvgValue}
            min={50}
            max={2000}
            step={50}
            display={fmtCurrency(avgValue)}
            hint="One-visit or lifetime, whichever you use for sales math."
          />
          <SliderField
            label="Monthly customers today"
            value={monthlyCustomers}
            onChange={setMonthlyCustomers}
            min={10}
            max={500}
            step={5}
            display={`${monthlyCustomers}`}
            hint="People who actually walk in or buy each month."
          />
          <SliderField
            label="Conversion lift from better reviews"
            value={lift}
            onChange={setLift}
            min={2}
            max={20}
            step={1}
            display={`${lift}%`}
            hint="Research suggests 5–9% for clinics, 3–6% for restaurants."
          />
        </div>

        <div className="flex flex-col justify-center gap-5 bg-ink p-8 text-cream sm:p-10">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-gold">
            Estimated monthly impact
          </p>
          <p className="font-display text-[56px] font-light leading-none tracking-[-0.025em] text-gold">
            {fmtCurrency(monthlyImpact)}
          </p>
          <p className="font-serif text-[17px] italic leading-relaxed text-cream/80">
            About {Math.round(extraCustomers)} additional customers per month ·{" "}
            {multiple >= 1
              ? `${Math.round(multiple)}× return on the $${GROWTH_PRICE} Growth plan`
              : `Recouped in ${Math.ceil(GROWTH_PRICE / Math.max(monthlyImpact, 1))} months`}
          </p>
          <p className="border-t border-cream/15 pt-5 text-[12.5px] leading-relaxed text-cream/55">
            Estimates only. Actual results vary by category, geography, and how
            consistently you use BAAM Review. The math is intentionally
            conservative — most customers see 3–8% lift in the first six
            months.
          </p>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[13.5px] font-medium text-ink">{label}</label>
        <span className="font-mono text-[18px] font-medium tracking-[-0.01em] text-forest">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="baam-range w-full"
        aria-label={label}
      />
      <p className="text-[12.5px] leading-snug text-text-muted">{hint}</p>
      <style>{`
        .baam-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: var(--color-border-base);
          border-radius: 999px;
          outline: none;
        }
        .baam-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-forest);
          border: 3px solid var(--color-paper);
          box-shadow: 0 2px 6px rgba(15, 31, 26, 0.18);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .baam-range::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .baam-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-forest);
          border: 3px solid var(--color-paper);
          box-shadow: 0 2px 6px rgba(15, 31, 26, 0.18);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
