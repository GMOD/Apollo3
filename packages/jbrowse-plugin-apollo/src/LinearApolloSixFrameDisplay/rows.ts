// Rows are fixed: forward frames on top, then the forward and reverse gene
// rows, then reverse frames, mirrored so frames +1 and -1 are next to the gene
// rows. With feature labels shown, every other row is left empty for labels.
//
//   row  contents
//   0    frame +3
//   1    frame +2
//   2    frame +1
//   3    genes, strand +1
//   4    genes, strand -1
//   5    frame -1
//   6    frame -2
//   7    frame -3

/** Number of rows, not counting the empty rows left for labels */
export const rowCount = 8

export type RowContents =
  | { type: 'gene'; strand: 1 | -1 }
  | { type: 'cds'; frame: number }

function labelSpacer(showFeatureLabels: boolean) {
  return showFeatureLabels ? 2 : 1
}

/** 0-based row a CDS in the given frame (from `getFrame`) is drawn in */
export function getCDSRow(frame: number, showFeatureLabels: boolean) {
  const row = frame > 0 ? 3 - frame : 4 - frame
  return row * labelSpacer(showFeatureLabels)
}

/** 0-based row a gene or exon on the given strand is drawn in */
export function getStrandRow(
  strand: number | undefined,
  showFeatureLabels: boolean,
) {
  return (strand === 1 ? 3 : 4) * labelSpacer(showFeatureLabels)
}

/** What is drawn in the given 0-based row, if anything */
export function getRowContents(
  row: number,
  showFeatureLabels: boolean,
): RowContents | undefined {
  const spacer = labelSpacer(showFeatureLabels)
  if (row < 0 || row % spacer !== 0) {
    return
  }
  const baseRow = row / spacer
  if (baseRow < 3) {
    return { type: 'cds', frame: 3 - baseRow }
  }
  if (baseRow === 3) {
    return { type: 'gene', strand: 1 }
  }
  if (baseRow === 4) {
    return { type: 'gene', strand: -1 }
  }
  if (baseRow < rowCount) {
    return { type: 'cds', frame: 4 - baseRow }
  }
  return
}
