import { readFileSync } from 'node:fs'

import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

export function readAnnotationFeatureSnapshot(
  fn: string,
): AnnotationFeatureSnapshot {
  const lines = readFileSync(fn).toString()
  return JSON.parse(lines) as AnnotationFeatureSnapshot
}

export const testCases: { filenameStem: string; description: string }[] = [
  {
    filenameStem: 'single_feature_no_children',
    description: 'there is a single feature with no children',
  },
  {
    filenameStem: 'single_feature_two_children',
    description: 'there is a single feature with two children',
  },
  {
    filenameStem: 'gene_with_two_cds',
    description: 'Gene with two CDS',
  },
]
