/** Translate the dialog's 1-based position to an interbase interval. */
export function copyFeatureCoordinates(
  start: number,
  length: number,
  region: { start: number; end: number },
) {
  if (!Number.isInteger(start) || start < 1) {
    throw new Error('Start position must be a positive whole number.')
  }
  const min = start - 1
  const max = min + length
  if (max > region.end) {
    throw new Error(
      `Feature would extend beyond the bounds of the selected reference sequence. (Feature would end at ${max}, but reference sequence ends at ${region.end})`,
    )
  }
  if (min < region.start) {
    throw new Error(
      `Reference sequence starts at ${region.start + 1}, feature cannot start before that.`,
    )
  }
  return { min, max }
}
