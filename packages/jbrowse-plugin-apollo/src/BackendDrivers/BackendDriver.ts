import { Region } from '@jbrowse/core/util'
import { Change, ClientDataStore } from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'

import { SubmitOpts } from '../ChangeManager'

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStore) {}

  abstract getFeatures(region: Region): Promise<AnnotationFeatureSnapshot[]>

  abstract getSequence(region: Region): Promise<{ seq: string; refSeq: string }>

  abstract getRefSeqs(): Promise<string[]>

  abstract submitChange(
    change: Change,
    opts: SubmitOpts,
  ): Promise<ValidationResultSet>
}
