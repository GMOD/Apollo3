import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { Region } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'
import Feature from './ApolloFeature'

export class Change {
  path: string[]

  newValue: unknown

  oldValue: unknown

  constructor({
    path,
    newValue,
    oldValue,
  }: {
    path: string[]
    newValue: unknown
    oldValue: unknown
  }) {
    this.path = path
    this.newValue = newValue
    this.oldValue = oldValue
  }

  getInverse() {
    return new Change({
      path: this.path,
      newValue: this.oldValue,
      oldValue: this.newValue,
    })
  }
}

export class ChangeSet {
  changes: Change[]

  constructor({ changes }: { changes: Change[] }) {
    this.changes = changes
  }

  getInverse() {
    return new ChangeSet({
      changes: this.changes.map(change => change.getInverse()),
    })
  }
}

type GenericAnnotation = unknown

export default abstract class BaseAnnotationDriver {
  configuration: AnyConfigurationModel

  featuresHandle: any

  changeSets: ChangeSet[] = []

  constructor(configuration: AnyConfigurationModel, featuresHandle: any) {
    this.configuration = configuration
    this.featuresHandle = featuresHandle
  }

  abstract getFeatures(
    region: Region,
    limit?: number,
  ): Promise<Record<string, SnapshotIn<typeof Feature>>>

  abstract getFeaturesInMultipleRegions(
    region: Region,
    limit?: number,
  ): Promise<SnapshotIn<typeof Feature>[]>

  abstract addFeature(feature: SnapshotIn<typeof Feature>): Promise<void>

  abstract updateFeature(featureId: string, data: ChangeSet): Promise<void>

  abstract deleteFeature(region: Region): Promise<void>

  abstract getAnnotations(
    featureId: string,
  ): Promise<Map<string, GenericAnnotation>>

  abstract getAnnotation(
    featureId: string,
    type: string,
  ): Promise<GenericAnnotation>

  abstract addAnnotation(
    featuredId: string,
    type: string,
    data: ChangeSet,
  ): Promise<void>

  abstract updateAnnotation(
    featuredId: string,
    type: string,
    data: ChangeSet,
  ): Promise<void>

  abstract deleteAnnotation(
    featuredId: string,
    type: string,
    data: ChangeSet,
  ): Promise<void>

  abstract apply(change: ChangeSet): Promise<void>

  async undo() {
    const changeSet = this.changeSets.pop()
    if (!changeSet) {
      return undefined
    }
    return this.apply(changeSet.getInverse())
  }
}
