import { Region } from '@jbrowse/core/util'
import { AppRootModel } from '@jbrowse/core/util'
import {
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssemblyI,
} from 'apollo-mst'

import { changeRegistry } from './ChangeTypeRegistry'
import {
  BackendDataStore,
  Operation,
  OperationOptions,
  SerializedOperation,
} from './Operation'

export interface ClientDataStore {
  typeName: 'Client'
  assemblies: Map<string, ApolloAssemblyI>
  internetAccounts: AppRootModel['internetAccounts']
  loadFeatures(regions: Region[]): void
  loadRefSeq(regions: Region[]): void
  getFeature(featureId: string): AnnotationFeatureI | undefined
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  deleteFeature(featureId: string): void
  deleteAssembly(assemblyId: string): void
}

export type SerializedChange = SerializedOperation
export type ChangeOptions = OperationOptions

export type DataStore = BackendDataStore | ClientDataStore

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isChange(thing: any): thing is Change {
  return (thing as Change).executeOnClient !== undefined
}

export abstract class Change extends Operation {
  /**
   * If a non-empty string, a snackbar will display in JBrowse with this message
   * when a successful response is received from the server.
   */
  get notification() {
    return ''
  }

  static fromJSON(json: SerializedOperation, options?: ChangeOptions): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json, options?.logger && { logger: options.logger })
  }

  async execute(backend: DataStore): Promise<unknown> {
    const backendType = backend.typeName
    if (backendType === 'LocalGFF3' || backendType === 'Server') {
      return super.execute(backend)
    }
    if (backendType === 'Client') {
      return this.executeOnClient(backend)
    }
    throw new Error(
      `no change implementation for backend type '${backendType}'`,
    )
  }

  abstract executeOnClient(backend: ClientDataStore): Promise<void>

  abstract getInverse(): Change
}
