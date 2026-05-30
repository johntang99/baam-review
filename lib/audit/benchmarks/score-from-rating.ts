import { interpolateLinear } from "./interpolator";
import type { RatingRubric } from "./types";

export function scoreFromRating(
  rating: number,
  rubric: RatingRubric,
): number {
  const anchors = rubric.curve.map((p) => ({ x: p.rating, y: p.score }));
  return clamp(interpolateLinear(rating, anchors));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
