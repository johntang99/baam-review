import { interpolateLinear } from "./interpolator";
import type { VelocityRubric } from "./types";

export function scoreFromVelocity(
  perMonth: number,
  rubric: VelocityRubric,
): number {
  const anchors = rubric.thresholds.map((t) => ({
    x: t.per_month,
    y: t.score,
  }));
  return clamp(interpolateLinear(perMonth, anchors));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
