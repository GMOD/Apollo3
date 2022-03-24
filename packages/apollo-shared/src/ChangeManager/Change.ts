import { GFF3FeatureLineWithRefs } from '@gmod/gff'
import { IAnyStateTreeNode, Instance, SnapshotIn } from 'mobx-state-tree'
import { Model } from 'mongoose'

import { FeaturesForRefName } from '../BackendDrivers/AnnotationFeature'
import { BackendDriver } from '../BackendDrivers/BackendDriver'
import { FeatureDocument } from '../schemas/feature.schema'
import { changeRegistry } from './ChangeTypes'

export interface ClientDataStore extends IAnyStateTreeNode {
  typeName: 'Client'
  features: Instance<typeof FeaturesForRefName>
  load(features: SnapshotIn<typeof FeaturesForRefName>): void
  backendDriver?: BackendDriver
  internetAccountConfigId?: string
}
export interface LocalGFF3DataStore {
  typeName: 'LocalGFF3'
  featureModel: Model<FeatureDocument>
}

export interface GFF3FeatureLineWithRefsAndFeatureId
  extends GFF3FeatureLineWithRefs {
  featureId: string
  GFF3FeatureLineWithRefs: GFF3FeatureLineWithRefs
}

export interface SerializedChange extends Record<string, unknown> {
  /** The IDs of genes, etc. that were changed in this operation */
  changedIds: string[]
  typeName: string
}

export type DataStore = LocalGFF3DataStore | ClientDataStore

export abstract class Change {
  /** have this return name of change type */
  abstract get typeName(): string

  static fromJSON(json: SerializedChange): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json)
  }

  abstract toJSON(): SerializedChange

  async apply(backend: DataStore): Promise<void> {
    const backendType = backend.typeName
    if (backendType === 'LocalGFF3') {
      return this.applyToLocalGFF3(backend)
    }
    if (backendType === 'Client') {
      return this.applyToClient(backend)
    }
    throw new Error(
      `no change implementation for backend type '${backendType}'`,
    )
  }

  /**
   * Get single feature by featureId
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  async getObjectByFeatureId(
    featureObject: GFF3FeatureLineWithRefs[],
    featureId: string,
  ) {
    // Loop all lines and add those into cache
    for (const entry of featureObject) {
      console.debug(`Entry=${JSON.stringify(entry)}`)
      if (entry.hasOwnProperty('featureId')) {
        const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
          Object.assign(entry)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        console.debug(`Top level featureId=${assignedVal.featureId!}`)
        // If matches
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (assignedVal.featureId! === featureId) {
          console.debug(
            `Top level featureId matches in object ${JSON.stringify(
              assignedVal,
            )}`,
          )
          return entry
        }
        // Check if there is also childFeatures in parent feature and it's not empty
        if (
          entry.hasOwnProperty('child_features') &&
          Object.keys(assignedVal.child_features).length > 0
        ) {
          // Let's get featureId from recursive method
          console.debug(
            `FeatureId was not found on top level so lets make recursive call...`,
          )
          const foundRecursiveObject = await this.getNestedFeatureByFeatureId(
            assignedVal,
            featureId,
          )
          if (foundRecursiveObject) {
            return foundRecursiveObject
          }
        }
      }
    }
    return null
  }

  //  * DEMO - SEARCH RECURSIVELY CORRECT OBJECT FROM FEATRUE
  async getNestedFeatureByFeatureId(
    parentFeature: GFF3FeatureLineWithRefs,
    featureId: string,
  ) {
    // If there is child features and size is not 0
    if (
      parentFeature.hasOwnProperty('child_features') &&
      Object.keys(parentFeature.child_features).length > 0
    ) {
      // Loop each child feature
      for (
        let i = 0;
        i < Object.keys(parentFeature.child_features).length;
        i++
      ) {
        // There can be several features with same ID so we need to loop
        for (let j = 0; parentFeature.child_features[i].length > j; j++) {
          const assignedVal: GFF3FeatureLineWithRefsAndFeatureId =
            Object.assign(parentFeature.child_features[i][j])
          // Let's add featureId if it doesn't exist yet
          if (assignedVal.hasOwnProperty('featureId')) {
            console.debug(`Recursive object featureId=${assignedVal.featureId}`)
            // If featureId matches
            if (assignedVal.featureId === featureId) {
              console.debug(
                `Found featureId from recursive object ${JSON.stringify(
                  assignedVal,
                )}`,
              )
              return assignedVal
            }
          }
          // Check if there is also childFeatures in parent feature and it's not empty
          if (
            assignedVal.hasOwnProperty('child_features') &&
            Object.keys(assignedVal.child_features).length > 0
          ) {
            // Let's add featureId to each child recursively
            const foundObject = (await this.getNestedFeatureByFeatureId(
              assignedVal,
              featureId,
            )) as GFF3FeatureLineWithRefs
            console.debug(
              `Found recursive object is ${JSON.stringify(foundObject)}`,
            )
            if (foundObject != null) {
              return foundObject
            }
          }
        }
      }
    }
    return null
  }

  abstract applyToLocalGFF3(backend: LocalGFF3DataStore): Promise<void>
  abstract applyToClient(backend: ClientDataStore): Promise<void>

  abstract getInverse(): Change
}
