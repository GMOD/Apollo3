import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'

import type { Change } from '../Change.js'
import type { ChangeConstructor } from '../ChangeTypeRegistry.js'

/** A region of a reference sequence to load features for */
export interface ClientRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

/** The parts of the client's data store a change handler can use */
export interface ClientChangeDataStore {
  /** Get a loaded feature, which can be modified with its actions */
  getFeature(featureId: string): AnnotationFeature | undefined
  /** Add a new top-level feature */
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  /** Delete a feature, top-level or not */
  deleteFeature(featureId: string): void
  /** Load the features in some regions, e.g. to find a parent feature */
  loadFeatures(regions: ClientRegion[]): Promise<unknown>
}

/** What a {@link ClientChangeType.handler} can use to apply a change */
export interface ClientChangeContext {
  dataStore: ClientChangeDataStore
}

/** A change type the client knows about */
export interface ClientChangeType<C extends Change = Change> {
  /** The change class, used to deserialize changes from the server */
  changeType: ChangeConstructor
  /**
   * Apply the change to the features loaded in the client. Omit this for
   * changes that don't affect loaded features, e.g. user management changes.
   * Throwing means the client may be out of sync with the server.
   */
  handler?(change: C, context: ClientChangeContext): void | Promise<void>
}
