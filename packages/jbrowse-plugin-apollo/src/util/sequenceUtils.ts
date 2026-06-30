const START_CODON = 'ATG'
const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA'])

export function findLongestOrf(sequence: string) {
  const starts: [number | null, number | null, number | null] = [
    null,
    null,
    null,
  ]
  let longest: [number, number] | undefined
  for (let start = 0; start < sequence.length - 2; start++) {
    const codon = sequence.slice(start, start + 3).toUpperCase()
    const frame = (start % 3) as 0 | 1 | 2
    if (codon === START_CODON && starts[frame] === null) {
      starts[frame] = start
    } else if (STOP_CODONS.has(codon)) {
      const inFrameStart = starts[frame]
      if (inFrameStart === null) {
        continue
      }
      const length = start - inFrameStart
      if (!longest || longest[1] - longest[0] < length) {
        longest = [inFrameStart, start]
      }
      starts[frame] = null
    }
  }
  return longest
}
