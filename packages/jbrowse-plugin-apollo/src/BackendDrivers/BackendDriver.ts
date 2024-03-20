import { Change, ClientDataStore } from '@apollo-annotation/apollo-common'
import {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/apollo-mst'
import { ValidationResultSet } from '@apollo-annotation/apollo-shared'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { Region } from '@jbrowse/core/util'

import { SubmitOpts } from '../ChangeManager'

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStore) {}

  abstract getFeatures(
    region: Region,
  ): Promise<[AnnotationFeatureSnapshot[], CheckResultSnapshot[]]>

  abstract getSequence(region: Region): Promise<{ seq: string; refSeq: string }>

  abstract getRegions(assemblyName: string): Promise<Region[]>

  abstract getAssemblies(internetAccountConfigId?: string): Assembly[]

  abstract submitChange(
    change: Change,
    opts: SubmitOpts,
  ): Promise<ValidationResultSet>

  abstract searchFeatures(
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]>
}
