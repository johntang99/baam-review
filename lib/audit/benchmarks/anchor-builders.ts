import type { RubricAnchor, VerticalBenchmarks } from "./types";

const KEY_RATING_VALUES = new Set([4.0, 4.5]);

export function buildRatingAnchors(
  benchmarks: VerticalBenchmarks,
): RubricAnchor[] {
  const curve = benchmarks.rubric.rating.curve;
  if (curve.length === 0) return [];

  const lo = curve[0];
  const hi = curve[curve.length - 1];

  const result: RubricAnchor[] = [
    {
      label: `${lo.rating.toFixed(1)}★`,
      value: lo.rating,
      score: lo.score,
      is_key: false,
    },
  ];

  for (const p of curve) {
    if (KEY_RATING_VALUES.has(p.rating)) {
      result.push({
        label: `${p.rating.toFixed(1)}★ · ${p.score}`,
        value: p.rating,
        score: p.score,
        is_key: true,
      });
    }
  }

  result.push({
    label: `${hi.rating.toFixed(1)}★ · ${hi.score}`,
    value: hi.rating,
    score: hi.score,
    is_key: false,
  });

  return result;
}

export function buildVolumeAnchors(
  benchmarks: VerticalBenchmarks,
): RubricAnchor[] {
  const thresholds = benchmarks.rubric.volume.thresholds;
  if (thresholds.length === 0) return [];

  const lo = thresholds[0];
  const hi = thresholds[thresholds.length - 1];

  const medianThreshold = thresholds.find((t) => t.score === 50);
  const top25Threshold = thresholds.find((t) => t.score === 70);

  const result: RubricAnchor[] = [
    { label: `${lo.count}`, value: lo.count, score: lo.score, is_key: false },
  ];

  if (medianThreshold) {
    result.push({
      label: `MEDIAN · ${medianThreshold.score}`,
      value: medianThreshold.count,
      score: medianThreshold.score,
      is_key: true,
    });
  }

  if (top25Threshold) {
    result.push({
      label: `TOP 25% · ${top25Threshold.score}`,
      value: top25Threshold.count,
      score: top25Threshold.score,
      is_key: true,
    });
  }

  result.push({
    label: `${hi.count}+`,
    value: hi.count,
    score: hi.score,
    is_key: false,
  });

  return result;
}

export function buildVelocityAnchors(
  benchmarks: VerticalBenchmarks,
): RubricAnchor[] {
  const thresholds = benchmarks.rubric.velocity.thresholds;
  if (thresholds.length === 0) return [];

  const lo = thresholds[0];
  const hi = thresholds[thresholds.length - 1];

  const min = benchmarks.healthy_velocity.minimum_per_month;
  const optimalLow = benchmarks.healthy_velocity.optimal_low_per_month;

  const minThreshold = nearestThreshold(thresholds, min);
  const optimalThreshold = nearestThreshold(thresholds, optimalLow);

  const result: RubricAnchor[] = [
    { label: `${lo.per_month}`, value: lo.per_month, score: lo.score, is_key: false },
  ];

  if (minThreshold) {
    result.push({
      label: `MIN · ${minThreshold.per_month}/mo`,
      value: minThreshold.per_month,
      score: minThreshold.score,
      is_key: true,
    });
  }

  if (optimalThreshold) {
    result.push({
      label: `OPTIMAL · ${optimalThreshold.per_month}/mo`,
      value: optimalThreshold.per_month,
      score: optimalThreshold.score,
      is_key: true,
    });
  }

  result.push({
    label: `${hi.per_month}+/mo`,
    value: hi.per_month,
    score: hi.score,
    is_key: false,
  });

  return result;
}

function nearestThreshold<T extends { per_month: number }>(
  thresholds: T[],
  target: number,
): T | undefined {
  if (thresholds.length === 0) return undefined;
  let nearest = thresholds[0];
  let nearestGap = Math.abs(nearest.per_month - target);
  for (const t of thresholds) {
    const gap = Math.abs(t.per_month - target);
    if (gap < nearestGap) {
      nearest = t;
      nearestGap = gap;
    }
  }
  return nearest;
}
