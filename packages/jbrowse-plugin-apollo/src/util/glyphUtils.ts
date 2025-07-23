import {
  type AnnotationFeature,
  type TranscriptPartCoding,
} from '@apollo-annotation/mst'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMinAndMaxPx(
  feature: AnnotationFeature | TranscriptPartCoding,
  refName: string,
  regionNumber: number,
  lgv: LinearGenomeViewModel,
): [number, number] | undefined {
  const minPxInfo = lgv.bpToPx({
    refName,
    coord: feature.min,
    regionNumber,
  })
  const maxPxInfo = lgv.bpToPx({
    refName,
    coord: feature.max,
    regionNumber,
  })
  if (minPxInfo === undefined || maxPxInfo === undefined) {
    return
  }
  const { offsetPx } = lgv
  const minPx = minPxInfo.offsetPx - offsetPx
  const maxPx = maxPxInfo.offsetPx - offsetPx
  return [minPx, maxPx]
}

export function getOverlappingEdge(
  feature: AnnotationFeature,
  x: number,
  minMax: [number, number],
): { feature: AnnotationFeature; edge: 'min' | 'max' } | undefined {
  const [minPx, maxPx] = minMax
  // Feature is too small to tell if we're overlapping an edge
  if (Math.abs(maxPx - minPx) < 8) {
    return
  }
  if (Math.abs(minPx - x) < 4) {
    return { feature, edge: 'min' }
  }
  if (Math.abs(maxPx - x) < 4) {
    return { feature, edge: 'max' }
  }
  return
}

export function isSelectedFeature(
  feature: AnnotationFeature,
  selectedFeature: AnnotationFeature | undefined,
) {
  return Boolean(selectedFeature && feature._id === selectedFeature._id)
}
