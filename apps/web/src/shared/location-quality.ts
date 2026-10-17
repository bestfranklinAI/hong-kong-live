/** Application guidance threshold, not a guarantee of street or indoor-floor accuracy. */
export function canGuideFrom(fix: { accuracy: number } | null | undefined): boolean {
  return Boolean(fix && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= 60);
}
