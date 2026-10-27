import { describe, expect, it } from '@jest/globals'

import { getCDSRow, getRowContents, getStrandRow } from './rows'

describe.each([false, true])('with showFeatureLabels %s', (labels) => {
  const spacer = labels ? 2 : 1

  it('orders rows from frame +3 to frame -3', () => {
    const rows = [
      getCDSRow(3, labels),
      getCDSRow(2, labels),
      getCDSRow(1, labels),
      getStrandRow(1, labels),
      getStrandRow(-1, labels),
      getCDSRow(-1, labels),
      getCDSRow(-2, labels),
      getCDSRow(-3, labels),
    ]
    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((r) => r * spacer))
  })

  it('maps every row back to what is drawn in it', () => {
    for (const frame of [1, 2, 3, -1, -2, -3]) {
      expect(getRowContents(getCDSRow(frame, labels), labels)).toEqual({
        type: 'cds',
        frame,
      })
    }
    for (const strand of [1, -1] as const) {
      expect(getRowContents(getStrandRow(strand, labels), labels)).toEqual({
        type: 'gene',
        strand,
      })
    }
    expect(getRowContents(-1, labels)).toBeUndefined()
    expect(getRowContents(8 * spacer, labels)).toBeUndefined()
  })
})

it('leaves label rows empty', () => {
  for (const row of [1, 3, 5, 7, 9, 11, 13, 15]) {
    expect(getRowContents(row, true)).toBeUndefined()
  }
})
