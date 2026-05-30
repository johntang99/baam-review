import type { AuditProjection } from "../projection/types";

const VB_W = 700;
const VB_H = 320;
const X_LEFT = 50;
const X_RIGHT = 660;
const Y_TOP = 30;
const Y_BOTTOM = 270;

export function renderProjectionSvg(
  projection: AuditProjection,
  currentScore: number,
): string {
  const points = projection.timeline;
  const doNothingPath = pathFromPoints(points.map((p) => ({ month: p.month, score: p.do_nothing_score })));
  const withBaamPath = pathFromPoints(points.map((p) => ({ month: p.month, score: p.with_baam_score })));

  const gapPath = areaBetween(
    points.map((p) => ({ month: p.month, score: p.with_baam_score })),
    points.map((p) => ({ month: p.month, score: p.do_nothing_score })),
  );

  const sixMonthX = monthToX(6);
  const sixMonthDoNothingY = scoreToY(projection.six_month.do_nothing_score);
  const sixMonthWithBaamY = scoreToY(projection.six_month.with_baam_score);
  const twelveMonthDoNothingY = scoreToY(projection.twelve_month.do_nothing_score);
  const twelveMonthWithBaamY = scoreToY(projection.twelve_month.with_baam_score);
  const startY = scoreToY(currentScore);

  const revenueLossLabel = `$${projection.revenue_impact.six_month_loss_usd.toLocaleString()} / 6 months`;

  return `
<svg viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:auto;">
  ${gridLines()}
  ${yAxisLabels()}
  ${xAxisLabels()}

  <defs>
    <linearGradient id="gapGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4882D"/>
      <stop offset="100%" stop-color="#A4452A"/>
    </linearGradient>
  </defs>

  <path d="${gapPath}" fill="url(#gapGradient)" opacity="0.18"/>

  <path d="${withBaamPath}" stroke="#4F7253" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${doNothingPath}" stroke="#A4452A" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6,4"/>

  <circle cx="${X_LEFT}" cy="${startY}" r="5" fill="#1A1814"/>
  <text x="${X_LEFT}" y="${startY - 9}" text-anchor="middle" font-family="Instrument Serif" font-size="14" fill="#1A1814" font-style="italic">${currentScore}</text>

  <circle cx="${sixMonthX}" cy="${sixMonthDoNothingY}" r="4" fill="#A4452A"/>
  <text x="${sixMonthX}" y="${sixMonthDoNothingY + 20}" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#A4452A" font-weight="500">${projection.six_month.do_nothing_score}</text>

  <circle cx="${sixMonthX}" cy="${sixMonthWithBaamY}" r="4" fill="#4F7253"/>
  <text x="${sixMonthX}" y="${sixMonthWithBaamY - 10}" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="#4F7253" font-weight="500">${projection.six_month.with_baam_score}</text>

  <text x="${X_RIGHT}" y="${Math.max(20, twelveMonthWithBaamY - 8)}" font-family="Instrument Serif" font-size="13" fill="#4F7253" font-style="italic" text-anchor="end">${projection.twelve_month.with_baam_score} · Tier ${projection.twelve_month.with_baam_grade}</text>
  <text x="${X_RIGHT}" y="${Math.min(290, twelveMonthDoNothingY + 18)}" font-family="Instrument Serif" font-size="13" fill="#A4452A" font-style="italic" text-anchor="end">${projection.twelve_month.do_nothing_score} · Tier ${projection.twelve_month.do_nothing_grade}</text>

  <line x1="${sixMonthX}" y1="${Y_TOP}" x2="${sixMonthX}" y2="${Y_BOTTOM}" stroke="#6B6259" stroke-width="0.5" stroke-dasharray="2,3"/>
  <text x="${sixMonthX}" y="${Y_TOP - 8}" text-anchor="middle" font-family="JetBrains Mono" font-size="9" letter-spacing="0.1em" fill="#6B6259">SIX MONTH MARK</text>

  <text x="500" y="135" text-anchor="middle" font-family="Instrument Serif" font-size="16" fill="#1A1814" font-style="italic">— the gap —</text>
  <text x="500" y="155" text-anchor="middle" font-family="JetBrains Mono" font-size="13" font-weight="500" fill="#842F1B">${revenueLossLabel}</text>
</svg>
`.trim();
}

function monthToX(month: number): number {
  return X_LEFT + (month / 12) * (X_RIGHT - X_LEFT);
}

function scoreToY(score: number): number {
  return Y_BOTTOM - (score / 100) * (Y_BOTTOM - Y_TOP);
}

function pathFromPoints(points: { month: number; score: number }[]): string {
  if (points.length === 0) return "";
  const segments = points.map((p, i) => {
    const x = monthToX(p.month).toFixed(2);
    const y = scoreToY(p.score).toFixed(2);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  });
  return segments.join(" ");
}

function areaBetween(
  upper: { month: number; score: number }[],
  lower: { month: number; score: number }[],
): string {
  if (upper.length === 0) return "";
  const upperPath = pathFromPoints(upper);
  const lowerReversed = [...lower].reverse();
  const lowerSegs = lowerReversed.map(
    (p) => `L ${monthToX(p.month).toFixed(2)} ${scoreToY(p.score).toFixed(2)}`,
  );
  return `${upperPath} ${lowerSegs.join(" ")} Z`;
}

function gridLines(): string {
  return [30, 90, 150, 210]
    .map(
      (y) =>
        `<line x1="${X_LEFT}" y1="${y}" x2="${X_RIGHT + 20}" y2="${y}" stroke="#DDD3BF" stroke-width="0.5" stroke-dasharray="2,4"/>`,
    )
    .concat(
      `<line x1="${X_LEFT}" y1="${Y_BOTTOM}" x2="${X_RIGHT + 20}" y2="${Y_BOTTOM}" stroke="#C9BFAE" stroke-width="1"/>`,
    )
    .join("\n  ");
}

function yAxisLabels(): string {
  return [
    { y: 34, label: "100" },
    { y: 94, label: "80" },
    { y: 154, label: "60" },
    { y: 214, label: "40" },
    { y: 274, label: "20" },
  ]
    .map(
      (p) =>
        `<text x="40" y="${p.y}" text-anchor="end" font-family="JetBrains Mono" font-size="10" fill="#6B6259">${p.label}</text>`,
    )
    .join("\n  ");
}

function xAxisLabels(): string {
  const ticks: Array<{ month: number; label: string }> = [
    { month: 0, label: "NOW" },
    { month: 2, label: "+2MO" },
    { month: 4, label: "+4MO" },
    { month: 6, label: "+6MO" },
    { month: 8, label: "+8MO" },
    { month: 10, label: "+10MO" },
    { month: 12, label: "+12MO" },
  ];
  return ticks
    .map(
      (t) =>
        `<text x="${monthToX(t.month).toFixed(0)}" y="295" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#6B6259" letter-spacing="0.1em">${t.label}</text>`,
    )
    .join("\n  ");
}
