/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
  ApolloAssemblyI,
  BackendDriverType,
  CheckResultI,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import type {
  AssemblyDocument,
  CheckDocument,
  FeatureDocument,
  FileDocument,
  JBrowseConfigDocument,
  RefSeqChunkDocument,
  RefSeqDocument,
  UserDocument,
} from '@apollo-annotation/schemas'
import type { GFF3Feature } from '@gmod/gff'
import type { AppRootModel, Region } from '@jbrowse/core/util'
import type { LoggerService } from '@nestjs/common'
import type { GenericFilehandle } from 'generic-filehandle2'
import type { ClientSession, Model } from 'mongoose'

import { changeRegistry } from './ChangeTypeRegistry.js'

interface CreateFileDto {
  readonly _id: string
  readonly basename: string
  readonly checksum: string
  readonly type: 'text/x-gff3' | 'text/x-fasta'
  readonly user: string
}

export interface ServerDataStore {
  typeName: 'Server'
  featureModel: Model<FeatureDocument>
  assemblyModel: Model<AssemblyDocument>
  refSeqModel: Model<RefSeqDocument>
  refSeqChunkModel: Model<RefSeqChunkDocument>
  checkModel: Model<CheckDocument>
  fileModel: Model<FileDocument>
  userModel: Model<UserDocument>
  jbrowseConfigModel: Model<JBrowseConfigDocument>
  session: ClientSession
  filesService: {
    getFileStream(file: FileDocument): ReadableStream<Uint8Array>
    getFileHandle(file: FileDocument): GenericFilehandle
    parseGFF3(
      stream: ReadableStream<Uint8Array>,
      parseOptions?: {
        bufferSize?: number
        errorCallback?(errorMessage: string): void
      },
    ): ReadableStream<GFF3Feature>
    create(createFileDto: CreateFileDto): void
    remove(id: string): void
  }
  pluginsService: {
    evaluateExtensionPoint(
      extensionPointName: string,
      extendee: unknown,
      props?: Record<string, unknown>,
    ): unknown
  }
  counterService: {
    getNextSequenceValue(sequenceName: string): Promise<number>
  }
  user: string
}
export interface SerializedChange {
  typeName: string
}

export type BackendDataStore = ServerDataStore

export interface ChangeOptions {
  logger: LoggerService
}

export interface ClientDataStore {
  typeName: 'Client'
  assemblies: Map<string | number, ApolloAssemblyI>
  checkResults: Map<string | number, CheckResultI>
  internetAccounts: AppRootModel['internetAccounts']
  getInternetAccount(
    assemblyName?: string,
    internetAccountId?: string,
  ): AppRootModel['internetAccounts'][0]
  loadFeatures(regions: Region[]): Promise<void>
  loadRefSeq(regions: Region[]): void
  getFeature(featureId: string): AnnotationFeature | undefined
  addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot): void
  deleteFeature(featureId: string): void
  deleteAssembly(assemblyId: string): void
  addCheckResults(checkResults: CheckResultSnapshot[]): void
  addAssembly(
    assemblyId: string,
    backendDriverType?: BackendDriverType,
  ): ApolloAssemblyI
  clearCheckResults(): void
}

export type DataStore = BackendDataStore | ClientDataStore

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isChange(thing: any): thing is Change {
  return (thing as Change).executeOnClient !== undefined
}

export abstract class Change {
  protected logger: LoggerService
  abstract typeName: string

  constructor(json: SerializedChange, options?: ChangeOptions) {
    this.logger = options?.logger ?? console
  }

  abstract toJSON(): SerializedChange

  /**
   * If a non-empty string, a snackbar will display in JBrowse with this message
   * when a successful response is received from the server.
   */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get notification(): string {
    return ''
  }

  static fromJSON(json: SerializedChange, options?: ChangeOptions): Change {
    const ChangeType = changeRegistry.getChangeType(json.typeName)
    return new ChangeType(json, options?.logger && { logger: options.logger })
  }

  async execute(backend: DataStore): Promise<unknown> {
    const backendType = backend.typeName
    if (backendType === 'Server') {
      return this.executeOnServer(backend)
    }
    return this.executeOnClient(backend)
  }

  abstract executeOnClient(backend: ClientDataStore): Promise<void>
  abstract executeOnServer(backend: BackendDataStore): Promise<void>

  abstract getInverse(): Change
}
