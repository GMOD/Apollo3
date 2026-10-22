import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import type { ApolloSessionModel } from '../session'

import { isCDSFeature, isExonFeature } from './glyphUtils'

type MinEdge = 'min'
type MaxEdge = 'max'
export type Edge = MinEdge | MaxEdge

interface LocationChange {
  featureId: string
  oldLocation: number
  newLocation: number
}

function expandFeatures(
  feature: AnnotationFeature,
  newLocation: number,
  edge: Edge,
  session?: ApolloSessionModel,
): LocationChange[] {
  const featureId = feature._id
  const oldLocation = feature[edge]
  const changes: LocationChange[] = [{ featureId, oldLocation, newLocation }]
  const { parent } = feature
  if (session ? isCDSFeature(feature, session) : feature.type === 'CDS') {
    for (const exon of parent?.children?.values() ?? []) {
      const isExon = session
        ? isExonFeature(exon, session)
        : exon.type === 'exon'
      const containsOldEdge =
        edge === 'min'
          ? exon.min <= oldLocation && oldLocation < exon.max
          : exon.min < oldLocation && oldLocation <= exon.max
      const extendsExon =
        edge === 'min' ? newLocation < exon.min : newLocation > exon.max
      if (isExon && containsOldEdge && extendsExon) {
        // CDS and exon are siblings: extending the CDS must also keep its
        // terminal coding bases inside the exon, without moving other exons.
        changes.push({
          featureId: exon._id,
          oldLocation: exon[edge],
          newLocation,
        })
      }
    }
  }
  if (
    parent &&
    ((edge === 'min' && parent[edge] > newLocation) ||
      (edge === 'max' && parent[edge] < newLocation))
  ) {
    changes.push(...expandFeatures(parent, newLocation, edge, session))
  }
  return changes
}

function shrinkFeatures(
  feature: AnnotationFeature,
  newLocation: number,
  edge: Edge,
  shrinkParent: boolean,
  childIdToSkip?: string,
): LocationChange[] {
  const featureId = feature._id
  const oldLocation = feature[edge]
  const changes: LocationChange[] = [{ featureId, oldLocation, newLocation }]
  const { parent, children } = feature
  if (children) {
    for (const [, child] of children) {
      if (child._id === childIdToSkip) {
        continue
      }
      if (
        (edge === 'min' && child[edge] < newLocation) ||
        (edge === 'max' && child[edge] > newLocation)
      ) {
        changes.push(...shrinkFeatures(child, newLocation, edge, shrinkParent))
      }
    }
  }
  if (parent && shrinkParent) {
    const siblings: AnnotationFeature[] = []
    if (parent.children) {
      for (const [, c] of parent.children) {
        if (c._id === featureId) {
          continue
        }
        siblings.push(c)
      }
    }
    if (siblings.length === 0) {
      changes.push(
        ...shrinkFeatures(parent, newLocation, edge, shrinkParent, featureId),
      )
    } else {
      const oldLocation = parent[edge]
      const boundedLocation = Math[edge](
        ...siblings.map((s) => s[edge]),
        newLocation,
      )
      if (boundedLocation !== oldLocation) {
        changes.push(
          ...shrinkFeatures(
            parent,
            boundedLocation,
            edge,
            shrinkParent,
            featureId,
          ),
        )
      }
    }
  }
  return changes
}

export function getPropagatedLocationChanges(
  feature: AnnotationFeature,
  newLocation: number,
  edge: Edge,
  shrinkParent = false,
  session?: ApolloSessionModel,
): LocationChange[] {
  const oldLocation = feature[edge]
  if (newLocation === oldLocation) {
    throw new Error(`New and existing locations are the same: "${newLocation}"`)
  }
  if (edge === 'min') {
    if (newLocation > oldLocation) {
      // shrinking feature, may need to shrink children and/or parents
      return shrinkFeatures(feature, newLocation, edge, shrinkParent)
    }
    return expandFeatures(feature, newLocation, edge, session)
  }
  if (newLocation < oldLocation) {
    return shrinkFeatures(feature, newLocation, edge, shrinkParent)
  }
  return expandFeatures(feature, newLocation, edge, session)
}

/** extended information about the position of the mouse on the canvas, including the refName, bp, and displayedRegion number */
export interface MousePosition {
  x: number
  y: number
  refName: string
  bp: number
  regionNumber: number
  feature?: AnnotationFeature
}

export type MousePositionWithFeature = Required<MousePosition>

export function isMousePositionWithFeature(
  mousePosition: MousePosition,
): mousePosition is MousePositionWithFeature {
  return 'feature' in mousePosition
}

export function getMousePosition(
  event: React.MouseEvent,
  lgv: LinearGenomeViewModel,
): MousePosition {
  const canvas = event.currentTarget
  const { clientX, clientY } = event
  const { left, top } = canvas.getBoundingClientRect()
  const x = clientX - left
  const y = clientY - top
  const { coord: bp, index: regionNumber, refName } = lgv.pxToBp(x)
  return { x, y, refName, bp, regionNumber }
}
