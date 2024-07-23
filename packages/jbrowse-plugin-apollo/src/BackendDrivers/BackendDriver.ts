import { Change, ClientDataStore } from '@apollo-annotation/common'
import {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { ValidationResultSet } from '@apollo-annotation/shared'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { Region } from '@jbrowse/core/util'

import { SubmitOpts } from '../ChangeManager'

export interface RefNameAliases {
  refName: string
  aliases: string[]
  uniqueId: string
}

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStore) {}

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
}
