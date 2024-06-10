/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssemblyI,
  CheckResultI,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { AppRootModel, Region } from '@jbrowse/core/util'

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
  checkResults: Map<string, CheckResultI>
  internetAccounts: AppRootModel['internetAccounts']
  getInternetAccount(
    assemblyName?: string,
    internetAccountId?: string,
  ): AppRootModel['internetAccounts'][0]
  loadFeatures(regions: Region[]): void
  loadRefSeq(regions: Region[]): void
  getFeature(featureId: string): AnnotationFeatureI | undefined
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  deleteFeature(featureId: string): void
  deleteAssembly(assemblyId: string): void
  addCheckResults(checkResults: CheckResultSnapshot[]): void
  addAssembly(assemblyId: string): ApolloAssemblyI
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
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
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
