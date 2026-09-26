/** Screen-facing annotations replace carriage artwork at oblique camera angles.
 * A ten-degree dead band prevents rapid texture changes while orbiting. */
export function shouldShowTrainBadge(pitchRadians: number, wasBadge: boolean): boolean {
  const pitchDegrees = (Math.abs(pitchRadians) * 180) / Math.PI;
  return pitchDegrees < (wasBadge ? 65 : 55);
}
