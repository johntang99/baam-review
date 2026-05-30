import { interpolateLinear } from "./interpolator";
import type { VolumeRubric } from "./types";

export function scoreFromVolume(
  count: number,
  rubric: VolumeRubric,
): number {
  const anchors = rubric.thresholds.map((t) => ({ x: t.count, y: t.score }));
  return clamp(interpolateLinear(count, anchors));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
