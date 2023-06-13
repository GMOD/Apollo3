import type { AnnotationFeatureI } from 'apollo-mst'
import {
  LocationEndChange,
  LocationStartChange,
  TypeChange,
} from 'apollo-shared'

import type { ChangeManager } from '../../ChangeManager'

export function handleFeatureTypeChange(
  changeManager: ChangeManager,
  feature: AnnotationFeatureI,
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
  feature: AnnotationFeatureI,
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
  feature: AnnotationFeatureI,
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
