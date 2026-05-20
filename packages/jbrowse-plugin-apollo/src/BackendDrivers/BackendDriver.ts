import type { Change, SerializedChange } from '@apollo-annotation/common'
import type {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import type { ValidationResultSet } from '@apollo-annotation/shared'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util'

import type { SubmitOpts } from '../ChangeManager'
import type { ClientDataStoreModel } from '../session/ClientDataStore'

export interface RefNameAliases {
  refName: string
  aliases: string[]
  uniqueId?: string
}

export interface ChangeDocument extends SerializedChange {
  sequence: IDBValidKey
  user?: string
  createdAt: string
  changes?: SerializedChange[]
}

export interface GetChangesOpts {
  page?: number
  pageSize?: number
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  filters?: {
    user?: string
    typeName?: string
    startTime?: string
    endTime?: string
  }
}

export interface GetChangesResult {
  changes: ChangeDocument[]
  totalCount: number
}

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStoreModel) {}

  abstract getFeatures(
    region: Region,
  ): Promise<[AnnotationFeatureSnapshot[], CheckResultSnapshot[]]>

  abstract getSequence(region: Region): Promise<{ seq: string; refSeq: string }>

  abstract getRegions(assemblyName: string): Promise<Region[]>

  abstract getAssemblies(internetAccountConfigId?: string): Assembly[]

  abstract getRefNameAliases(assemblyName: string): Promise<RefNameAliases[]>

  abstract submitChange(
    change: Change,
    opts: SubmitOpts,
  ): Promise<ValidationResultSet>

  abstract searchFeatures(
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]>

  abstract getChanges(
    assemblyName: string,
    opts?: GetChangesOpts,
  ): Promise<GetChangesResult>

  abstract getCheckResults(assemblyName: string): Promise<CheckResultSnapshot[]>
}
