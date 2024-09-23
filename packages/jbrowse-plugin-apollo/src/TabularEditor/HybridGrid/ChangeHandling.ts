import type { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
  TypeChange,
} from '@apollo-annotation/shared'

import type { ChangeManager } from '../../ChangeManager'

export function handleFeatureTypeChange(
  changeManager: ChangeManager,
  feature: AnnotationFeature,
  oldType: string,
  newType: string,
) {
  const featureId = feature._id
  const change = new TypeChange({
    typeName: 'TypeChange',
    changedIds: [featureId],
    featureId,
    oldType: String(oldType),
    newType: String(newType),
    assembly: feature.assemblyId,
  })
  return changeManager.submit(change)
}

export function handleFeatureStartChange(
  changeManager: ChangeManager,
  feature: AnnotationFeature,
  oldStart: number,
  newStart: number,
) {
  const featureId = feature._id
  const change = new LocationStartChange({
    typeName: 'LocationStartChange',
    changedIds: [featureId],
    featureId,
    oldStart,
    newStart,
    assembly: feature.assemblyId,
  })

  return changeManager.submit(change)
}

export function handleFeatureEndChange(
  changeManager: ChangeManager,
  feature: AnnotationFeature,
  oldEnd: number,
  newEnd: number,
) {
  const featureId = feature._id
  const change = new LocationEndChange({
    typeName: 'LocationEndChange',
    changedIds: [featureId],
    featureId,
    oldEnd,
    newEnd,
    assembly: feature.assemblyId,
  })
  return changeManager.submit(change)
}
