import { Region } from '@jbrowse/core/util'
import { AppRootModel } from '@jbrowse/core/util'
import {
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssemblyI,
} from 'apollo-mst'

import {
  BackendDataStore,
  LocalGFF3DataStore,
  Operation,
  OperationOptions,
  SerializedOperation,
  ServerDataStore,
} from '../../Operations/abstract'
import { changeRegistry } from '..'

export interface ClientDataStore {
  typeName: 'Client'
  assemblies: Map<string, ApolloAssemblyI>
  internetAccounts: AppRootModel['internetAccounts']
  loadFeatures(regions: Region[]): void
  getFeature(featureId: string): AnnotationFeatureI | undefined
  addAssembly(_id: string, assemblyName: string): void
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  deleteFeature(featureId: string): void
  deleteAssembly(assemblyId: string): void
}

export { ServerDataStore, LocalGFF3DataStore }

export type SerializedChange = SerializedOperation
export type ChangeOptions = OperationOptions

export type DataStore = BackendDataStore | ClientDataStore

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

  async execute(backend: DataStore): Promise<void> {
    const backendType = backend.typeName
    if (backendType === 'LocalGFF3' || backendType === 'Server') {
      super.execute(backend)
    } else if (backendType === 'Client') {
      return this.executeOnClient(backend)
    } else {
      throw new Error(
        `no change implementation for backend type '${backendType}'`,
      )
    }
  }

  abstract executeOnClient(backend: ClientDataStore): Promise<void>

  abstract getInverse(): Change
}
