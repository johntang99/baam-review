export function projectVelocityCount(
  currentCount: number,
  windowDays: number,
  monthsForward: number,
): number {
  const daysForward = monthsForward * 30;
  const proportionRemaining = Math.max(
    0,
    (windowDays - daysForward) / windowDays,
  );
  return Math.round(currentCount * proportionRemaining);
}
