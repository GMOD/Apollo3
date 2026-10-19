import { describe, expect, it } from '@jest/globals'

import { copyFeatureCoordinates } from './copyFeatureCoordinates'

describe('Copy feature destination coordinates', () => {
  it.each([
    [1, 50, 0, 1000, { min: 0, max: 50 }],
    [101, 50, 0, 1000, { min: 100, max: 150 }],
    [951, 50, 0, 1000, { min: 950, max: 1000 }],
    [1000, 1, 0, 1000, { min: 999, max: 1000 }],
    [101, 50, 100, 150, { min: 100, max: 150 }],
  ])(
    'copies position %s with length %s within %s..%s',
    (start, length, min, max, expected) => {
      expect(
        copyFeatureCoordinates(start, length, { start: min, end: max }),
      ).toEqual(expected)
    },
  )

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid position %s',
    (start) => {
      expect(() =>
        copyFeatureCoordinates(start, 50, { start: 0, end: 1000 }),
      ).toThrow('Start position must be a positive whole number.')
    },
  )

  it('rejects a feature extending beyond the reference', () => {
    expect(() =>
      copyFeatureCoordinates(952, 50, { start: 0, end: 1000 }),
    ).toThrow('Feature would end at 1001, but reference sequence ends at 1000')
  })

  it('reports the lower bound in the same 1-based coordinates as the input', () => {
    expect(() =>
      copyFeatureCoordinates(100, 50, { start: 100, end: 1000 }),
    ).toThrow(
      'Reference sequence starts at 101, feature cannot start before that.',
    )
  })
})
