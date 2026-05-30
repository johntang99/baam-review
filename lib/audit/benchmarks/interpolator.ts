export interface Anchor {
  x: number;
  y: number;
}

export function interpolateLinear(value: number, anchors: Anchor[]): number {
  if (anchors.length === 0) return 0;

  const sorted = [...anchors].sort((a, b) => a.x - b.x);

  if (value <= sorted[0].x) return sorted[0].y;
  if (value >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (value >= left.x && value <= right.x) {
      const span = right.x - left.x;
      if (span === 0) return left.y;
      const t = (value - left.x) / span;
      return left.y + t * (right.y - left.y);
    }
  }

  return sorted[sorted.length - 1].y;
}
